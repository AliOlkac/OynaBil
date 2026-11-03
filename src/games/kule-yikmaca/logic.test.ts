import { describe, expect, it } from "vitest";
import type { PlayableQuestion } from "@/core/deck";
import { defaultTeams } from "../teams";
import type { Team } from "../types";
import {
  AIM_LOCK_MS,
  BANDS,
  SWEEP_MS,
  TOWER_HP,
  WIND_STEP,
  createSiege,
  damageFor,
  dealt,
  siegeReducer,
  sweepAt,
  turnSide,
  windFor,
  windShift,
  zoneAt,
  type SiegeSettings,
  type SiegeState,
} from "./logic";

const deck: PlayableQuestion[] = Array.from({ length: 12 }, (_, i) => ({
  id: `dkab-7-1-${String(i + 1).padStart(2, "0")}`,
  unit: "dkab-7-1",
  type: "multiple-choice",
  difficulty: i === 1 ? 3 : 1,
  prompt: `Soru ${i + 1}`,
  options: ["A", "B", "C", "D"],
  correctIndex: i % 4,
  explanation: "Açıklama",
}));

const teams = defaultTeams(2) as [Team, Team];
const reduce = siegeReducer(deck);

/** Rüzgârsız bir tohum: ilk turların rüzgârı sıfır olan tohumu arar. */
function calmSeed(turns: number) {
  for (let seed = 1; seed < 10_000; seed++) {
    if (Array.from({ length: turns }, (_, t) => windFor(seed, t)).every((w) => w === 0)) return seed;
  }
  throw new Error("rüzgârsız tohum bulunamadı");
}

const start = (over: Partial<SiegeSettings> = {}, seed = calmSeed(2)) =>
  reduce(createSiege(teams, { rounds: 3, seconds: 30, ...over }, seed), { type: "start", now: 0 });

/** Nişangâhın verilen yüksekliğe ilk ulaştığı an (çıkışta). */
const timeFor = (aim: number) => AIM_LOCK_MS + (aim * SWEEP_MS) / 2;

function fireAt(s: SiegeState, aim: number) {
  return reduce(s, { type: "fire", now: (s.aimStart ?? 0) + timeFor(aim) });
}

describe("Kule Yıkmaca: atış hesabı", () => {
  it("nişangâh aşağıdan yukarı çıkıp iner, kilitliyken yerde bekler", () => {
    expect(sweepAt(0)).toBe(0);
    expect(sweepAt(AIM_LOCK_MS - 1)).toBe(0);
    expect(sweepAt(timeFor(0.5))).toBeCloseTo(0.5);
    expect(sweepAt(AIM_LOCK_MS + SWEEP_MS / 2)).toBeCloseTo(1);
    expect(sweepAt(AIM_LOCK_MS + SWEEP_MS * 0.75)).toBeCloseTo(0.5);
    expect(sweepAt(AIM_LOCK_MS + SWEEP_MS)).toBeCloseTo(0);
  });

  it("bölgeler aralıksız ve sıralı; pencere en çok, temel en az hasar verir", () => {
    for (let i = 1; i < BANDS.length; i++) expect(BANDS[i].from).toBe(BANDS[i - 1].to);
    expect(zoneAt(-0.2)).toBe("kisa");
    expect(zoneAt(0.43)).toBe("pencere");
    expect(zoneAt(1.3)).toBe("uzun");
    const hits = (["temel", "govde", "pencere", "burc", "kulah"] as const).map((z) => damageFor(z, "tas", 5));
    expect(Math.max(...hits)).toBe(damageFor("pencere", "tas", 5));
    expect(Math.min(...hits)).toBe(damageFor("temel", "tas", 5));
    expect(damageFor("kisa", "ates", 5)).toBe(0);
    expect(damageFor("pencere", "ates", 5)).toBeGreaterThan(damageFor("pencere", "tas", 5));
    // Az turlu oyunda tek isabet daha çok hasar verir ki kule yıkılabilsin.
    expect(damageFor("govde", "tas", 3)).toBeGreaterThan(damageFor("govde", "tas", 8));
  });

  it("rüzgâr tohumdan belirlenir, -3..3 arasıdır ve iki takımı ters yönde etkiler", () => {
    const winds = Array.from({ length: 400 }, (_, t) => windFor(42, t));
    expect(winds).toEqual(Array.from({ length: 400 }, (_, t) => windFor(42, t)));
    expect(Math.min(...winds)).toBe(-3);
    expect(Math.max(...winds)).toBe(3);
    expect(winds.filter((w) => w === 0).length).toBeGreaterThan(20);
    expect(windShift(0, 2)).toBeCloseTo(2 * WIND_STEP);
    expect(windShift(1, 2)).toBeCloseTo(-2 * WIND_STEP);
  });
});

