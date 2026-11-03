import { describe, expect, it } from "vitest";
import type { PlayableQuestion } from "@/core/deck";
import { defaultTeams } from "../teams";
import type { Team } from "../types";
import {
  classify,
  createPenalty,
  KICK_LOCK_MS,
  keeperFor,
  kickResult,
  penaltyReducer,
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

/** Takımın soruyu bilip verilen yere şut çekmesi. */
function scoreAttempt(s: PenaltyState, side: 0 | 1, x: number, y: number, now = 0) {
  s = reduce(s, { type: "answer", side, option: right(s), now });
  return reduce(s, { type: "kick", x, y, now: now + KICK_LOCK_MS });
}

describe("Penaltı: kale ve kaleci", () => {
  it("top kalenin içinde, direkte ya da dışarıda olabilir", () => {
    expect(classify(0, 0.5)).toBe("ic");
    expect(classify(0.95, 0.9)).toBe("ic");
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

  it("kaleci topun gittiği üçlüye atlarsa yükseklik ne olursa olsun kurtarır", () => {
    expect(kickResult(-0.8, 0.9, "sol")).toBe("kurtardi");
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
    expect(reduce(s, { type: "kick", x: -0.7, y: 0.8, now: 100 + KICK_LOCK_MS - 1 }).phase).toBe("kick");
    s = reduce(s, { type: "kick", x: -0.7, y: 0.8, now: 100 + KICK_LOCK_MS });
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
    expect(reduce(t, { type: "kick", x: 0, y: 0.5, now: 99_999 }).kicks).toHaveLength(0);
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
      const keeper = keeperFor(s.seed, s.kicks.length);
      const x = keeper === "sol" ? 0.7 : -0.7;
      s = reduce(s, { type: "kick", x, y: 0.5, now: i * 10 + KICK_LOCK_MS });
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
    s = reduce(s, { type: "kick", x: keeper === "sag" ? -0.7 : 0.7, y: 0.3, now: 10 + KICK_LOCK_MS });
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
