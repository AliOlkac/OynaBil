import type { PlayableQuestion } from "@/core/deck";
import { byDifficulty, difficultyOf, type Difficulty } from "../shared/difficulty";
import { duelAnswer, freshDuel, type Duel } from "../shared/duel";
import type { AnswerLog, Team } from "../types";

/**
 * Penaltı oyun mantığı.
 *
 * İki takıma aynı soru sorulur (düello sorusu). İlk doğru cevaplayan takımın oyuncusu penaltıyı çeker;
 * yanlış cevap veren takım bekler, iki takım da bilemezse kimse çekmez. Şutçu parmağıyla topu
 * kalenin istediği yerine sürükler. Kaleci bilgisayardır ve takımın alışkanlığını okur: önceki şutların
 * gittiği yöne atlama olasılığı artar. Atladığı üçlüdeki ve sınırına yakın topları kurtarır; yükseklik
 * fark etmez. Gol atmanın yolu yön değiştirmek ve kalecinin uzanamayacağı yere vurmaktır.
 *
 * Sorular bitince çok gol atan kazanır; eşitlikte seri penaltıya geçilir, ilk golü atan kazanır.
 * Saf reducer: zaman eylemle gelir, kalecinin seçimi oyun tohumundan türetilir.
 */

/** Oyuncu topun başına gelirken şut alınmaz; çift dokunuşla yanlışlıkla şut da olmaz. */
export const KICK_LOCK_MS = 1_100;
/** Seri penaltıda en fazla bu kadar soru sorulur; yine eşitse berabere biter. */
export const SUDDEN_DEATH_MAX = 6;
/**
 * Kale koordinatında topun yarıçapı. x: -1 sol direk, +1 sağ direk (şutçunun bakışıyla);
 * y: 0 zemin, 1 üst direk. Kale 3'e 1 oranındadır.
 */
export const BALL_X = 0.045;
export const BALL_Y = 0.067;
/**
 * Şutun sapması (kale genişliğinin yarısı cinsinden yarıçap): kolayda top tam nişana gider; normal ve
 * zorda nişan halkasının içinde bir yere sapar. Köşeye çok yakın nişan direğe ya da auta gidebilir.
 */
export const SCATTER = [0, 0.09, 0.15] as const;

export type Third = "sol" | "orta" | "sag";
export type KickResult = "gol" | "kurtardi" | "direk" | "aut";

export const THIRD_LABEL: Record<Third, string> = { sol: "sol", orta: "orta", sag: "sağ" };

export type PenaltySettings = {
  /** Oyundaki soru sayısı; her soruda en fazla bir penaltı çekilir. */
  questions: number;
  /** Soru süresi (saniye); 0 süresiz. */
  seconds: number;
  /** 1 kolay, 2 normal, 3 zor (bkz. shared/difficulty). */
  difficulty?: number;
};

export type Kick = {
  side: 0 | 1;
  /** Topun gittiği nokta (kale koordinatı): nişan + sapma. */
  x: number;
  y: number;
  /** Şutçunun nişan aldığı nokta (eski kayıtlarda yok). */
  aimX?: number;
  aimY?: number;
  third: Third;
  keeper: Third;
  result: KickResult;
  at: number;
  questionId: string;
};

export type PenaltyState = {
  phase: "ready" | "question" | "kick" | "result" | "reveal" | "finished";
  teams: [Team, Team];
  settings: PenaltySettings;
  seed: number;
  cursor: number;
  current: number;
  /** Açılan soru sayısı (seri penaltı soruları dahil). */
  asked: number;
  duel: Duel;
  outcome: "correct" | "wrong" | "timeout" | null;
  shooter: 0 | 1 | null;
  kickStart: number | null;
  deadline: number | null;
  remaining: number | null;
  goals: [number, number];
  kicks: Kick[];
  /** Seri penaltı: ilk golü atan kazanır. */
  suddenDeath: boolean;
  suddenAsked: number;
  winner: string | "draw" | null;
  log: AnswerLog[];
};

export type PenaltyAction =
  | { type: "start"; now: number }
  | { type: "answer"; side: 0 | 1; option: number; now: number }
  | { type: "timeout"; now: number }
  | { type: "kick"; x: number; y: number; now: number }
  | { type: "next"; now: number }
  | { type: "pause"; now: number }
  | { type: "resume"; now: number };

// ---- saf yardımcılar (sahne de kullanır) ----

