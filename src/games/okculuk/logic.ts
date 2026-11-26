import { hashSeed } from "@/core/cards";
import type { PlayableQuestion } from "@/core/deck";
import { byDifficulty, difficultyOf, type Difficulty } from "../shared/difficulty";
import { duelAnswer, freshDuel, type Duel } from "../shared/duel";
import type { AnswerLog, Team } from "../types";

/**
 * Okçuluk oyun mantığı.
 *
 * İki takıma aynı soru sorulur (düello sorusu). İlk doğru cevaplayan takım ok atma hakkı kazanır.
 * Okçu yayı parmakla gerer: sahneye basıp tutunca yay `DRAW_MS` içinde tam gerilir ve nişangâh hedefin
 * üstünde gezinmeye başlar; nişangâh doğru yere gelince bırakır, ok oraya gider. Yay tam gerilmeden
 * bırakılırsa ok düşük gider; yay uzun tutuldukça kol yorulur, nişangâh daha geniş savrulur. Her atışta rüzgâr eser: ok rüzgârın estiği yana kayar. Rüzgâr ekranda okla ve
 * şiddetiyle gösterilir; iyi okçu nişanı rüzgârın tersine kaydırır. Puan, okun saplandığı halkadır: ortadaki
 * sarı 10, en dıştaki beyaz 1; hedefi bulmayan ok 0.
 *
 * Sorular bitince çok puan toplayan kazanır. Eşitlikte uzatmaya geçilir: soruyu bilen atar, sarıyı ya da
 * kırmızıyı (7 ve üstü) vuran kazanır. Saf reducer: zaman eylemle gelir.
 */

/** Doğru cevaptan sonra okçu yayı gerer; bu sürede ok bırakılamaz (çift dokunuş). */
export const AIM_LOCK_MS = 900;
/** Uzatmada en fazla bu kadar soru sorulur; yine eşitse berabere biter. */
export const OVERTIME_MAX = 6;
/** Uzatmada oyunu bitiren en düşük puan (kırmızı halka). */
export const OVERTIME_WIN = 7;
/** Bir rüzgâr kademesinin oku kaydırdığı mesafe (hedef yarıçapı 1, kolay zorlukta). Her halka 0.1 geniştir. */
export const WIND_STEP = 0.11;
/** Zorluğa göre: nişangâh sallantısının hızı (kolaya göre kat) ve rüzgâr kademesinin etkisi. */
export const SIGHT_SPEED = [1, 1.3, 1.6] as const;
/** Yayın tam gerilme süresi (basılı tutulan süre). */
export const DRAW_MS = 700;
/** Yarım gerilmiş yayda okun düşmesi (gerilmeyen her birim için, hedef yarıçapı cinsinden). */
export const WEAK_DROP = 1.1;
/** Yay bu kadar tutulduktan sonra kol yorulur; nişangâhın savrulması saniyede `FATIGUE` kadar büyür. */
export const STEADY_MS = 2_500;
export const FATIGUE = 0.3;
export const FATIGUE_MAX = 1.8;
export const WIND_STEPS = [WIND_STEP, 0.13, 0.15] as const;
/** Hedefin saman tabanı yüzden biraz geniştir: bu yarıçapa kadar ok tabana saplanır (0 puan). */
export const BOSS_R = 1.28;

export type Wind = -3 | -2 | -1 | 0 | 1 | 2 | 3;
export type ShotResult = "onluk" | "dokuz" | "iyi" | "orta" | "kotu" | "iska";

export type ArcherySettings = {
  /** Oyundaki soru sayısı; her soruda en fazla bir atış yapılır. */
  questions: number;
  /** Soru süresi (saniye); 0 süresiz. */
  seconds: number;
  /** 1 kolay, 2 normal, 3 zor (bkz. shared/difficulty). */
  difficulty?: number;
};

export type Point = { x: number; y: number };

export type Shot = {
  side: 0 | 1;
  /** Ok bırakıldığında nişangâhın yeri (hedef yarıçapı 1, +x sağ, +y yukarı). */
  aim: Point;
  wind: Wind;
  /** Okun saplandığı yer: nişangâh + rüzgâr. */
  hit: Point;
  points: number;
  /** Skora eklenen puan: uzatmada 7'nin altında kalan ok skoru değiştirmez (0). */
  scored: number;
  result: ShotResult;
  at: number;
  questionId: string;
};

