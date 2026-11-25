import { describe, expect, it } from "vitest";
import type { PlayableQuestion } from "@/core/deck";
import { defaultTeams } from "../teams";
import type { Team } from "../types";
import {
  AIM_LOCK_MS,
  archeryReducer,
  createArchery,
  hitPoint,
  OVERTIME_MAX,
  resultOf,
  ringOf,
  sightAt,
  WIND_STEP,
  windFor,
  type ArcherySettings,
  type ArcheryState,
} from "./logic";

const deck: PlayableQuestion[] = Array.from({ length: 30 }, (_, i) => ({
  id: `dkab-8-1-${String(i + 1).padStart(2, "0")}`,
  unit: "dkab-8-1",
  type: "multiple-choice",
  difficulty: 2,
  prompt: `Soru ${i + 1}`,
  options: ["A", "B", "C", "D"],
  correctIndex: i % 4,
  explanation: "Açıklama",
}));

const teams = defaultTeams(2) as [Team, Team];
const reduce = archeryReducer(deck);
const right = (s: ArcheryState) => deck[s.current].correctIndex;
const wrong = (s: ArcheryState, k = 1) => (deck[s.current].correctIndex + k) % 4;
const start = (over: Partial<ArcherySettings> = {}) => reduce(createArchery(teams, { questions: 4, seconds: 20, difficulty: 1, ...over }), { type: "start", now: 0 });
const next = (s: ArcheryState, now = 0) => reduce(s, { type: "next", now });

/** Nişangâhın verilen noktaya en yakın geçtiği an (kilitten sonraki ilk 12 saniyede). */
function momentNear(target: { x: number; y: number }) {
  let best = { t: AIM_LOCK_MS, d: Infinity };
  for (let t = AIM_LOCK_MS; t < AIM_LOCK_MS + 12_000; t += 5) {
    const p = sightAt(t);
    const d = Math.hypot(p.x - target.x, p.y - target.y);
    if (d < best.d) best = { t, d };
  }
  return best;
}

/** Takımın soruyu bilip nişangâh `target` noktasına en yakınken oku bırakması. */
function attempt(s: ArcheryState, side: 0 | 1, target = { x: 0, y: 0 }, now = 0) {
  s = reduce(s, { type: "answer", side, option: right(s), now });
  // Rüzgâr payı: nişan rüzgârın tersine kaydırılır.
  const aimAt = { x: target.x - s.wind * WIND_STEP, y: target.y };
  return reduce(s, { type: "shoot", now: now + momentNear(aimAt).t });
}

describe("Okçuluk: nişan, rüzgâr ve puan", () => {
  it("halkalar merkezden dışa 10'dan 1'e iner, yüzün dışı 0'dır", () => {
    expect(ringOf({ x: 0, y: 0 })).toBe(10);
    expect(ringOf({ x: 0.05, y: 0.05 })).toBe(10);
    expect(ringOf({ x: 0.15, y: 0 })).toBe(9);
    expect(ringOf({ x: 0, y: -0.55 })).toBe(5);
    expect(ringOf({ x: 0.95, y: 0 })).toBe(1);
    expect(ringOf({ x: 0.8, y: 0.7 })).toBe(0);
    expect([10, 9, 8, 7, 5, 2, 0].map(resultOf)).toEqual(["onluk", "dokuz", "iyi", "iyi", "orta", "kotu", "iska"]);
  });

  it("rüzgâr oku estiği yana kaydırır", () => {
    expect(hitPoint({ x: 0, y: 0.1 }, 2)).toEqual({ x: 2 * WIND_STEP, y: 0.1 });
    expect(hitPoint({ x: 0, y: 0 }, -3).x).toBeCloseTo(-3 * WIND_STEP);
  });

  it("nişangâh hedefin içinde kalır ve merkezden geçer", () => {
    for (let t = 0; t < 30_000; t += 37) {
      const p = sightAt(t);
      expect(Math.hypot(p.x, p.y)).toBeLessThan(1.05);
    }
    expect(momentNear({ x: 0, y: 0 }).d).toBeLessThan(0.03);
    // Rüzgâr payı verilebilsin diye kenarlara da yarım halka yakınından geçer.
    expect(momentNear({ x: 0.33, y: 0 }).d).toBeLessThan(0.06);
    expect(momentNear({ x: -0.33, y: 0 }).d).toBeLessThan(0.06);
  });

  it("rüzgâr soruya bağlıdır ve sakin hava daha sıktır", () => {
    expect(windFor("a", 1)).toBe(windFor("a", 1));
    const winds = deck.map((q, i) => windFor(q.id, i));
    expect(new Set(winds).size).toBeGreaterThan(3);
    expect(winds.filter((w) => Math.abs(w) <= 1).length).toBeGreaterThan(winds.filter((w) => Math.abs(w) === 3).length);
  });
});

