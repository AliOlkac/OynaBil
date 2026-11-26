import type { PlayableQuestion } from "@/core/deck";
import { byDifficulty, type Difficulty } from "../shared/difficulty";
import { duelAnswer, freshDuel, type Duel } from "../shared/duel";
import type { AnswerLog, Team } from "../types";

/**
 * Penaltı oyun mantığı.
 *
 * İki takıma aynı soru sorulur (düello sorusu). İlk doğru cevaplayan takımın oyuncusu penaltıyı çeker;
 * yanlış cevap veren takım bekler, iki takım da bilemezse kimse çekmez. Şutçu parmağıyla kaleye doğru
 * bir çizgi çizer: çizginin bittiği yer (kalenin altında biterse kaleye doğru uzatılır) hedef, hızı güç,
 * kavisi falsodur. İsabetli hızdaki vuruş hedefe gider; yavaşına kaleci yetişir, fazla hızlısı yükselip
 * açılır (üst direk, direk ya da aut). Falsolu top kaleciyi biraz şaşırtır. Kaleci bilgisayardır ve
 * takımın alışkanlığını okur: önceki şutların gittiği yöne atlama olasılığı artar. Atladığı üçlüdeki ve
 * sınırına yakın topları kurtarır; doksana isabetli giden topa yetişemez.
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
/**
 * Direğe yakın şut: topun kenarı direğe (ya da üst direğe) bu kadar yaklaşırsa top direğe değer. Payı
 * dardır; değen topun yarıdan çoğu kalenin içindeyse direkten içeri seker (direkten gol), değilse döner.
 */
export const POST_BAND = 0.035;
export const BAR_BAND = 0.045;
/**
 * Doksan: üst köşeye giden top. Bu bölgeye isabetli (zayıf olmayan) vurulan şuta kaleci doğru yöne atlasa
 * da yetişemez; köşeyi bulmak ödüllüdür, direk payı ise risktir.
 */
export const TOP_CORNER = { x: 0.68, y: 0.72 } as const;

/**
 * Şutun gücü kaydırmanın hızından gelir (0..1). Yeşil bölgenin ortası ve yarı genişliği: bu aralıktaki
 * vuruş nişana gider; daha yavaşı zayıf kalır, daha hızlısı yükselip açılır.
 */
export const POWER_SWEET = 0.62;
export const POWER_HALF = 0.14;
/** Falso: kavisli kaydırma topu eğri yoldan götürür, kaleci bu kadar daha az uzanır (tam falsoda). */
export const CURL_DODGE = 0.12;
/** Zayıf vuruşta kalecinin fazladan uzanabildiği mesafe (en zayıfta); top yavaş geldiği için. */
export const WEAK_REACH = 0.75;
/** Sert vuruşta topun yükselmesi ve dışa açılması (yeşilin üstündeki her birim güç için). */
export const LOFT = 2.4;
export const SLICE = 0.55;

export type Power = "zayif" | "isabetli" | "sert";

export function powerZone(power: number): Power {
  if (power < POWER_SWEET - POWER_HALF) return "zayif";
  if (power > POWER_SWEET + POWER_HALF) return "sert";
  return "isabetli";
}

/** Gücün topun gittiği yere etkisi: sert vuruş yükselir ve direğe doğru açılır. */
export function shotFrom(aim: { x: number; y: number }, power: number): { x: number; y: number } {
  const over = Math.max(0, power - (POWER_SWEET + POWER_HALF));
  const side = Math.sign(aim.x) || 1;
  return { x: aim.x + side * over * SLICE, y: aim.y + over * LOFT };
}

/** Zayıf vuruşta kalecinin fazladan uzanması (0: isabetli ya da sert). */
export function weakReach(power: number): number {
  const lack = POWER_SWEET - POWER_HALF - power;
  if (lack <= 0) return 0;
  return WEAK_REACH * Math.min(1, lack / (POWER_SWEET - POWER_HALF));
}

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
  /** Vuruşun gücü (0..1; eski kayıtlarda yok). */
  power?: number;
  /** Falso (-1..1; eksi sola, artı sağa kavis). */
  curve?: number;
  third: Third;
  keeper: Third;
  result: KickResult;
  /** Top direğe (ya da üst direğe) değip içeri girdi. */
  post?: boolean;
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
  /** Eski iki adımlı şutun nişanı; kaydırmalı şutta hep boştur (eski kayıtlar için durur). */
  aim: { x: number; y: number; at: number } | null;
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
  | { type: "kick"; x: number; y: number; power: number; curve: number; now: number }
  | { type: "next"; now: number }
  | { type: "pause"; now: number }
  | { type: "resume"; now: number };

// ---- saf yardımcılar (sahne de kullanır) ----