export type ArcheryState = {
  phase: "ready" | "question" | "aim" | "result" | "reveal" | "finished";
  teams: [Team, Team];
  settings: ArcherySettings;
  cursor: number;
  current: number;
  /** Açılan soru sayısı (uzatma soruları dahil). */
  asked: number;
  duel: Duel;
  outcome: "correct" | "wrong" | "timeout" | null;
  shooter: 0 | 1 | null;
  aimStart: number | null;
  /** Bu sorudaki rüzgâr; soru açılınca belirlenir, herkes görür. */
  wind: Wind;
  deadline: number | null;
  remaining: number | null;
  score: [number, number];
  shots: Shot[];
  overtime: boolean;
  overtimeAsked: number;
  winner: string | "draw" | null;
  log: AnswerLog[];
};

export type ArcheryAction =
  | { type: "start"; now: number }
  | { type: "answer"; side: 0 | 1; option: number; now: number }
  | { type: "timeout"; now: number }
  /** Ok bırakıldı: yayın gerilmeye başladığı an ve bırakıldığı an. */
  | { type: "shoot"; drawAt: number; now: number }
  | { type: "next"; now: number }
  | { type: "pause"; now: number }
  | { type: "resume"; now: number };

// ---- saf yardımcılar (sahne ve ekran da kullanır) ----

/** Yayın gerilmesi (0..1): basılı tutulan süreden. */
export const drawOf = (heldMs: number) => Math.min(1, Math.max(0, heldMs / DRAW_MS));

/** Kolun yorgunluğu: nişangâhın savrulmasını büyüten kat (1: dinç). */
export function fatigueOf(heldMs: number): number {
  return Math.min(FATIGUE_MAX, 1 + FATIGUE * (Math.max(0, heldMs - STEADY_MS) / 1000));
}

/**
 * Nişangâhın yeri: yay gerilmeye başladığından beri hedefin üstünde sarkaç gibi sağa sola salınır, hafifçe
 * de iner kalkar. Her salınımda merkezden ve rüzgâr payı kadar yanlardan geçer; doğru an kollanır.
 * Yay uzun tutulunca kol yorulur, salınım büyür.
 */
export function sightAt(heldMs: number, d: Difficulty = 1): Point {
  const t = (Math.max(0, heldMs) / 1000) * byDifficulty(d, SIGHT_SPEED);
  const k = fatigueOf(heldMs);
  const swing = 0.55 + 0.1 * Math.sin(t * 0.85 + 1.2);
  const bob = 0.9 * Math.sin(t * 0.37);
  return { x: swing * k * Math.sin(t * 2.2), y: 0.16 * k * Math.sin(t * 4.4 + bob) };
}

/** Bırakıldığı anda okun nişanı: nişangâhın yeri; yay tam gerilmediyse ok düşer. */
export function releaseAim(heldMs: number, d: Difficulty = 1): Point {
  const p = sightAt(heldMs, d);
  return { x: p.x, y: p.y - (1 - drawOf(heldMs)) * WEAK_DROP };
}

/** Okun saplandığı yer: rüzgâr oku kendi yönüne kaydırır. */
export function hitPoint(aim: Point, wind: Wind, d: Difficulty = 1): Point {
  return { x: aim.x + wind * byDifficulty(d, WIND_STEPS), y: aim.y };
}

/** Halka puanı: merkezden her 0.1 uzaklaşmada bir puan düşer; yüzün dışı 0. */
export function ringOf(hit: Point): number {
  const r = Math.hypot(hit.x, hit.y);
  if (r >= 1) return 0;
  return 10 - Math.floor(r * 10);
}

export function resultOf(points: number): ShotResult {
  if (points === 10) return "onluk";
  if (points === 9) return "dokuz";
  if (points >= 7) return "iyi";
  if (points >= 4) return "orta";
  if (points >= 1) return "kotu";
  return "iska";
}