/** Topun kaleye göre yeri: içeride, direğe ya da üst direğe değiyor, dışarıda. */
export function classify(x: number, y: number): "ic" | "direk" | "aut" {
  if (y < 0) return "aut";
  if (Math.abs(x) <= 1 - BALL_X && y <= 1 - BALL_Y) return "ic";
  if (Math.abs(x) <= 1 + BALL_X && y <= 1 + BALL_Y) return "direk";
  return "aut";
}

export function thirdOf(x: number): Third {
  return x < -1 / 3 ? "sol" : x > 1 / 3 ? "sag" : "orta";
}

/** Kaleci atladığı üçlünün sınırından bu kadar ötedeki topa da uzanır (kale yarı genişliği cinsinden). */
export const KEEPER_REACH = 0.2;
/** Kaleci, şutu çeken takımın son bu kadar şutunu aklında tutar. */
export const KEEPER_MEMORY = 4;
/** Hatırlanan her şut, o yöne atlama ağırlığını bu kadar artırır (başlangıç ağırlığı 1). */
export const KEEPER_HABIT = 1.2;

const THIRDS = ["sol", "orta", "sag"] as const;
const ZONE: Record<Third, [number, number]> = { sol: [-1, -1 / 3], orta: [-1 / 3, 1 / 3], sag: [1 / 3, 1] };

/**
 * Kalecinin atlayacağı yer: oyun tohumu ve şutun sırasından türetilir. Kaleci şutu çeken takımın
 * alışkanlığını okur: `habits` o takımın son şutlarının gittiği yönlerdir ve o yönlerin olasılığı artar.
 * Hep aynı köşeye vuran takımın şutunu kaleci çoğu zaman bekler; alışkanlık yokken üç yön eşit olasılıklıdır.
 */
