import type { PlayableQuestion } from "@/core/deck";
import type { AnswerLog, Team } from "../types";

/**
 * Bilgi Yarışması oyun mantığı.
 *
 * Saf bir reducer: durum JSON'a çevrilebilir, zaman eylemlerle (`now`) gelir.
 * Bugün tek ekranda tahta bu reducer'ı çalıştırıyor; çok cihazlı sürümde aynı
 * reducer sunucuda/öğretmen cihazında çalışır, öğrenci cihazları yalnızca eylem gönderir.
 */

export const POINTS_CORRECT = 100;
export const POINTS_STEAL = 50;
export const EXTRA_TIME_MS = 15_000;

export type JokerKind = "half" | "time" | "pass";

export type QuizSettings = {
  rounds: number;
  /** Saniye; 0 = süresiz. */
  seconds: number;
  jokers: boolean;
  steal: boolean;
};

export type Outcome = "correct" | "wrong" | "timeout" | "stolen" | "steal-failed";

export type QuizState = {
  phase: "ready" | "question" | "steal" | "reveal" | "finished";
  teams: Team[];
  settings: QuizSettings;
  /** Destede sıradaki kullanılmamış soru. Pas jokeri de bir soru tüketir. */
  cursor: number;
  /** Şu anki sorunun destedeki yeri. */
  current: number;
  asked: number;
  turn: number;
  scores: Record<string, number>;
  jokers: Record<string, Record<JokerKind, boolean>>;
  hidden: number[];
  picked: number | null;
  stealTeam: string | null;
  stealPicked: number | null;
  outcome: Outcome | null;
  /** Süre sayarken bitiş anı; duraklatılınca null olur ve kalan süre `remaining`a yazılır. */
  deadline: number | null;
  remaining: number | null;
  log: AnswerLog[];
};

export type QuizAction =
  | { type: "start"; now: number }
  | { type: "answer"; option: number; now: number }
  | { type: "timeout"; now: number }
  | { type: "joker"; joker: JokerKind; now: number }
  | { type: "steal-team"; teamId: string }
  | { type: "steal-answer"; option: number }
  | { type: "skip-steal" }
  | { type: "next"; now: number }
  | { type: "pause"; now: number }
  | { type: "resume"; now: number };

export function totalQuestions(s: QuizState): number {
  return s.settings.rounds * s.teams.length;
}

export function createQuiz(teams: Team[], settings: QuizSettings): QuizState {
  return {
    phase: "ready",
    teams,
    settings,
    cursor: 0,
    current: 0,
    asked: 0,
    turn: 0,
    scores: Object.fromEntries(teams.map((t) => [t.id, 0])),
    jokers: Object.fromEntries(teams.map((t) => [t.id, { half: settings.jokers, time: settings.jokers, pass: settings.jokers }])),
    hidden: [],
    picked: null,
    stealTeam: null,
    stealPicked: null,
    outcome: null,
    deadline: null,
    remaining: null,
    log: [],
  };
}

export function currentTeam(s: QuizState): Team {
  return s.teams[s.turn % s.teams.length];
}

function timerFrom(s: QuizState, now: number): Pick<QuizState, "deadline" | "remaining"> {
  return s.settings.seconds > 0 ? { deadline: now + s.settings.seconds * 1000, remaining: null } : { deadline: null, remaining: null };
}

function openQuestion(s: QuizState, deck: PlayableQuestion[], now: number): QuizState {
  if (s.cursor >= deck.length || s.asked >= totalQuestions(s)) return { ...s, phase: "finished", deadline: null, remaining: null };
  return {
    ...s,
    phase: "question",
    current: s.cursor,
    cursor: s.cursor + 1,
    hidden: [],
    picked: null,
    stealTeam: null,
    stealPicked: null,
    outcome: null,
    ...timerFrom(s, now),
  };
}

function afterMiss(s: QuizState, outcome: "wrong" | "timeout"): QuizState {
  const canSteal = s.settings.steal && s.teams.length > 1;
  return { ...s, phase: canSteal ? "steal" : "reveal", outcome, deadline: null, remaining: null };
}

