import type { PlayableQuestion } from "@/core/deck";
import type { AnswerLog, Team } from "../types";

/**
 * Kule Yıkmaca oyun mantığı.
 *
 * İki takımın birer kulesi ve kulesinin önünde bir mancınığı vardır. Takımlar sırayla soru alır.
 * Doğru cevap atış hakkı kazandırır, ama hasar üç şeye bağlıdır:
 * - Bilgi: soruyu bilmek. Zor soruyu bilen takım ateşli gülle atar.
 * - Beceri: karşı kulenin önünde inip çıkan nişangâhı doğru anda durdurmak.
 * - Şans: her turda değişen rüzgâr. Arkadan esen rüzgâr taşı yükseğe, önden esen alçağa taşır.
 * Kulenin neresine isabet ettiği hasarı belirler: pencere en çok, temel en az.
 *
 * Saf reducer: zaman eylemle gelir, rüzgâr oyun tohumundan türetilir.
 * Çok cihazlı sürümde aynı mantık öğretmen cihazında çalışır.
 */

export const TOWER_HP = 100;
/** Doğru cevaptan sonra mancınık kurulup taş yüklenirken nişangâh bekler; çift dokunuşla yanlışlıkla atış olmaz. */
export const AIM_LOCK_MS = 1_200;
/** Nişangâhın aşağıdan yukarı çıkıp geri inme süresi. */
export const SWEEP_MS = 2_400;
/** Rüzgârın her kademesi isabet yüksekliğini bu kadar kaydırır (nişangâh ölçeğinde). */
export const WIND_STEP = 0.035;
export const MAX_WIND = 3;
export const FIRE_MULTIPLIER = 1.5;

export type Zone = "kisa" | "temel" | "govde" | "pencere" | "burc" | "kulah" | "uzun";
export type Ammo = "tas" | "ates";

/**
 * Nişangâhın taradığı yükseklik: 0 kulenin önündeki toprak, 1 çatının üstü.
 * Sahne kuleyi bu sınırlara göre çizer; pencereye isabet eden taş gerçekten pencereye çarpar.
 */
export const BANDS: readonly { zone: Zone; from: number; to: number }[] = [
  { zone: "kisa", from: -Infinity, to: 0.12 },
  { zone: "temel", from: 0.12, to: 0.24 },
  { zone: "govde", from: 0.24, to: 0.38 },
  { zone: "pencere", from: 0.38, to: 0.48 },
  { zone: "govde", from: 0.48, to: 0.62 },
  { zone: "burc", from: 0.62, to: 0.74 },
  { zone: "kulah", from: 0.74, to: 0.86 },
  { zone: "uzun", from: 0.86, to: Infinity },
];

/** Beş turluk oyunda bölgelerin hasarı; tur sayısı değişince oranlanır. */
export const ZONE_DAMAGE: Record<Zone, number> = { kisa: 0, temel: 10, govde: 18, pencere: 35, burc: 25, kulah: 15, uzun: 0 };

export const ZONE_LABEL: Record<Zone, string> = {
  kisa: "Kısa kaldı",
  temel: "Temele isabet",
  govde: "Gövdeye isabet",
  pencere: "Pencereye isabet",
  burc: "Burca isabet",
  kulah: "Külaha isabet",
  uzun: "Üstünden geçti",
};

export type SiegeSettings = {
  /** Her takımın soru sayısı. */
  rounds: number;
  /** Soru süresi (saniye); 0 süresiz. */
  seconds: number;
  /** Bilemeyen takımın sorusunu karşı takım cevaplarsa atış onun olur. */
  steal: boolean;
};

export type Shot = {
  /** Atan taraf: 0 soldaki, 1 sağdaki takım. */
  side: 0 | 1;
  /** Nişangâhın durdurulduğu yükseklik (0..1). */
  aim: number;
  wind: number;
  /** Rüzgârla birlikte taşın çarptığı yükseklik. */
  hit: number;
  zone: Zone;
  ammo: Ammo;
  damage: number;
  at: number;
  questionId: string;
};

export type Outcome = "correct" | "wrong" | "timeout" | "stolen" | "steal-failed";

