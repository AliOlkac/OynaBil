import { describe, expect, it } from "vitest";
import type { PlayableQuestion } from "@/core/deck";
import { defaultTeams } from "../teams";
import type { Team } from "../types";
import { powerTime } from "./bot";
import {
  classify,
  createPenalty,
  KICK_LOCK_MS,
  keeperFor,
  KEEPER_REACH,
  keeperReaches,
  kickResult,
  penaltyReducer,
  BALL_X,
  BALL_Y,
  BAR_BAND,
  goalKind,
  postIn,
  POST_BAND,
  POWER_LOCK_MS,
  POWER_PERIOD_MS,
  POWER_SWEET,
  powerAt,
  powerZone,
  shotFrom,
  weakReach,
  SUDDEN_DEATH_MAX,
  thirdOf,
  type PenaltySettings,
  type PenaltyState,
  type Third,
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
const reduce = penaltyReducer(deck);
const right = (s: PenaltyState) => deck[s.current].correctIndex;
const wrong = (s: PenaltyState, k = 1) => (deck[s.current].correctIndex + k) % 4;
const start = (over: Partial<PenaltySettings> = {}, seed = 11) => reduce(createPenalty(teams, { questions: 4, seconds: 20, ...over }, seed), { type: "start", now: 0 });

/** Kalecinin `keeper` yönüne atlayacağı bir tohum bulur (ilk şut için). */
function seedWithKeeper(keeper: Third) {
  for (let seed = 1; seed < 1000; seed++) if (keeperFor(seed, 0) === keeper) return seed;
  throw new Error("tohum yok");
}

/** Atış hakkı kazanılmışken verilen yere isabetli güçle şut. */
function scoreKick(s: PenaltyState, x: number, y: number, now = 0) {
  s = reduce(s, { type: "aim", x, y, now: now + KICK_LOCK_MS });
  return reduce(s, { type: "kick", now: now + KICK_LOCK_MS + powerTime(POWER_SWEET) });
}

/** Takımın soruyu bilip verilen yere şut çekmesi. */
function scoreAttempt(s: PenaltyState, side: 0 | 1, x: number, y: number, now = 0) {
  s = reduce(s, { type: "answer", side, option: right(s), now });
  s = reduce(s, { type: "aim", x, y, now: now + KICK_LOCK_MS });
  return reduce(s, { type: "kick", now: now + KICK_LOCK_MS + powerTime(POWER_SWEET) });
}

describe("Penaltı: kale ve kaleci", () => {
  it("top kalenin içinde, direkte ya da dışarıda olabilir", () => {
    expect(classify(0, 0.5)).toBe("ic");
    expect(classify(0.85, 0.8)).toBe("ic");
    // Direğe çok yakın top direğe çarpar.
    expect(classify(0.95, 0.5)).toBe("direk");
    expect(classify(0.5, 0.9)).toBe("direk");
    expect(classify(1.0, 0.5)).toBe("direk");
    expect(classify(0.2, 1.0)).toBe("direk");
    expect(classify(1.2, 0.5)).toBe("aut");
    expect(classify(0, 1.3)).toBe("aut");
  });

  it("kale üçe bölünür; kaleci her yöne yaklaşık üçte bir atlar", () => {
    expect(thirdOf(-0.8)).toBe("sol");
    expect(thirdOf(0.1)).toBe("orta");
    expect(thirdOf(0.6)).toBe("sag");
    const counts = { sol: 0, orta: 0, sag: 0 };
    for (let i = 0; i < 3000; i++) counts[keeperFor(99, i)]++;
    for (const n of Object.values(counts)) expect(Math.abs(n - 1000)).toBeLessThan(120);
    expect(keeperFor(5, 3)).toBe(keeperFor(5, 3));
  });

  it("kaleci topun gittiği üçlüye atlarsa kurtarır; doksana isabetli şuta yetişemez", () => {
    expect(kickResult(-0.8, 0.6, "sol")).toBe("kurtardi");
    expect(kickResult(-0.8, 0.8, "sol")).toBe("gol");
    expect(kickResult(-0.8, 0.8, "sol", weakReach(0.3))).toBe("kurtardi");
    expect(kickResult(-0.5, 0.8, "sol")).toBe("kurtardi");
    expect(kickResult(-0.8, 0.05, "sol")).toBe("kurtardi");
    expect(kickResult(-0.8, 0.5, "sag")).toBe("gol");
    expect(kickResult(1.0, 0.5, "orta")).toBe("direk");
    expect(kickResult(0, 1.4, "orta")).toBe("aut");
  });
});

describe("Penaltı: oyun akışı", () => {
  it("ilk bilen takım şut çeker; kaleci yanlış köşeye atlarsa gol olur", () => {
    let s = start({}, seedWithKeeper("sag"));
    s = reduce(s, { type: "answer", side: 1, option: right(s), now: 100 });
    expect(s.phase).toBe("kick");
    expect(s.shooter).toBe(1);
    // Oyuncu topun başına gelmeden şut alınmaz.
    expect(reduce(s, { type: "aim", x: -0.7, y: 0.8, now: 100 + KICK_LOCK_MS - 1 }).aim).toBeNull();
    s = reduce(s, { type: "aim", x: -0.7, y: 0.8, now: 100 + KICK_LOCK_MS });
    // Güç çubuğu beklerken vuruş alınmaz.
    expect(reduce(s, { type: "kick", now: 100 + KICK_LOCK_MS + POWER_LOCK_MS - 1 }).phase).toBe("kick");
    s = reduce(s, { type: "kick", now: 100 + KICK_LOCK_MS + powerTime(POWER_SWEET) });
    expect(s.phase).toBe("result");
    expect(s.kicks[0]).toMatchObject({ side: 1, third: "sol", keeper: "sag", result: "gol" });
    expect(s.goals).toEqual([0, 1]);
  });

  it("kaleci doğru köşeye atlarsa kurtarır, gol sayılmaz", () => {
    let s = start({}, seedWithKeeper("orta"));
    s = scoreAttempt(s, 0, 0.1, 0.2);
    expect(s.kicks[0].result).toBe("kurtardi");
    expect(s.goals).toEqual([0, 0]);
  });

  it("yanlış cevap veren bekler; öteki takım bilirse o çeker, ikisi de bilemezse kimse çekmez", () => {
    let s = start();
    s = reduce(s, { type: "answer", side: 0, option: wrong(s), now: 10 });
    expect(s.phase).toBe("question");
    expect(s.duel.locked).toEqual([true, false]);
    s = reduce(s, { type: "answer", side: 1, option: right(s), now: 20 });
    expect(s.shooter).toBe(1);

    let t = start();
    t = reduce(t, { type: "answer", side: 0, option: wrong(t, 1), now: 10 });
    t = reduce(t, { type: "answer", side: 1, option: wrong(t, 2), now: 20 });
    expect(t.phase).toBe("reveal");
    expect(reduce(t, { type: "aim", x: 0, y: 0.5, now: 99_999 }).aim).toBeNull();
    t = reduce(t, { type: "next", now: 30 });
    expect(t.phase).toBe("question");
    expect(t.asked).toBe(2);
  });

  it("süre dolunca iki takım da bilemedi sayılır", () => {
    let s = start();
    s = reduce(s, { type: "timeout", now: 20_000 });
    expect(s.phase).toBe("reveal");
    expect(s.outcome).toBe("timeout");
    expect(s.log).toHaveLength(2);
  });

  it("geride kalan takım farkı kapatamayacaksa oyun erken biter", () => {
    let s = start({ questions: 3 });
    // Soru 1 ve 2: mavi iki gol atar (kaleci hep başka köşede olsun diye şutlar kaleciden uzağa).
    for (let i = 0; i < 2; i++) {
      s = reduce(s, { type: "answer", side: 0, option: right(s), now: i * 10 });
      const keeper = keeperFor(
        s.seed,
        s.kicks.length,
        s.kicks.filter((k) => k.side === 0).map((k) => k.third),
      );
      const x = keeper === "sol" ? 0.85 : -0.85;
      s = scoreKick(s, x, 0.5, i * 10);
      s = reduce(s, { type: "next", now: i * 10 + 5000 });
    }
    expect(s.goals).toEqual([2, 0]);
    expect(s.phase).toBe("finished");
    expect(s.winner).toBe(teams[0].id);
  });

  it("eşitlikte seri penaltı başlar; ilk gol oyunu bitirir", () => {
    let s = start({ questions: 1 });
    s = reduce(s, { type: "answer", side: 0, option: wrong(s, 1), now: 0 });
    s = reduce(s, { type: "answer", side: 1, option: wrong(s, 2), now: 1 });
    s = reduce(s, { type: "next", now: 2 });
    expect(s.suddenDeath).toBe(true);
    expect(s.phase).toBe("question");
    s = reduce(s, { type: "answer", side: 1, option: right(s), now: 10 });
    const keeper = keeperFor(s.seed, s.kicks.length);
    s = scoreKick(s, keeper === "sag" ? -0.8 : 0.8, 0.3, 10);
    expect(s.phase).toBe("finished");
    expect(s.winner).toBe(teams[1].id);
  });

  it("seri penaltıda da gol olmazsa sınırda berabere biter", () => {
    let s = start({ questions: 1 });
    for (let i = 0; i < SUDDEN_DEATH_MAX + 1; i++) {
      s = reduce(s, { type: "answer", side: 0, option: wrong(s, 1), now: i });
      s = reduce(s, { type: "answer", side: 1, option: wrong(s, 2), now: i });
      s = reduce(s, { type: "next", now: i });
    }
    expect(s.phase).toBe("finished");
    expect(s.winner).toBe("draw");
  });
});

describe("Penaltı: güç ve direk", () => {
  it("güç çubuğu inip çıkar; yer oyun mantığıyla aynı fonksiyondan gelir", () => {
    expect(powerAt(0)).toBe(0);
    expect(powerAt(powerTime(0.5))).toBeCloseTo(0.5);
    expect(powerAt(POWER_LOCK_MS + POWER_PERIOD_MS / 2)).toBeCloseTo(1);
    expect(powerZone(0.3)).toBe("zayif");
    expect(powerZone(POWER_SWEET)).toBe("isabetli");
    expect(powerZone(0.95)).toBe("sert");
  });

  it("isabetli vuruş nişana gider; sert vuruş yükselip dışa açılır", () => {
    expect(shotFrom({ x: 0.6, y: 0.5 }, POWER_SWEET)).toEqual({ x: 0.6, y: 0.5 });
    const hard = shotFrom({ x: 0.6, y: 0.5 }, 1);
    expect(hard.y).toBeGreaterThan(1);
    expect(hard.x).toBeGreaterThan(0.6);
    expect(kickResult(hard.x, hard.y, "sol")).not.toBe("gol");
  });

  it("zayıf vuruşa kaleci uzanır: başka yöne atlasa da yetişir", () => {
    expect(kickResult(0.85, 0.4, "orta")).toBe("gol");
    expect(kickResult(0.85, 0.4, "orta", weakReach(0.2))).toBe("kurtardi");
    expect(weakReach(POWER_SWEET)).toBe(0);
    expect(weakReach(0.1)).toBeGreaterThan(weakReach(0.45));
  });

  it("direğe çok yakın şut direğe çarpar ve sahne için direğin çizgisine çekilir", () => {
    expect(classify(1 - BALL_X - POST_BAND / 2, 0.5)).toBe("direk");
    expect(classify(0.8, 1 - BALL_Y - BAR_BAND / 2)).toBe("direk");
    expect(classify(0.8, 0.6)).toBe("ic");
    let s = start({}, seedWithKeeper("sol"));
    s = reduce(s, { type: "answer", side: 0, option: right(s), now: 0 });
    s = scoreKick(s, 1.01, 0.5);
    expect(s.kicks[0]).toMatchObject({ result: "direk", x: 1 });
  });

  it("direğe değen topun yarıdan çoğu içerideyse direkten gol olur", () => {
    const x = 1 - BALL_X - POST_BAND / 2;
    expect(postIn(x, 0.5)).toBe(true);
    expect(postIn(1.01, 0.5)).toBe(false);
    expect(postIn(0.5, 1 - BALL_Y - BAR_BAND / 2)).toBe(true);
    expect(kickResult(x, 0.5, "orta")).toBe("gol");
    let s = start({}, seedWithKeeper("sol"));
    s = reduce(s, { type: "answer", side: 0, option: right(s), now: 0 });
    s = scoreKick(s, x, 0.5);
    expect(s.kicks[0]).toMatchObject({ result: "gol", post: true, x: 1 - BALL_X });
    expect(goalKind(s.kicks[0])).toBe("direkten");
    expect(goalKind({ result: "gol", x: 0.8, y: 0.8 })).toBe("doksan");
    expect(goalKind({ result: "gol", x: 0.3, y: 0.3 })).toBeNull();
  });
});

describe("Penaltı: akıllı kaleci", () => {
  it("atladığı üçlünün yakınındaki topa da uzanır, uzağına uzanamaz", () => {
    expect(keeperReaches(1 / 3 + KEEPER_REACH - 0.01, "orta")).toBe(true);
    expect(keeperReaches(1 / 3 + KEEPER_REACH + 0.01, "orta")).toBe(false);
    expect(kickResult(0.2, 0.5, "sag")).toBe("kurtardi");
    expect(kickResult(0.05, 0.5, "sag")).toBe("gol");
    expect(kickResult(0.86, 0.5, "orta")).toBe("gol");
  });

  it("hep aynı köşeye vuran takımı bekler; yön değiştireni bekleyemez", () => {
    const count = (habits: ("sol" | "orta" | "sag")[]) => {
      let n = 0;
      for (let i = 0; i < 3000; i++) if (keeperFor(77, i, habits) === "sag") n++;
      return n / 3000;
    };
    expect(count([])).toBeGreaterThan(0.28);
    expect(count([])).toBeLessThan(0.39);
    expect(count(["sag"])).toBeGreaterThan(0.45);
    expect(count(["sag", "sag", "sag"])).toBeGreaterThan(0.65);
    expect(count(["sol", "orta", "sag"])).toBeLessThan(0.4);
    // Yalnızca son dört şut hatırlanır.
    expect(count(["sag", "sag", "sag", "sol", "sol", "sol", "sol"])).toBeLessThan(0.25);
  });
});