describe("Okçuluk: oyun akışı", () => {
  it("ilk doğru cevaplayan ok atar; kilit dolmadan ok bırakılamaz", () => {
    let s = start();
    s = reduce(s, { type: "answer", side: 1, option: right(s), now: 100 });
    expect(s.phase).toBe("aim");
    expect(s.shooter).toBe(1);
    expect(reduce(s, { type: "shoot", now: 100 + AIM_LOCK_MS - 1 })).toBe(s);
    s = reduce(s, { type: "shoot", now: 100 + AIM_LOCK_MS + 2_000 });
    expect(s.phase).toBe("result");
    expect(s.shots).toHaveLength(1);
    expect(s.score[1]).toBe(s.shots[0].points);
  });

  it("rüzgâr payını veren okçu ortayı vurur", () => {
    let s = start();
    s = attempt(s, 0);
    expect(s.shots[0].points).toBe(10);
    expect(s.score).toEqual([10, 0]);
  });

  it("iki takım da bilemezse atış olmaz", () => {
    let s = start();
    s = reduce(s, { type: "answer", side: 0, option: wrong(s), now: 0 });
    expect(s.phase).toBe("question");
    s = reduce(s, { type: "answer", side: 1, option: wrong(s, 2), now: 0 });
    expect(s.phase).toBe("reveal");
    expect(s.shots).toHaveLength(0);
  });

  it("süre dolunca cevap vermeyenler yanlış sayılır", () => {
    let s = start({ seconds: 10 });
    s = reduce(s, { type: "timeout", now: 10_000 });
    expect(s.phase).toBe("reveal");
    expect(s.log.filter((l) => !l.correct)).toHaveLength(2);
  });

  it("fark kalan oklarla kapanamıyorsa oyun erken biter", () => {
    let s = start({ questions: 3 });
    s = next(attempt(s, 0));
    // 10 puan fark, kalan iki okla kapanabilir.
    expect(s.phase).toBe("question");
    s = next(attempt(s, 0));
    // 20 puan fark, kalan tek okla kapanamaz.
    expect(s.phase).toBe("finished");
    expect(s.winner).toBe(teams[0].id);
  });

  it("eşitlikte uzatma: 7'nin altı skoru değiştirmez, 7 ve üstü kazandırır", () => {
    let s = start({ questions: 2 });
    s = next(attempt(s, 0));
    s = next(attempt(s, 1));
    expect(s.overtime).toBe(true);
    expect(s.phase).toBe("question");
    // Kısa kalan ok: nişan 0.55 dışarıda, 5 civarı.
    s = attempt(s, 0, { x: 0, y: 0.55 });
    expect(s.shots.at(-1)!.points).toBeLessThan(7);
    expect(s.score).toEqual([10, 10]);
    s = next(s);
    s = attempt(s, 1);
    expect(s.phase).toBe("finished");
    expect(s.winner).toBe(teams[1].id);
  });

  it("uzatmada kimse kazanamazsa berabere biter", () => {
    let s = start({ questions: 2 });
    s = next(attempt(s, 0));
    s = next(attempt(s, 1));
    for (let i = 0; i < OVERTIME_MAX; i++) {
      s = reduce(s, { type: "answer", side: 0, option: wrong(s), now: 0 });
      s = next(reduce(s, { type: "answer", side: 1, option: wrong(s, 2), now: 0 }));
    }
    expect(s.phase).toBe("finished");
    expect(s.winner).toBe("draw");
  });

  it("süre durdurulup sürdürülebilir", () => {
    let s = start({ seconds: 10 });
    s = reduce(s, { type: "pause", now: 4_000 });
    expect(s.remaining).toBe(6_000);
    expect(reduce(s, { type: "answer", side: 0, option: right(s), now: 4_500 })).toBe(s);
    s = reduce(s, { type: "resume", now: 9_000 });
    expect(s.deadline).toBe(15_000);
  });
});

describe("Okçuluk: zorluk", () => {
  it("normal ve zorda nişangâh daha hızlı gezinir, rüzgâr daha sert iter", () => {
    const at = AIM_LOCK_MS + 1_000;
    expect(sightAt(at, 2)).toEqual(sightAt(AIM_LOCK_MS + 1_300, 1));
    expect(sightAt(at, 3)).toEqual(sightAt(AIM_LOCK_MS + 1_600, 1));
    expect(hitPoint({ x: 0, y: 0 }, 2, 3).x).toBeGreaterThan(hitPoint({ x: 0, y: 0 }, 2, 1).x);
  });

  it("oyun ayardaki zorlukla oynanır; ayar yoksa zor oynanır", () => {
    const t = 100 + AIM_LOCK_MS + 2_000;
    const shoot = (difficulty?: number) => {
      let s = reduce(createArchery(teams, { questions: 4, seconds: 20, ...(difficulty === undefined ? {} : { difficulty }) }), { type: "start", now: 0 });
      s = reduce(s, { type: "answer", side: 0, option: right(s), now: 100 });
      return reduce(s, { type: "shoot", now: t }).shots[0];
    };
    expect(shoot().aim).toEqual(sightAt(t - 100, 3));
    expect(shoot(1).aim).toEqual(sightAt(t - 100, 1));
  });
});