export type SiegeState = {
  phase: "ready" | "question" | "steal" | "aim" | "shot" | "reveal" | "finished";
  teams: [Team, Team];
  settings: SiegeSettings;
  seed: number;
  /** Destede sıradaki kullanılmamış soru. */
  cursor: number;
  current: number;
  /** Açılan sıraların sayısı - 1: sıradaki takım `turn % 2`. */
  turn: number;
  asked: number;
  hp: [number, number];
  picked: number | null;
  stealPicked: number | null;
  outcome: Outcome | null;
  /** Atış hakkı olan taraf. */
  shooter: 0 | 1 | null;
  aimStart: number | null;
  deadline: number | null;
  remaining: number | null;
  shots: Shot[];
  /** Son yanlış cevap anı: mancınık tutukluk yapar. */
  misfireAt: number | null;
  winner: string | "draw" | null;
  endReason: "collapse" | "rounds" | null;
  log: AnswerLog[];
};

export type SiegeAction =
  | { type: "start"; now: number }
  | { type: "answer"; option: number; now: number }
  | { type: "timeout"; now: number }
  | { type: "steal-answer"; option: number; now: number }
  | { type: "skip-steal"; now: number }
  | { type: "fire"; now: number }
  | { type: "next"; now: number }
  | { type: "pause"; now: number }
  | { type: "resume"; now: number };

// ---- saf yardımcılar (sahne de kullanır) ----

/** Nişangâhın konumu: AIM_LOCK_MS sonra aşağıdan başlar, SWEEP_MS'de bir aşağı yukarı gidip gelir. */
export function sweepAt(elapsedMs: number): number {
  const t = Math.max(0, elapsedMs - AIM_LOCK_MS);
  const f = (t % SWEEP_MS) / SWEEP_MS;
  return f < 0.5 ? f * 2 : 2 - f * 2;
}