/** Sorunun rüzgârı soru kimliğinden ve sırasından türetilir: aynı oyun yeniden yüklenince değişmez. */
export function windFor(questionId: string, asked: number): Wind {
  const h = hashSeed(`${questionId}:${asked}`);
  // Sakin hava daha sık: 0 ve ±1 olasılığı yüksek, ±3 seyrek.
  const table = [0, 0, 1, 1, 2, 2, 3, 1] as const;
  const level = table[h % table.length];
  return ((h >> 3) % 2 === 0 ? level : -level) as Wind;
}

export function createArchery(teams: [Team, Team], settings: ArcherySettings): ArcheryState {
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
    wind: 0,
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

function finish(s: ArcheryState): ArcheryState {
  const [a, b] = s.score;
  const winner = a === b ? "draw" : a > b ? s.teams[0].id : s.teams[1].id;
  return { ...s, phase: "finished", winner, deadline: null, remaining: null, shooter: null, aimStart: null };
}

function openQuestion(s: ArcheryState, deck: PlayableQuestion[], now: number): ArcheryState {
  let next = s;
  if (!next.overtime) {
    const left = next.settings.questions - next.asked;
    const gap = Math.abs(next.score[0] - next.score[1]);
    // Geride kalan takım kalan oklarla (her biri en çok 10 puan) farkı kapatamıyorsa oyun biter.
    if (gap > left * 10) return finish(next);
    if (left <= 0) {
      if (gap > 0) return finish(next);
      next = { ...next, overtime: true };
    }
  }
  if (next.overtime && next.overtimeAsked >= OVERTIME_MAX) return finish(next);
  if (next.cursor >= deck.length) return finish(next);
  const q = deck[next.cursor];
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
    wind: windFor(q.id, next.asked),
    deadline: next.settings.seconds > 0 ? now + next.settings.seconds * 1000 : null,
    remaining: null,
  };
}

export function archeryReducer(deck: PlayableQuestion[]) {
  return function reduce(s: ArcheryState, a: ArcheryAction): ArcheryState {
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
        if (result === "won") return { ...s, duel, log, phase: "aim", outcome: "correct", shooter: a.side, aimStart: a.now, deadline: null, remaining: null };
        if (result === "locked") return { ...s, duel, log };
        return { ...s, duel, log, phase: "reveal", outcome: "wrong", deadline: null, remaining: null };
      }

      case "timeout": {
        if (s.phase !== "question" || s.deadline === null || a.now < s.deadline || !q) return s;
        const silent = ([0, 1] as const).filter((side) => !s.duel.locked[side]);
        const log = [...s.log, ...silent.map((side) => ({ questionId: q.id, unit: q.unit, teamId: s.teams[side].id, correct: false }))];
        return { ...s, phase: "reveal", outcome: "timeout", log, deadline: null, remaining: null };
      }

      case "shoot": {
        if (s.phase !== "aim" || s.shooter === null || s.aimStart === null) return s;
        // Yay ancak atış hakkı kazanılıp okçu hazırlanınca gerilebilir.
        if (!Number.isFinite(a.drawAt) || a.drawAt - s.aimStart < AIM_LOCK_MS || a.drawAt > a.now) return s;
        const d = difficultyOf(s.settings);
        const aim = releaseAim(a.now - a.drawAt, d);
        const hit = hitPoint(aim, s.wind, d);
        const points = ringOf(hit);
        // Uzatmada yalnızca kazandıran atış sayılır; kısa kalan ok skoru değiştirmez, eşitlik sürer.
        const scored = !s.overtime || points >= OVERTIME_WIN ? points : 0;
        const shot: Shot = { side: s.shooter, aim, wind: s.wind, hit, points, scored, result: resultOf(points), at: a.now, questionId: q?.id ?? "" };
        const score = [...s.score] as [number, number];
        score[s.shooter] += scored;
        const next: ArcheryState = { ...s, phase: "result", score, shots: [...s.shots, shot], aimStart: null };
        // Uzatmada kırmızıyı ya da sarıyı vuran oyunu bitirir.
        if (s.overtime && points >= OVERTIME_WIN) return { ...next, phase: "finished", winner: s.teams[s.shooter].id };
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
