import type { PlayableQuestion } from "@/core/deck";
import { byDifficulty, difficultyOf, type Difficulty } from "../shared/difficulty";
import { duelAnswer, freshDuel, type Duel } from "../shared/duel";
import type { AnswerLog, Team } from "../types";

/**
 * Basketbol oyun mantığı.
 *
 * İki takıma aynı soru sorulur (düello sorusu). İlk doğru cevaplayan takım atış hakkı kazanır ve
 * atışın mesafesini seçer: yakından 2 sayı ya da üç sayı çizgisinin dışından 3 sayı. Ardından topu
 * sapan gibi geri çeker: çekişin uzunluğu gücü, yönü açıyı verir. Top gerçek bir yay çizer; çemberin
 * ortasına inen tertemiz basket, kenarına inen çemberden içeri, biraz dışı çemberden dönen top, çok kısası
 * havaya giden, çok uzunu panyadan seken toptur. Dik inen top daha kolay girer. Üst üste iki basket atan
 * takımın eli "ateş alır": sıradaki atışında isabet penceresi genişler.
 *
 * Sorular bitince çok sayı atan kazanır; eşitlikte uzatmaya geçilir, ilk basketi atan kazanır.
 * Saf reducer: zaman eylemle gelir.
 */

/** Doğru cevaptan sonra oyuncu topu alır; bu sürede mesafe seçilemez (çift dokunuş). */
export const AIM_LOCK_MS = 700;
/** Mesafe seçildikten sonra oyuncu atış noktasına geçer; bu sürede atış alınmaz. */
export const METER_LOCK_MS = 500;
/** Uzatmada en fazla bu kadar soru sorulur; yine eşitse berabere biter. */
export const OVERTIME_MAX = 6;

export type Range = 2 | 3;
export type ShotResult = "temiz" | "cember" | "kacti-on" | "kacti-arka" | "kisa" | "panya";

export const RESULT_MADE: Record<ShotResult, boolean> = { temiz: true, cember: true, "kacti-on": false, "kacti-arka": false, kisa: false, panya: false };

/** Ateşli elde isabet penceresi bu kadar genişler. */
export const FIRE_BONUS = 1.4;
/** Zorluğa göre (kolay, normal, zor) isabet penceresinin genişliği, kolaya göre kat. */
export const ZONE_SCALE = [1, 0.8, 0.65] as const;

/**
 * Atışın fiziği (metre, saniye). Top şutçunun başının üstünden çıkar, çember 2,75 m yükseklikte ve
 * atış noktasından `DIST` kadar ileridedir. Top, çember yüksekliğine inerken çemberin ortasına ne kadar
 * yakınsa o kadar iyi: tam ortası tertemiz, kenarı çemberden içeri, biraz dışı çemberden döner.
 */
export const GRAVITY = 9.8;
export const RELEASE_H = 2.17;
export const HOOP_H = 2.75;
export const DIST: Record<Range, number> = { 2: 3.68, 3: 6.43 };
/** Çıkış hızı (m/sn): çekiş gücü 0 iken ve 1 iken. */
export const SPEED = { min: 3.5, max: 10.5 } as const;
export const ANGLE = { min: (25 * Math.PI) / 180, max: (75 * Math.PI) / 180 } as const;
/** İsabet pencereleri (kolay zorlukta; çemberin ortasından metre): tertemiz, çemberden içeri, çemberden döner. */
export const WINDOW = { temiz: 0.22, cember: 0.45, kacti: 0.9 } as const;
/** Yolun gösterilen kısmı (çembere olan mesafenin oranı): gerisini oyuncu kestirir. */
export const PREVIEW = 0.45;
/** Bu kadar çekilmeden bırakılan top atılmaz (yanlış dokunuş). */
export const MIN_PULL = 0.12;

/** Atışın çekilişi: açı (radyan, yataydan yukarı) ve güç (0..1). */
export type Launch = { angle: number; power: number };

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
  /** Atışın çekilişi (eski kayıtlarda yok). */
  launch?: Launch;
  /** Topun çember yüksekliğine indiğinde çemberin ortasından uzaklığı (metre; eksi kısa). */
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
  | { type: "shoot"; launch: Launch; now: number }
  | { type: "next"; now: number }
  | { type: "pause"; now: number }
  | { type: "resume"; now: number };

