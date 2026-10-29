import type { PlayableQuestion } from "@/core/deck";
import type { AnswerLog, Team } from "../types";

/**
 * Halat Çekme oyun mantığı.
 *
 * Tahta ikiye bölünür; iki takımdan birer öğrenci aynı anda kendi tarafındaki
 * soruyu çözer. Doğru cevap ipi kendi tarafına bir adım çeker, yanlış cevap o
 * tarafı kısa süre dondurur. İp bir tarafın çizgisine ulaşınca ya da süre bitince oyun biter.
 *
 * Saf reducer: çok cihazlı sürümde aynı mantık sunucuda çalışır.
 */

export const COUNTDOWN_MS = 3_000;
export const FREEZE_MS = 1_800;

export type TugSettings = {
  /** İpin kazanmak için çekilmesi gereken adım sayısı. */
  target: number;
  /** Saniye. */
  seconds: number;
};

export type SideState = {
  teamId: string;
  /** Destedeki soru sırası. */
  question: number;
  frozenUntil: number | null;
  /** Son cevaplanan soru; yanlışsa donma süresince doğru cevabıyla gösterilir. */
  last: { question: number; option: number; correct: boolean; at: number } | null;
  correct: number;
  wrong: number;
};

export type TugState = {
  phase: "ready" | "playing" | "finished";
  teams: [Team, Team];
  settings: TugSettings;
  /** Negatif: sol takım çekiyor, pozitif: sağ takım. */
  rope: number;
  cursor: number;
  sides: [SideState, SideState];
  startsAt: number | null;
  endsAt: number | null;
  winner: string | "draw" | null;
  log: AnswerLog[];
};

export type TugAction =
  | { type: "start"; now: number }
  | { type: "answer"; side: 0 | 1; option: number; now: number }
  | { type: "time-up"; now: number };

function side(teamId: string, question: number): SideState {
  return { teamId, question, frozenUntil: null, last: null, correct: 0, wrong: 0 };
}

export function createTug(teams: [Team, Team], settings: TugSettings): TugState {
  return {
    phase: "ready",
    teams,
    settings,
    rope: 0,
    cursor: 2,
    sides: [side(teams[0].id, 0), side(teams[1].id, 1)],
    startsAt: null,
    endsAt: null,
    winner: null,
    log: [],
  };
}

/** Deste biterse baştan dolaşır; iki taraf hiçbir zaman aynı soruyu aynı anda görmez. */
function draw(cursor: number, deckLength: number, otherSideQuestion: number): { question: number; cursor: number } {
  let next = cursor % deckLength;
  if (deckLength > 1 && next === otherSideQuestion % deckLength) next = (next + 1) % deckLength;
  return { question: next, cursor: next + 1 };
}

export function decideWinner(s: TugState): string | "draw" {
  if (s.rope < 0) return s.teams[0].id;
  if (s.rope > 0) return s.teams[1].id;
  const [a, b] = s.sides;
  if (a.correct !== b.correct) return a.correct > b.correct ? a.teamId : b.teamId;
  return "draw";
}

export function tugReducer(deck: PlayableQuestion[]) {
  return function reduce(s: TugState, a: TugAction): TugState {
    switch (a.type) {
      case "start": {
        if (s.phase !== "ready") return s;
        const startsAt = a.now + COUNTDOWN_MS;
        return { ...s, phase: "playing", startsAt, endsAt: startsAt + s.settings.seconds * 1000 };
      }

      case "answer": {
        if (s.phase !== "playing" || s.startsAt === null || a.now < s.startsAt) return s;
        const me = s.sides[a.side];
        if (me.frozenUntil !== null && a.now < me.frozenUntil) return s;
        const q = deck[me.question % deck.length];
        if (a.option < 0 || a.option >= q.options.length) return s;

        const correct = a.option === q.correctIndex;
        const other = s.sides[a.side === 0 ? 1 : 0];
        const next = draw(s.cursor, deck.length, other.question);
        const updated: SideState = {
          ...me,
          question: next.question,
          frozenUntil: correct ? null : a.now + FREEZE_MS,
          last: { question: me.question, option: a.option, correct, at: a.now },
          correct: me.correct + (correct ? 1 : 0),
          wrong: me.wrong + (correct ? 0 : 1),
        };
        const sides: [SideState, SideState] = a.side === 0 ? [updated, s.sides[1]] : [s.sides[0], updated];
        const rope = correct ? s.rope + (a.side === 0 ? -1 : 1) : s.rope;
        const log = [...s.log, { questionId: q.id, unit: q.unit, teamId: me.teamId, correct }];
        const won = Math.abs(rope) >= s.settings.target;
        const nextState: TugState = { ...s, sides, rope, cursor: next.cursor, log };
        return won ? { ...nextState, phase: "finished", winner: decideWinner(nextState) } : nextState;
      }

      case "time-up": {
        if (s.phase !== "playing" || s.endsAt === null || a.now < s.endsAt) return s;
        return { ...s, phase: "finished", winner: decideWinner(s) };
      }
    }
  };
}

