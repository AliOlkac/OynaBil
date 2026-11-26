import type { PlayableQuestion } from "@/core/deck";
import { byDifficulty, difficultyOf, type Difficulty } from "../shared/difficulty";
import { duelAnswer, freshDuel, type Duel } from "../shared/duel";
import type { AnswerLog, Team } from "../types";

/**
 * Basketbol oyun mantığı.
 *
 * İki takıma aynı soru sorulur (düello sorusu). İlk doğru cevaplayan takım atış hakkı kazanır ve
 * atışın mesafesini seçer: yakından 2 sayı ya da üç sayı çizgisinin dışından 3 sayı. Ardından topa
 * basılı tutar: şutçu çömelip güç toplar, güç çubuğu dolar (sonra geri iner); çubuk yeşil bölgedeyken
 * bırakır. Yeşilin ortası tertemiz basket,
 * kenarı çemberden içeri, biraz dışı çemberden dönen top, çok dışı havaya giden ya da panyadan seken
 * toptur. Üçlükte yeşil bölge daha dar, çubuk daha hızlıdır. Üst üste iki basket atan takımın eli
 * "ateş alır": sıradaki atışında yeşil bölge genişler.
 *
 * Sorular bitince çok sayı atan kazanır; eşitlikte uzatmaya geçilir, ilk basketi atan kazanır.
 * Saf reducer: zaman eylemle gelir.
 */

/** Doğru cevaptan sonra oyuncu topu alır; bu sürede mesafe seçilemez (çift dokunuş). */
export const AIM_LOCK_MS = 700;
/** Mesafe seçildikten sonra şutçu atış noktasına geçer; bu sürede topa basılamaz. */
export const METER_LOCK_MS = 500;
/** Uzatmada en fazla bu kadar soru sorulur; yine eşitse berabere biter. */
export const OVERTIME_MAX = 6;

export type Range = 2 | 3;
export type ShotResult = "temiz" | "cember" | "kacti-on" | "kacti-arka" | "kisa" | "panya";

export const RESULT_MADE: Record<ShotResult, boolean> = { temiz: true, cember: true, "kacti-on": false, "kacti-arka": false, kisa: false, panya: false };

/** Güç çubuğunun bir aşağı-yukarı turu (ms). Üçlükte çubuk daha hızlı gider. */
export const METER_PERIOD: Record<Range, number> = { 2: 1_900, 3: 1_450 };
/** Yeşil bölgenin ortası ve yarı genişliği (güç ölçeğinde, 0..1). */
export const SWEET = 0.72;
export const ZONE_HALF: Record<Range, number> = { 2: 0.1, 3: 0.065 };
/** Ateşli elde yeşil bölge bu kadar genişler. */
export const FIRE_BONUS = 1.4;
/** Zorluğa göre (kolay, normal, zor): çubuğun hızı ve yeşil bölgenin genişliği, kolaya göre kat. */
export const METER_SPEED = [1, 1.2, 1.4] as const;
export const ZONE_SCALE = [1, 0.8, 0.65] as const;

export type BasketSettings = {
  /** Oyundaki soru sayısı; her soruda en fazla bir atış yapılır. */
  questions: number;
  /** Soru süresi (saniye); 0 süresiz. */
  seconds: number;
  /** 1 kolay, 2 normal, 3 zor (bkz. shared/difficulty). */
  difficulty?: number;
};

export type Shot = {
  side: 0 | 1;
  range: Range;
  /** Atış anında güç çubuğunun yeri (0..1). */
  power: number;
  onFire: boolean;
  result: ShotResult;
  points: number;
  at: number;
  questionId: string;
};

export type BasketState = {
  phase: "ready" | "question" | "aim" | "result" | "reveal" | "finished";
  teams: [Team, Team];
  settings: BasketSettings;
  cursor: number;
  current: number;
  /** Açılan soru sayısı (uzatma soruları dahil). */
  asked: number;
  duel: Duel;
  outcome: "correct" | "wrong" | "timeout" | null;
  shooter: 0 | 1 | null;
  aimStart: number | null;
  range: Range | null;
  meterStart: number | null;
  deadline: number | null;
  remaining: number | null;
  score: [number, number];
  shots: Shot[];
  overtime: boolean;
  overtimeAsked: number;
  winner: string | "draw" | null;
  log: AnswerLog[];
};

export type BasketAction =
  | { type: "start"; now: number }
  | { type: "answer"; side: 0 | 1; option: number; now: number }
  | { type: "timeout"; now: number }
  | { type: "range"; range: Range; now: number }
  /** Top bırakıldı: basılı tutmanın başladığı an ve bırakıldığı an. */
  | { type: "shoot"; pressAt: number; now: number }
  | { type: "next"; now: number }
  | { type: "pause"; now: number }
  | { type: "resume"; now: number };

// ---- saf yardımcılar (sahne ve ekran da kullanır) ----

/**
 * Güç çubuğunun yeri: topa basılı tutulduğu sürece 0'dan 1'e dolar, sonra geri iner (bir tur `METER_PERIOD`).
 * Bırakıldığı andaki yer atışın gücüdür.
 */
export function meterAt(heldMs: number, range: Range, d: Difficulty = 1): number {
  const t = Math.max(0, heldMs);
  const period = METER_PERIOD[range] / byDifficulty(d, METER_SPEED);
  const f = (t % period) / period;
  return f < 0.5 ? f * 2 : 2 - f * 2;
}