/** Topun kaleye göre yeri: içeride, direğe ya da üst direğe değiyor, dışarıda. */
export function classify(x: number, y: number): "ic" | "direk" | "aut" {
  if (y < 0) return "aut";
  if (Math.abs(x) <= 1 - BALL_X - POST_BAND && y <= 1 - BALL_Y - BAR_BAND) return "ic";
  if (Math.abs(x) <= 1 + BALL_X && y <= 1 + BALL_Y) return "direk";
  return "aut";
}

/** Direğe değen top kalenin içine mi seker: topun yarıdan çoğu kale ağzının içindeyse evet. */
export function postIn(x: number, y: number): boolean {
  return classify(x, y) === "direk" && y >= 0 && Math.abs(x) <= 1 - BALL_X / 2 && y <= 1 - BALL_Y / 2;
}

/** Top doksana mı gidiyor (üst köşe). */
export const isTopCorner = (x: number, y: number) => Math.abs(x) >= TOP_CORNER.x && y >= TOP_CORNER.y;

/** Golün özel adı: direkten ya da doksandan girdiyse sahne ve sonuç kartı bunu yazar. */
export function goalKind(kick: Pick<Kick, "result" | "x" | "y" | "post">): "direkten" | "doksan" | null {
  if (kick.result !== "gol") return null;
  if (kick.post) return "direkten";
  return isTopCorner(kick.x, kick.y) ? "doksan" : null;
}
export const GOAL_KIND_TEXT = { direkten: "DİREKTEN GOL!", doksan: "DOKSANA GOL!" } as const;

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
export function keeperReaches(x: number, keeper: Third, extraReach = 0, y = 0): boolean {
  // Doksana isabetli giden topa kaleci yetişemez; zayıf vuruşta yetişir.
  if (extraReach <= 0 && isTopCorner(x, y)) return false;
  const [from, to] = ZONE[keeper];
  const reach = KEEPER_REACH + extraReach;
  return x >= from - reach && x <= to + reach;
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

export function kickResult(x: number, y: number, keeper: Third, extraReach = 0): KickResult {
  const place = classify(x, y);
  if (place === "direk" && postIn(x, y)) return keeperReaches(x, keeper, extraReach, y) ? "kurtardi" : "gol";
  if (place !== "ic") return place;
  return keeperReaches(x, keeper, extraReach, y) ? "kurtardi" : "gol";
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
    aim: null,
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
    aim: null,
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
        // Kaydırmalı şut: hedef, güç ve falso tek eylemde gelir.
        if (s.phase !== "kick" || s.shooter === null || s.kickStart === null) return s;
        if (a.now - s.kickStart < KICK_LOCK_MS) return s;
        if (![a.x, a.y, a.power, a.curve].every(Number.isFinite)) return s;
        const power = Math.min(1, Math.max(0, a.power));
        const curve = Math.min(1, Math.max(-1, a.curve));
        const aim = { x: Math.min(2.4, Math.max(-2.4, a.x)), y: Math.min(2.4, Math.max(0, a.y)) };
        // Kaleci bu takımın önceki şutlarını hatırlar.
        const habits = s.kicks.filter((k) => k.side === s.shooter).map((k) => k.third);
        const keeper = keeperFor(s.seed, s.kicks.length, habits);
        let { x, y } = shotFrom(aim, power);
        const result = kickResult(x, y, keeper, weakReach(power) - CURL_DODGE * Math.abs(curve));
        const post = result === "gol" && postIn(x, y);
        // Direğe çarpan top sahnede gerçekten direğe değsin: yeri direğin çizgisine çekilir.
        if (post) {
          if (y > 1 - BALL_Y - BAR_BAND && Math.abs(x) <= 1 - BALL_X - POST_BAND) y = 1 - BALL_Y;
          else {
            x = Math.sign(x || 1) * (1 - BALL_X);
            y = Math.min(y, 0.92);
          }
        } else if (result === "direk") {
          if (y > 1 - BALL_Y - BAR_BAND && Math.abs(x) <= 1 - BALL_X) y = 1;
          else {
            x = Math.sign(x || 1);
            y = Math.min(y, 0.92);
          }
        }
        const kick: Kick = { side: s.shooter, x, y, aimX: aim.x, aimY: aim.y, power, ...(curve ? { curve } : {}), third: thirdOf(x), keeper, result, ...(post ? { post } : {}), at: a.now, questionId: q?.id ?? "" };
        const goals = [...s.goals] as [number, number];
        if (result === "gol") goals[s.shooter] += 1;
        const next: PenaltyState = { ...s, phase: "result", goals, kicks: [...s.kicks, kick], kickStart: null, aim: null };
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
