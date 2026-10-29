import { describe, expect, it } from "vitest";
import type { PlayableQuestion } from "@/core/deck";
import { defaultTeams } from "../teams";
import { createQuiz, currentTeam, EXTRA_TIME_MS, POINTS_CORRECT, POINTS_STEAL, quizReducer, standings, type QuizState } from "./logic";

const deck: PlayableQuestion[] = Array.from({ length: 10 }, (_, i) => ({
  id: `dkab-8-1-${String(i + 1).padStart(2, "0")}`,
  unit: "dkab-8-1",
  type: "multiple-choice",
  difficulty: 1,
  prompt: `Soru ${i + 1}`,
  options: ["A", "B", "C", "D"],
  correctIndex: i % 4,
  explanation: "Açıklama",
}));

const reduce = quizReducer(deck);
const teams = defaultTeams(2);
const base = (over: Partial<QuizState["settings"]> = {}) =>
  createQuiz(teams, { rounds: 2, seconds: 30, jokers: true, steal: true, ...over });

describe("Bilgi Yarışması", () => {
  it("doğru cevap sıradaki takıma puan verir ve açıklamayı gösterir", () => {
    let s = reduce(base(), { type: "start", now: 0 });
    expect(s.phase).toBe("question");
    s = reduce(s, { type: "answer", option: deck[0].correctIndex, now: 1000 });
    expect(s.phase).toBe("reveal");
    expect(s.outcome).toBe("correct");
    expect(s.scores[teams[0].id]).toBe(POINTS_CORRECT);
  });

  it("yanlış cevaptan sonra başka takım soruyu çalabilir", () => {
    let s = reduce(base(), { type: "start", now: 0 });
    s = reduce(s, { type: "answer", option: (deck[0].correctIndex + 1) % 4, now: 1000 });
    expect(s.phase).toBe("steal");
    // Sırası olan takım kendi sorusunu çalamaz.
    expect(reduce(s, { type: "steal-team", teamId: teams[0].id }).stealTeam).toBeNull();
    s = reduce(s, { type: "steal-team", teamId: teams[1].id });
    // Zaten seçilmiş yanlış şık tekrar seçilemez.
    expect(reduce(s, { type: "steal-answer", option: s.picked! }).phase).toBe("steal");
    s = reduce(s, { type: "steal-answer", option: deck[0].correctIndex });
    expect(s.outcome).toBe("stolen");
    expect(s.scores[teams[1].id]).toBe(POINTS_STEAL);
    expect(s.log.map((l) => l.correct)).toEqual([false, true]);
  });

  it("soru çalma kapalıysa yanlış cevap doğrudan açıklamaya geçer", () => {
    let s = reduce(base({ steal: false }), { type: "start", now: 0 });
    s = reduce(s, { type: "answer", option: (deck[0].correctIndex + 1) % 4, now: 1000 });
    expect(s.phase).toBe("reveal");
  });

  it("süre dolmadan zaman aşımı sayılmaz, dolunca sayılır", () => {
    let s = reduce(base(), { type: "start", now: 0 });
    expect(reduce(s, { type: "timeout", now: 29_999 }).phase).toBe("question");
    s = reduce(s, { type: "timeout", now: 30_000 });
    expect(s.outcome).toBe("timeout");
    expect(s.asked).toBe(1);
  });

  it("sıra takımlar arasında döner ve tur sayısı dolunca oyun biter", () => {
    let s = reduce(base(), { type: "start", now: 0 });
    const order: string[] = [];
    while (s.phase !== "finished") {
      order.push(currentTeam(s).id);
      s = reduce(s, { type: "answer", option: deck[s.current].correctIndex, now: 0 });
      s = reduce(s, { type: "next", now: 0 });
    }
    expect(order).toEqual([teams[0].id, teams[1].id, teams[0].id, teams[1].id]);
    expect(standings(s)[0].score).toBe(2 * POINTS_CORRECT);
  });

  it("jokerler: yarı yarıya iki yanlışı gizler, ek süre ekler, pas soruyu değiştirir; her biri bir kez", () => {
    let s = reduce(base(), { type: "start", now: 0 });
    s = reduce(s, { type: "joker", joker: "half", now: 0 });
    expect(s.hidden).toHaveLength(2);
    expect(s.hidden).not.toContain(deck[0].correctIndex);
    expect(reduce(s, { type: "answer", option: s.hidden[0], now: 0 }).phase).toBe("question");

    s = reduce(s, { type: "joker", joker: "time", now: 0 });
    expect(s.deadline).toBe(30_000 + EXTRA_TIME_MS);
    expect(reduce(s, { type: "joker", joker: "time", now: 0 }).deadline).toBe(30_000 + EXTRA_TIME_MS);

    s = reduce(s, { type: "joker", joker: "pass", now: 5_000 });
    expect(s.current).toBe(1);
    expect(s.asked).toBe(0);
    expect(currentTeam(s).id).toBe(teams[0].id);
    expect(s.jokers[teams[0].id]).toEqual({ half: false, time: false, pass: false });
  });

  it("duraklatılan süre kaldığı yerden devam eder ve duraklamada cevap alınmaz", () => {
    let s = reduce(base(), { type: "start", now: 0 });
    s = reduce(s, { type: "pause", now: 10_000 });
    expect(s.remaining).toBe(20_000);
    expect(reduce(s, { type: "answer", option: 0, now: 11_000 }).phase).toBe("question");
    s = reduce(s, { type: "resume", now: 50_000 });
    expect(s.deadline).toBe(70_000);
  });
});