/** Takımın son iki atışı basketse eli ateş almıştır. */
export function onFire(shots: Shot[], side: 0 | 1): boolean {
  const own = shots.filter((s) => s.side === side);
  return own.length >= 2 && own.slice(-2).every((s) => RESULT_MADE[s.result]);
}

export function zoneHalf(range: Range, fire: boolean, d: Difficulty = 1): number {
  return ZONE_HALF[range] * (fire ? FIRE_BONUS : 1) * byDifficulty(d, ZONE_SCALE);
}

/** Atışın sonucu güç çubuğunun yerinden çıkar: yeşilin ortası tertemiz, kenarı çemberden içeri. */
export function shotResult(power: number, range: Range, fire = false, level: Difficulty = 1): ShotResult {
  const w = zoneHalf(range, fire, level);
  const d = power - SWEET;
  const a = Math.abs(d);
  if (a <= w * 0.4) return "temiz";
  if (a <= w) return "cember";
  if (a <= w * 1.9) return d < 0 ? "kacti-on" : "kacti-arka";
  return d < 0 ? "kisa" : "panya";
}

export function createBasket(teams: [Team, Team], settings: BasketSettings): BasketState {
  return {
    phase: "ready",
    teams,
    settings,
    cursor: 0,
    current: 0,
    asked: 0,
    duel: freshDuel(),
    outcome: null,
    shooter: null,
    aimStart: null,
    range: null,
    meterStart: null,
    deadline: null,
    remaining: null,
    score: [0, 0],
    shots: [],
    overtime: false,
    overtimeAsked: 0,
    winner: null,
    log: [],
  };
}

function finish(s: BasketState): BasketState {
  const [a, b] = s.score;
  const winner = a === b ? "draw" : a > b ? s.teams[0].id : s.teams[1].id;
  return { ...s, phase: "finished", winner, deadline: null, remaining: null, shooter: null, aimStart: null, range: null, meterStart: null };
}

function openQuestion(s: BasketState, deck: PlayableQuestion[], now: number): BasketState {
  let next = s;
  if (!next.overtime) {
    const left = next.settings.questions - next.asked;
    const gap = Math.abs(next.score[0] - next.score[1]);
    // Geride kalan takım kalan sorularla (her biri en çok 3 sayı) farkı kapatamıyorsa oyun biter.
    if (gap > left * 3) return finish(next);
    if (left <= 0) {
      if (gap > 0) return finish(next);
      next = { ...next, overtime: true };
    }
  }
  if (next.overtime && next.overtimeAsked >= OVERTIME_MAX) return finish(next);
  if (next.cursor >= deck.length) return finish(next);
  return {
    ...next,
    phase: "question",
    current: next.cursor,
    cursor: next.cursor + 1,
    asked: next.asked + 1,
    overtimeAsked: next.overtimeAsked + (next.overtime ? 1 : 0),
    duel: freshDuel(),
    outcome: null,
    shooter: null,
    aimStart: null,
    range: null,
    meterStart: null,
    deadline: next.settings.seconds > 0 ? now + next.settings.seconds * 1000 : null,
    remaining: null,
  };
}

export function basketReducer(deck: PlayableQuestion[]) {
  return function reduce(s: BasketState, a: BasketAction): BasketState {
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
        if (result === "won") return { ...s, duel, log, phase: "aim", outcome: "correct", shooter: a.side, aimStart: a.now, range: null, meterStart: null, deadline: null, remaining: null };
        if (result === "locked") return { ...s, duel, log };
        return { ...s, duel, log, phase: "reveal", outcome: "wrong", deadline: null, remaining: null };
      }

      case "timeout": {
        if (s.phase !== "question" || s.deadline === null || a.now < s.deadline || !q) return s;
        const silent = ([0, 1] as const).filter((side) => !s.duel.locked[side]);
        const log = [...s.log, ...silent.map((side) => ({ questionId: q.id, unit: q.unit, teamId: s.teams[side].id, correct: false }))];
        return { ...s, phase: "reveal", outcome: "timeout", log, deadline: null, remaining: null };
      }

      case "range": {
        if (s.phase !== "aim" || s.aimStart === null || s.range !== null) return s;
        if (a.now - s.aimStart < AIM_LOCK_MS) return s;
        if (a.range !== 2 && a.range !== 3) return s;
        return { ...s, range: a.range, meterStart: a.now };
      }

      case "shoot": {
        if (s.phase !== "aim" || s.shooter === null || s.range === null || s.meterStart === null) return s;
        // Topa ancak şutçu atış noktasına geçince basılabilir.
        if (!Number.isFinite(a.pressAt) || a.pressAt - s.meterStart < METER_LOCK_MS || a.pressAt > a.now) return s;
        const fire = onFire(s.shots, s.shooter);
        const d = difficultyOf(s.settings);
        const power = meterAt(a.now - a.pressAt, s.range, d);
        const result = shotResult(power, s.range, fire, d);
        const points = RESULT_MADE[result] ? s.range : 0;
        const shot: Shot = { side: s.shooter, range: s.range, power, onFire: fire, result, points, at: a.now, questionId: q?.id ?? "" };
        const score = [...s.score] as [number, number];
        score[s.shooter] += points;
        const next: BasketState = { ...s, phase: "result", score, shots: [...s.shots, shot], aimStart: null, meterStart: null };
        // Uzatmada ilk basket oyunu bitirir.
        if (s.overtime && points > 0) return { ...next, phase: "finished", winner: s.teams[s.shooter].id };
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