/** Turun rüzgârı: oyun tohumu ve sıradan türetilir, -3..3. Sakin ve hafif rüzgâr daha sık eser. */
export function windFor(seed: number, turn: number): number {
  let h = (seed ^ Math.imul(turn + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  const strength = [0, 1, 1, 1, 2, 2, 3][h % 7];
  if (strength === 0) return 0;
  return (h >>> 8) & 1 ? strength : -strength;
}

/** Atan taraf için rüzgârın etkisi: sağa esen rüzgâr soldaki takımın taşını yükseltir, sağdakininkini alçaltır. */
export function windShift(side: 0 | 1, wind: number): number {
  return wind * (side === 0 ? 1 : -1) * WIND_STEP;
}

export function zoneAt(hit: number): Zone {
  return BANDS.find((b) => hit >= b.from && hit < b.to)?.zone ?? "uzun";
}

export function damageFor(zone: Zone, ammo: Ammo, rounds: number): number {
  const base = ZONE_DAMAGE[zone] * (ammo === "ates" ? FIRE_MULTIPLIER : 1);
  return Math.round((base * 5) / Math.max(1, rounds));
}

export function ammoFor(q: PlayableQuestion | undefined): Ammo {
  return q && q.difficulty >= 3 ? "ates" : "tas";
}

export function turnSide(s: SiegeState): 0 | 1 {
  return (s.turn % 2) as 0 | 1;
}

export function totalQuestions(s: SiegeState): number {
  return s.settings.rounds * 2;
}

/** Bir takımın karşı kuleye verdiği toplam hasar. */
export function dealt(s: SiegeState, side: 0 | 1): number {
  return TOWER_HP - s.hp[side === 0 ? 1 : 0];
}

export function createSiege(teams: [Team, Team], settings: SiegeSettings, seed: number): SiegeState {
  return {
    phase: "ready",
    teams,
    settings,
    seed,
    cursor: 0,
    current: 0,
    turn: 0,
    asked: 0,
    hp: [TOWER_HP, TOWER_HP],
    picked: null,
    stealPicked: null,
    outcome: null,
    shooter: null,
    aimStart: null,
    deadline: null,
    remaining: null,
    shots: [],
    misfireAt: null,
    winner: null,
    endReason: null,
    log: [],
  };
}

function openQuestion(s: SiegeState, deck: PlayableQuestion[], now: number, turn: number): SiegeState {
  if (s.cursor >= deck.length || s.asked >= totalQuestions(s)) return finishByRounds(s);
  return {
    ...s,
    phase: "question",
    turn,
    current: s.cursor,
    cursor: s.cursor + 1,
    picked: null,
    stealPicked: null,
    outcome: null,
    shooter: null,
    aimStart: null,
    deadline: s.settings.seconds > 0 ? now + s.settings.seconds * 1000 : null,
    remaining: null,
  };
}

function finishByRounds(s: SiegeState): SiegeState {
  const [a, b] = s.hp;
  const winner = a === b ? "draw" : a > b ? s.teams[0].id : s.teams[1].id;
  return { ...s, phase: "finished", winner, endReason: "rounds", deadline: null, remaining: null, shooter: null, aimStart: null };
}

function toAim(s: SiegeState, shooter: 0 | 1, now: number): SiegeState {
  return { ...s, phase: "aim", shooter, aimStart: now, deadline: null, remaining: null };
}

function miss(s: SiegeState, outcome: "wrong" | "timeout", now: number): SiegeState {
  if (s.settings.steal) return { ...s, phase: "steal", outcome, deadline: null, remaining: null };
  return { ...s, phase: "reveal", outcome, misfireAt: now, deadline: null, remaining: null };
}

export function siegeReducer(deck: PlayableQuestion[]) {
  return function reduce(s: SiegeState, a: SiegeAction): SiegeState {
    const q = deck[s.current];
    const side = turnSide(s);
    const team = s.teams[side];
    const other = (1 - side) as 0 | 1;

    switch (a.type) {
      case "start":
        return s.phase === "ready" ? openQuestion(s, deck, a.now, 0) : s;

      case "answer": {
        const paused = s.deadline === null && s.remaining !== null;
        if (s.phase !== "question" || paused || !q) return s;
        if (a.option < 0 || a.option >= q.options.length) return s;
        const correct = a.option === q.correctIndex;
        const logged: SiegeState = {
          ...s,
          picked: a.option,
          asked: s.asked + 1,
          log: [...s.log, { questionId: q.id, unit: q.unit, teamId: team.id, correct }],
        };
        return correct ? toAim({ ...logged, outcome: "correct" }, side, a.now) : miss(logged, "wrong", a.now);
      }

      case "timeout": {
        if (s.phase !== "question" || s.deadline === null || a.now < s.deadline || !q) return s;
        return miss({ ...s, asked: s.asked + 1, log: [...s.log, { questionId: q.id, unit: q.unit, teamId: team.id, correct: false }] }, "timeout", a.now);
      }

      case "steal-answer": {
        if (s.phase !== "steal" || !q || a.option === s.picked) return s;
        if (a.option < 0 || a.option >= q.options.length) return s;
        const correct = a.option === q.correctIndex;
        const logged: SiegeState = {
          ...s,
          stealPicked: a.option,
          log: [...s.log, { questionId: q.id, unit: q.unit, teamId: s.teams[other].id, correct, stolen: true }],
        };
        return correct ? toAim({ ...logged, outcome: "stolen" }, other, a.now) : { ...logged, phase: "reveal", outcome: "steal-failed", misfireAt: a.now };
      }

      case "skip-steal":
        return s.phase === "steal" ? { ...s, phase: "reveal", misfireAt: a.now } : s;

      case "fire": {
        if (s.phase !== "aim" || s.shooter === null || s.aimStart === null) return s;
        if (a.now - s.aimStart < AIM_LOCK_MS) return s;
        const shooter = s.shooter;
        const target = (1 - shooter) as 0 | 1;
        const aim = sweepAt(a.now - s.aimStart);
        const wind = windFor(s.seed, s.turn);
        const hit = aim + windShift(shooter, wind);
        const zone = zoneAt(hit);
        const ammo = ammoFor(q);
        const damage = damageFor(zone, ammo, s.settings.rounds);
        const hp = [...s.hp] as [number, number];
        hp[target] = Math.max(0, hp[target] - damage);
        const shot: Shot = { side: shooter, aim, wind, hit, zone, ammo, damage, at: a.now, questionId: q?.id ?? "" };
        const next: SiegeState = { ...s, phase: "shot", hp, shots: [...s.shots, shot], aimStart: null };
        if (hp[target] === 0) return { ...next, phase: "finished", winner: s.teams[shooter].id, endReason: "collapse" };
        return next;
      }

      case "next":
        if (s.phase !== "shot" && s.phase !== "reveal") return s;
        return openQuestion(s, deck, a.now, s.turn + 1);

      case "pause":
        if (s.phase !== "question" || s.deadline === null) return s;
        return { ...s, deadline: null, remaining: Math.max(0, s.deadline - a.now) };

      case "resume":
        if (s.phase !== "question" || s.remaining === null) return s;
        return { ...s, deadline: a.now + s.remaining, remaining: null };
    }
  };
}