// ---- saf yardımcılar (sahne ve ekran da kullanır) ----

export const clampLaunch = (l: Launch): Launch => ({
  angle: Math.min(ANGLE.max, Math.max(ANGLE.min, l.angle)),
  power: Math.min(1, Math.max(0, l.power)),
});

export function velocityOf(launch: Launch): { vx: number; vy: number } {
  const l = clampLaunch(launch);
  const v = SPEED.min + (SPEED.max - SPEED.min) * l.power;
  return { vx: v * Math.cos(l.angle), vy: v * Math.sin(l.angle) };
}

/** Topun, çembere olan yatay mesafenin `frac` oranındaki yüksekliği (metre). */
export function ballHeight(launch: Launch, range: Range, frac: number): number {
  const { vx, vy } = velocityOf(launch);
  const t = (frac * DIST[range]) / vx;
  return RELEASE_H + vy * t - (GRAVITY / 2) * t * t;
}

/**
 * Top çember yüksekliğine inerken nerede: çemberin ortasından uzaklık (metre; eksi kısa, artı uzun) ve
 * iniş açısı. Top çember yüksekliğine hiç çıkmıyorsa `null`.
 */
export function rimPass(launch: Launch, range: Range): { miss: number; entry: number } | null {
  const { vx, vy } = velocityOf(launch);
  const disc = vy * vy - 2 * GRAVITY * (HOOP_H - RELEASE_H);
  if (disc < 0) return null;
  const t = (vy + Math.sqrt(disc)) / GRAVITY;
  return { miss: vx * t - DIST[range], entry: Math.atan2(GRAVITY * t - vy, vx) };
}

/** Takımın son iki atışı basketse eli ateş almıştır. */
export function onFire(shots: Shot[], side: 0 | 1): boolean {
  const own = shots.filter((s) => s.side === side);
  return own.length >= 2 && own.slice(-2).every((s) => RESULT_MADE[s.result]);
}

/** İsabet penceresinin ölçeği: dik inen top çembere daha kolay girer, yatık inen zor. */
export function windowScale(entry: number, fire: boolean, d: Difficulty = 1): number {
  const steep = Math.min(1.15, Math.max(0.5, Math.sin(entry) / Math.sin(Math.PI / 4)));
  return steep * (fire ? FIRE_BONUS : 1) * byDifficulty(d, ZONE_SCALE);
}

/** Atışın sonucu topun çembere göre geçtiği yerden çıkar. */
export function shotResult(launch: Launch, range: Range, fire = false, level: Difficulty = 1): { result: ShotResult; miss: number } {
  const pass = rimPass(launch, range);
  if (!pass) return { result: "kisa", miss: -DIST[range] };
  const k = windowScale(pass.entry, fire, level);
  const a = Math.abs(pass.miss);
  const result: ShotResult =
    a <= WINDOW.temiz * k ? "temiz" : a <= WINDOW.cember * k ? "cember" : a <= WINDOW.kacti * k ? (pass.miss < 0 ? "kacti-on" : "kacti-arka") : pass.miss < 0 ? "kisa" : "panya";
  return { result, miss: pass.miss };
}

/** Verilen açıyla topu çemberin ortasına (`target` kadar kayık) indiren güç; ulaşılamıyorsa en yakını. */
export function powerFor(angle: number, range: Range, target = 0): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    const pass = rimPass({ angle, power: mid }, range);
    if (!pass || pass.miss < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
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
        if (a.now - s.meterStart < METER_LOCK_MS) return s;
        const fire = onFire(s.shots, s.shooter);
        if (!Number.isFinite(a.launch?.angle) || !Number.isFinite(a.launch?.power) || a.launch.power < MIN_PULL) return s;
        const launch = clampLaunch(a.launch);
        const { result, miss } = shotResult(launch, s.range, fire, difficultyOf(s.settings));
        const points = RESULT_MADE[result] ? s.range : 0;
        const shot: Shot = { side: s.shooter, range: s.range, launch, power: miss, onFire: fire, result, points, at: a.now, questionId: q?.id ?? "" };
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