export function keeperFor(seed: number, kickIndex: number, habits: readonly Third[] = []): Third {
  let h = (seed ^ Math.imul(kickIndex + 7, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  const recent = habits.slice(-KEEPER_MEMORY);
  if (recent.length === 0) return THIRDS[h % 3];
  const weights = THIRDS.map((t) => 1 + KEEPER_HABIT * recent.filter((r) => r === t).length);
  let roll = (h / 0x100000000) * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < 3; i++) {
    roll -= weights[i];
    if (roll < 0) return THIRDS[i];
  }
  return "sag";
}

/** Kaleci topa yetişir mi: top atladığı üçlüdeyse ya da sınırına `KEEPER_REACH` kadar yakınsa. */
export function keeperReaches(x: number, keeper: Third): boolean {
  const [from, to] = ZONE[keeper];
  return x >= from - KEEPER_REACH && x <= to + KEEPER_REACH;
}

/**
 * Şutun sapması: oyun tohumu ve şutun sırasından türetilir, halkanın içinde düzgün dağılır. Kale 3'e 1
 * olduğu için dikeyde y birimi 1.5 katıdır; sapma metre olarak dairedir.
 */
export function scatterFor(seed: number, kickIndex: number, d: Difficulty): { dx: number; dy: number } {
  const r = byDifficulty(d, SCATTER);
  if (r === 0) return { dx: 0, dy: 0 };
  let h = (seed ^ Math.imul(kickIndex + 101, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  const a = ((h & 0xffff) / 0x10000) * Math.PI * 2;
  const k = Math.sqrt((h >>> 16) / 0x10000) * r;
  return { dx: Math.cos(a) * k, dy: Math.sin(a) * k * 1.5 };
}

export function kickResult(x: number, y: number, keeper: Third): KickResult {
  const place = classify(x, y);
  if (place !== "ic") return place;
  return keeperReaches(x, keeper) ? "kurtardi" : "gol";
}

export function createPenalty(teams: [Team, Team], settings: PenaltySettings, seed: number): PenaltyState {
  return {
    phase: "ready",
    teams,
    settings,
    seed,
    cursor: 0,
    current: 0,
    asked: 0,
    duel: freshDuel(),
    outcome: null,
    shooter: null,
    kickStart: null,
    deadline: null,
    remaining: null,
    goals: [0, 0],
    kicks: [],
    suddenDeath: false,
    suddenAsked: 0,
    winner: null,
    log: [],
  };
}

function finish(s: PenaltyState): PenaltyState {
  const [a, b] = s.goals;
  const winner = a === b ? "draw" : a > b ? s.teams[0].id : s.teams[1].id;
  return { ...s, phase: "finished", winner, deadline: null, remaining: null, shooter: null, kickStart: null };
}

function openQuestion(s: PenaltyState, deck: PlayableQuestion[], now: number): PenaltyState {
  let next = s;
  if (!next.suddenDeath) {
    const left = next.settings.questions - next.asked;
    const gap = Math.abs(next.goals[0] - next.goals[1]);
    // Geride kalan takım kalan sorularla farkı kapatamıyorsa oyun biter.
    if (gap > left) return finish(next);
    if (left <= 0) {
      if (gap > 0) return finish(next);
      next = { ...next, suddenDeath: true };
    }
  }
  if (next.suddenDeath && next.suddenAsked >= SUDDEN_DEATH_MAX) return finish(next);
  if (next.cursor >= deck.length) return finish(next);
  return {
    ...next,
    phase: "question",
    current: next.cursor,
    cursor: next.cursor + 1,
    asked: next.asked + 1,
    suddenAsked: next.suddenAsked + (next.suddenDeath ? 1 : 0),
    duel: freshDuel(),
    outcome: null,
    shooter: null,
    kickStart: null,
    deadline: next.settings.seconds > 0 ? now + next.settings.seconds * 1000 : null,
    remaining: null,
  };
}

export function penaltyReducer(deck: PlayableQuestion[]) {
  return function reduce(s: PenaltyState, a: PenaltyAction): PenaltyState {
    const q = deck[s.current];

    switch (a.type) {
      case "start":
        return s.phase === "ready" ? openQuestion(s, deck, a.now) : s;

      case "answer": {
        const paused = s.deadline === null && s.remaining !== null;
        if (s.phase !== "question" || paused || !q) return s;
        if (a.option < 0 || a.option >= q.options.length) return s;
        const { duel, result } = duelAnswer(s.duel, a.side, a.option, q.correctIndex);
        if (result === "ignored") return s;
        const log = [...s.log, { questionId: q.id, unit: q.unit, teamId: s.teams[a.side].id, correct: result === "won" }];
        if (result === "won") return { ...s, duel, log, phase: "kick", outcome: "correct", shooter: a.side, kickStart: a.now, deadline: null, remaining: null };
        if (result === "locked") return { ...s, duel, log };
        return { ...s, duel, log, phase: "reveal", outcome: "wrong", deadline: null, remaining: null };
      }

      case "timeout": {
        if (s.phase !== "question" || s.deadline === null || a.now < s.deadline || !q) return s;
        const silent = ([0, 1] as const).filter((side) => !s.duel.locked[side]);
        const log = [...s.log, ...silent.map((side) => ({ questionId: q.id, unit: q.unit, teamId: s.teams[side].id, correct: false }))];
        return { ...s, phase: "reveal", outcome: "timeout", log, deadline: null, remaining: null };
      }

      case "kick": {
        if (s.phase !== "kick" || s.shooter === null || s.kickStart === null) return s;
        if (a.now - s.kickStart < KICK_LOCK_MS) return s;
        if (!Number.isFinite(a.x) || !Number.isFinite(a.y)) return s;
        // Kaleci bu takımın önceki şutlarını hatırlar.
        const habits = s.kicks.filter((k) => k.side === s.shooter).map((k) => k.third);
        const keeper = keeperFor(s.seed, s.kicks.length, habits);
        const { dx, dy } = scatterFor(s.seed, s.kicks.length, difficultyOf(s.settings, 1));
        const x = a.x + dx;
        const y = a.y + dy;
        const result = kickResult(x, y, keeper);
        const kick: Kick = { side: s.shooter, x, y, aimX: a.x, aimY: a.y, third: thirdOf(x), keeper, result, at: a.now, questionId: q?.id ?? "" };
        const goals = [...s.goals] as [number, number];
        if (result === "gol") goals[s.shooter] += 1;
        const next: PenaltyState = { ...s, phase: "result", goals, kicks: [...s.kicks, kick], kickStart: null };
        // Seri penaltıda ilk gol oyunu bitirir.
        if (s.suddenDeath && result === "gol") return { ...next, phase: "finished", winner: s.teams[s.shooter].id };
        return next;
      }

      case "next":
        if (s.phase !== "result" && s.phase !== "reveal") return s;
        return openQuestion(s, deck, a.now);

      case "pause":
        if (s.phase !== "question" || s.deadline === null) return s;
        return { ...s, deadline: null, remaining: Math.max(0, s.deadline - a.now) };

      case "resume":
        if (s.phase !== "question" || s.remaining === null) return s;
        return { ...s, deadline: a.now + s.remaining, remaining: null };
    }
  };
}
