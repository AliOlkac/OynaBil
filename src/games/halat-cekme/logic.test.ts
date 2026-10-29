import { describe, expect, it } from "vitest";
import type { PlayableQuestion } from "@/core/deck";
import { defaultTeams } from "../teams";
import { COUNTDOWN_MS, createTug, FREEZE_MS, tugReducer, type TugState } from "./logic";

const deck: PlayableQuestion[] = Array.from({ length: 6 }, (_, i) => ({
  id: `dkab-7-2-${String(i + 1).padStart(2, "0")}`,
  unit: "dkab-7-2",
  type: "true-false",
  difficulty: 1,
  prompt: `İfade ${i + 1}`,
  options: ["Doğru", "Yanlış"],
  correctIndex: i % 2,
  explanation: "Açıklama",
}));

const reduce = tugReducer(deck);
const [left, right] = defaultTeams(2);
const start = () => reduce(createTug([left, right], { target: 3, seconds: 120 }), { type: "start", now: 0 });
const t0 = COUNTDOWN_MS;
const correctFor = (s: TugState, side: 0 | 1) => deck[s.sides[side].question % deck.length].correctIndex;

describe("Halat Çekme", () => {
  it("geri sayım bitmeden cevap alınmaz", () => {
    const s = start();
    expect(reduce(s, { type: "answer", side: 0, option: 0, now: t0 - 1 })).toBe(s);
  });

  it("iki taraf farklı sorular görür ve doğru cevap ipi o tarafa çeker", () => {
    let s = start();
    expect(s.sides[0].question).not.toBe(s.sides[1].question);
    s = reduce(s, { type: "answer", side: 0, option: correctFor(s, 0), now: t0 });
    expect(s.rope).toBe(-1);
    s = reduce(s, { type: "answer", side: 1, option: correctFor(s, 1), now: t0 });
    expect(s.rope).toBe(0);
    expect(s.sides[0].question).not.toBe(s.sides[1].question);
  });

  it("yanlış cevap o tarafı kısa süre dondurur, ipi oynatmaz", () => {
    let s = start();
    const wrong = 1 - correctFor(s, 1);
    s = reduce(s, { type: "answer", side: 1, option: wrong, now: t0 });
    expect(s.rope).toBe(0);
    expect(s.sides[1].frozenUntil).toBe(t0 + FREEZE_MS);
    const frozen = reduce(s, { type: "answer", side: 1, option: correctFor(s, 1), now: t0 + 100 });
    expect(frozen).toBe(s);
    s = reduce(s, { type: "answer", side: 1, option: correctFor(s, 1), now: t0 + FREEZE_MS });
    expect(s.rope).toBe(1);
  });

  it("ip hedef çizgiye ulaşınca o takım kazanır", () => {
    let s = start();
    for (let i = 0; i < 3; i++) s = reduce(s, { type: "answer", side: 1, option: correctFor(s, 1), now: t0 + i });
    expect(s.phase).toBe("finished");
    expect(s.winner).toBe(right.id);
  });

  it("süre bitince ipin bulunduğu taraf, eşitlikte doğru sayısı kazanır", () => {
    let s = start();
    s = reduce(s, { type: "answer", side: 0, option: correctFor(s, 0), now: t0 });
    s = reduce(s, { type: "answer", side: 1, option: correctFor(s, 1), now: t0 });
    s = reduce(s, { type: "answer", side: 1, option: 1 - correctFor(s, 1), now: t0 });
    expect(reduce(s, { type: "time-up", now: t0 + 1000 }).phase).toBe("playing");
    const end = reduce(s, { type: "time-up", now: t0 + 120_000 });
    expect(end.winner).toBe("draw");
    s = reduce(s, { type: "answer", side: 0, option: correctFor(s, 0), now: t0 + 10 });
    expect(reduce(s, { type: "time-up", now: t0 + 120_000 }).winner).toBe(left.id);
  });
});