describe("Kule Yıkmaca: oyun akışı", () => {
  it("doğru cevap atış hakkı verir; nişangâh pencerede durdurulursa kritik hasar olur", () => {
    let s = start();
    expect(s.phase).toBe("question");
    s = reduce(s, { type: "answer", option: deck[0].correctIndex, now: 1000 });
    expect(s.phase).toBe("aim");
    expect(s.shooter).toBe(0);
    // Kurulurken atış alınmaz.
    expect(reduce(s, { type: "fire", now: 1000 + AIM_LOCK_MS - 1 }).phase).toBe("aim");
    s = fireAt(s, 0.43);
    expect(s.phase).toBe("shot");
    expect(s.shots[0]).toMatchObject({ side: 0, zone: "pencere", ammo: "tas" });
    expect(s.hp).toEqual([TOWER_HP, TOWER_HP - damageFor("pencere", "tas", 3)]);
    expect(dealt(s, 0)).toBe(damageFor("pencere", "tas", 3));
  });

  it("rüzgâr isabet yüksekliğini kaydırır", () => {
    let seed = 1;
    while (windFor(seed, 0) !== 3) seed++;
    let s = start({}, seed);
    s = reduce(s, { type: "answer", option: deck[0].correctIndex, now: 0 });
    s = fireAt(s, 0.43);
    // Sağa esen güçlü rüzgâr soldaki takımın taşını pencerenin üstüne, gövdeye taşır.
    expect(s.shots[0].hit).toBeCloseTo(0.43 + 3 * WIND_STEP);
    expect(s.shots[0].zone).toBe("govde");
  });

  it("zor soruyu bilen takım ateşli gülle atar", () => {
    let s = start();
    s = reduce(s, { type: "answer", option: (deck[0].correctIndex + 1) % 4, now: 0 });
    expect(s.phase).toBe("reveal");
    expect(s.misfireAt).toBe(0);
    s = reduce(s, { type: "next", now: 100 });
    expect(turnSide(s)).toBe(1);
    s = reduce(s, { type: "answer", option: deck[1].correctIndex, now: 200 });
    s = fireAt(s, 0.3);
    expect(s.shots[0]).toMatchObject({ side: 1, ammo: "ates", zone: "govde" });
    expect(s.hp[0]).toBe(TOWER_HP - damageFor("govde", "ates", 3));
  });

  it("yanlış cevapta mancınık tutukluk yapar, kimse atış yapmaz ve sıra karşı takıma geçer", () => {
    let s = start();
    s = reduce(s, { type: "answer", option: (deck[0].correctIndex + 1) % 4, now: 50 });
    expect(s.phase).toBe("reveal");
    expect(s.misfireAt).toBe(50);
    expect(s.shooter).toBeNull();
    // Açıklama ekranında atış alınmaz.
    expect(reduce(s, { type: "fire", now: 10_000 }).shots).toHaveLength(0);
    s = reduce(s, { type: "next", now: 100 });
    expect(s.phase).toBe("question");
    expect(turnSide(s)).toBe(1);
    expect(s.log).toEqual([{ questionId: deck[0].id, unit: deck[0].unit, teamId: teams[0].id, correct: false }]);
  });

  it("süre dolunca soru yanlış sayılır", () => {
    let s = start();
    expect(reduce(s, { type: "timeout", now: 29_999 }).phase).toBe("question");
    s = reduce(s, { type: "timeout", now: 30_000 });
    expect(s.outcome).toBe("timeout");
    expect(s.asked).toBe(1);
  });

  it("canı biten kule yıkılır ve oyun hemen biter", () => {
    let s = start({ rounds: 3 });
    s = { ...s, hp: [TOWER_HP, 10] };
    s = reduce(s, { type: "answer", option: deck[0].correctIndex, now: 0 });
    s = fireAt(s, 0.3);
    expect(s.phase).toBe("finished");
    expect(s.endReason).toBe("collapse");
    expect(s.winner).toBe(teams[0].id);
    expect(s.hp[1]).toBe(0);
  });

  it("turlar bitince kulesi daha sağlam olan kazanır; eşitse berabere", () => {
    let s = start({ rounds: 1 });
    s = reduce(s, { type: "answer", option: deck[0].correctIndex, now: 0 });
    s = fireAt(s, 0.2);
    s = reduce(s, { type: "next", now: 5000 });
    s = reduce(s, { type: "answer", option: (deck[1].correctIndex + 1) % 4, now: 6000 });
    s = reduce(s, { type: "next", now: 7000 });
    expect(s.phase).toBe("finished");
    expect(s.endReason).toBe("rounds");
    expect(s.winner).toBe(teams[0].id);

    let d = start({ rounds: 1 });
    d = reduce(d, { type: "answer", option: (deck[0].correctIndex + 1) % 4, now: 0 });
    d = reduce(d, { type: "next", now: 1 });
    d = reduce(d, { type: "answer", option: (deck[1].correctIndex + 1) % 4, now: 2 });
    d = reduce(d, { type: "next", now: 3 });
    expect(d.winner).toBe("draw");
  });

  it("duraklatılan süre kaldığı yerden devam eder", () => {
    let s = start();
    s = reduce(s, { type: "pause", now: 10_000 });
    expect(s.remaining).toBe(20_000);
    expect(reduce(s, { type: "answer", option: 0, now: 11_000 }).phase).toBe("question");
    s = reduce(s, { type: "resume", now: 50_000 });
    expect(s.deadline).toBe(70_000);
  });
});