export function quizReducer(deck: PlayableQuestion[]) {
  return function reduce(s: QuizState, a: QuizAction): QuizState {
    const q = deck[s.current];
    switch (a.type) {
      case "start":
        return s.phase === "ready" ? openQuestion(s, deck, a.now) : s;

      case "answer": {
        const paused = s.deadline === null && s.remaining !== null;
        if (s.phase !== "question" || paused) return s;
        if (s.hidden.includes(a.option) || a.option < 0 || a.option >= q.options.length) return s;
        const team = currentTeam(s);
        const correct = a.option === q.correctIndex;
        const logged: QuizState = {
          ...s,
          picked: a.option,
          asked: s.asked + 1,
          log: [...s.log, { questionId: q.id, unit: q.unit, teamId: team.id, correct }],
        };
        if (correct) {
          return {
            ...logged,
            phase: "reveal",
            outcome: "correct",
            deadline: null,
            remaining: null,
            scores: { ...s.scores, [team.id]: s.scores[team.id] + POINTS_CORRECT },
          };
        }
        return afterMiss(logged, "wrong");
      }

      case "timeout": {
        if (s.phase !== "question" || s.deadline === null || a.now < s.deadline) return s;
        const team = currentTeam(s);
        return afterMiss(
          { ...s, asked: s.asked + 1, log: [...s.log, { questionId: q.id, unit: q.unit, teamId: team.id, correct: false }] },
          "timeout",
        );
      }

      case "joker": {
        if (s.phase !== "question") return s;
        const team = currentTeam(s);
        if (!s.jokers[team.id]?.[a.joker]) return s;
        const spent = { ...s.jokers, [team.id]: { ...s.jokers[team.id], [a.joker]: false } };
        if (a.joker === "half") {
          if (q.options.length < 4 || s.hidden.length) return s;
          const wrong = q.options.map((_, i) => i).filter((i) => i !== q.correctIndex);
          // Hangi iki yanlışın gizleneceği sorunun kimliğinden türetilir: tekrar oynatınca aynı kalır.
          const offset = [...q.id].reduce((n, ch) => n + ch.charCodeAt(0), 0) % wrong.length;
          const hidden = [wrong[offset], wrong[(offset + 1) % wrong.length]];
          return { ...s, jokers: spent, hidden };
        }
        if (a.joker === "time") {
          if (s.deadline !== null) return { ...s, jokers: spent, deadline: s.deadline + EXTRA_TIME_MS };
          if (s.remaining !== null) return { ...s, jokers: spent, remaining: s.remaining + EXTRA_TIME_MS };
          return s;
        }
        // Pas: aynı takım sıradaki soruyu alır, puan değişmez, soru sayılmaz.
        if (s.cursor >= deck.length) return s;
        return openQuestion({ ...s, jokers: spent }, deck, a.now);
      }

      case "steal-team": {
        if (s.phase !== "steal" || a.teamId === currentTeam(s).id) return s;
        return { ...s, stealTeam: a.teamId };
      }

      case "steal-answer": {
        if (s.phase !== "steal" || !s.stealTeam) return s;
        if (a.option === s.picked || s.hidden.includes(a.option)) return s;
        const correct = a.option === q.correctIndex;
        return {
          ...s,
          phase: "reveal",
          stealPicked: a.option,
          outcome: correct ? "stolen" : "steal-failed",
          scores: correct ? { ...s.scores, [s.stealTeam]: s.scores[s.stealTeam] + POINTS_STEAL } : s.scores,
          log: [...s.log, { questionId: q.id, unit: q.unit, teamId: s.stealTeam, correct, stolen: true }],
        };
      }

      case "skip-steal":
        return s.phase === "steal" ? { ...s, phase: "reveal", stealTeam: null } : s;

      case "next": {
        if (s.phase !== "reveal") return s;
        return openQuestion({ ...s, turn: s.turn + 1 }, deck, a.now);
      }

      case "pause": {
        if (s.phase !== "question" || s.deadline === null) return s;
        return { ...s, deadline: null, remaining: Math.max(0, s.deadline - a.now) };
      }

      case "resume": {
        if (s.phase !== "question" || s.remaining === null) return s;
        return { ...s, deadline: a.now + s.remaining, remaining: null };
      }
    }
  };
}

export function standings(s: QuizState): { team: Team; score: number }[] {
  return s.teams.map((team) => ({ team, score: s.scores[team.id] })).sort((a, b) => b.score - a.score);
}
