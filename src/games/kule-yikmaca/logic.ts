import type { PlayableQuestion } from "@/core/deck";
import { duelAnswer, freshDuel, type Duel } from "../shared/duel";
import type { AnswerLog, Team } from "../types";

/**
 * Kule Yıkmaca oyun mantığı.
 *
 * İki takımın birer kulesi ve kulesinin önünde bir mancınığı vardır. İki takıma aynı soru sorulur
 * (düello sorusu): ilk doğru cevaplayan takım atış hakkı kazanır. Hasar üç şeye bağlıdır:
 * - Bilgi: soruyu bilmek. Zor soruyu bilen takım ateşli gülle atar.
 * - Beceri: karşı kulenin önünde inip çıkan nişangâhı doğru anda durdurmak.
 * - Şans: her turda değişen rüzgâr. Arkadan esen rüzgâr taşı yükseğe, önden esen alçağa taşır.
 * Kulenin neresine isabet ettiği hasarı belirler: pencere en çok, temel en az.
 * Yanlış cevap veren takımın mancınığı tutukluk yapar ve takım bekler; öteki takım bilirse o atar.
 * İki takım da bilemezse kimse atmaz, sıradaki soruya geçilir. Doğru/yanlış soruları kullanılmaz:
 * yanlış şık görülünce doğrusu kendiliğinden belli olurdu.
 *
 * Saf reducer: zaman eylemle gelir, rüzgâr oyun tohumundan türetilir.
 * Çok cihazlı sürümde aynı mantık öğretmen cihazında çalışır.
 */

export const TOWER_HP = 100;
/**
 * Doğru cevaptan sonra mancınık kurulup taş yüklenir, kamera hedef kuleye döner; bu sürede nişangâh bekler.
 * Çift dokunuşla yanlışlıkla atış da olmaz.
 */
export const AIM_LOCK_MS = 1_600;
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

/** Takım başına beş atışlık (on soruluk) oyunda bölgelerin hasarı; soru sayısı değişince oranlanır. */
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
  /** Oyundaki soru sayısı; her soruda en fazla bir atış yapılır. */
  questions: number;
  /** Soru süresi (saniye); 0 süresiz. */
  seconds: number;
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

export type Outcome = "correct" | "wrong" | "timeout";

export type SiegeState = {
  phase: "ready" | "question" | "aim" | "shot" | "reveal" | "finished";
  teams: [Team, Team];
  settings: SiegeSettings;
  seed: number;
  /** Destede sıradaki kullanılmamış soru. */
  cursor: number;
  current: number;
  /** Açılan soru sayısı; o anki sorunun sırası `asked - 1`. */
  asked: number;
  duel: Duel;
  hp: [number, number];
  outcome: Outcome | null;
  /** Atış hakkı olan taraf. */
  shooter: 0 | 1 | null;
  aimStart: number | null;
  deadline: number | null;
  remaining: number | null;
  shots: Shot[];
  /** Her takımın son yanlış cevap anı: o takımın mancınığı tutukluk yapar. */
  misfireAt: [number | null, number | null];
  winner: string | "draw" | null;
  endReason: "collapse" | "rounds" | null;
  log: AnswerLog[];
};

export type SiegeAction =
  | { type: "start"; now: number }
  | { type: "answer"; side: 0 | 1; option: number; now: number }
  | { type: "timeout"; now: number }
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

/** Sorunun rüzgârı: oyun tohumu ve soru sırasından türetilir, -3..3. Sakin ve hafif rüzgâr daha sık eser. */
export function windFor(seed: number, round: number): number {
  let h = (seed ^ Math.imul(round + 1, 0x9e3779b1)) >>> 0;
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

/** `shotsPerTeam`: bir takımın oyunda yapabileceği en çok atış (soru sayısının yarısı). */
export function damageFor(zone: Zone, ammo: Ammo, shotsPerTeam: number): number {
  const base = ZONE_DAMAGE[zone] * (ammo === "ates" ? FIRE_MULTIPLIER : 1);
  return Math.round((base * 5) / Math.max(1, shotsPerTeam));
}

export const shotsPerTeam = (s: Pick<SiegeState, "settings">) => s.settings.questions / 2;

export function ammoFor(q: PlayableQuestion | undefined): Ammo {
  return q && q.difficulty >= 3 ? "ates" : "tas";
}

/** O anki sorunun sırası (0'dan). */
export function roundOf(s: SiegeState): number {
  return Math.max(0, s.asked - 1);
}

export function totalQuestions(s: SiegeState): number {
  return s.settings.questions;
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
    asked: 0,
    duel: freshDuel(),
    hp: [TOWER_HP, TOWER_HP],
    outcome: null,
    shooter: null,
    aimStart: null,
    deadline: null,
    remaining: null,
    shots: [],
    misfireAt: [null, null],
    winner: null,
    endReason: null,
    log: [],
  };
}

function openQuestion(s: SiegeState, deck: PlayableQuestion[], now: number): SiegeState {
  if (s.cursor >= deck.length || s.asked >= totalQuestions(s)) return finishByRounds(s);
  return {
    ...s,
    phase: "question",
    current: s.cursor,
    cursor: s.cursor + 1,
    asked: s.asked + 1,
    duel: freshDuel(),
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

export function siegeReducer(deck: PlayableQuestion[]) {
  return function reduce(s: SiegeState, a: SiegeAction): SiegeState {
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
        const misfireAt = [...s.misfireAt] as SiegeState["misfireAt"];
        misfireAt[a.side] = a.now;
        if (result === "locked") return { ...s, duel, log, misfireAt };
        return { ...s, duel, log, misfireAt, phase: "reveal", outcome: "wrong", deadline: null, remaining: null };
      }

      case "timeout": {
        if (s.phase !== "question" || s.deadline === null || a.now < s.deadline || !q) return s;
        // Süre dolunca cevap vermemiş takımlar da bilemedi sayılır; onların mancınığı da tutukluk yapar.
        const silent = ([0, 1] as const).filter((side) => !s.duel.locked[side]);
        const misfireAt = [...s.misfireAt] as SiegeState["misfireAt"];
        for (const side of silent) misfireAt[side] = a.now;
        const log = [...s.log, ...silent.map((side) => ({ questionId: q.id, unit: q.unit, teamId: s.teams[side].id, correct: false }))];
        return { ...s, phase: "reveal", outcome: "timeout", misfireAt, log, deadline: null, remaining: null };
      }

      case "fire": {
        if (s.phase !== "aim" || s.shooter === null || s.aimStart === null) return s;
        if (a.now - s.aimStart < AIM_LOCK_MS) return s;
        const shooter = s.shooter;
        const target = (1 - shooter) as 0 | 1;
        const aim = sweepAt(a.now - s.aimStart);
        const wind = windFor(s.seed, roundOf(s));
        const hit = aim + windShift(shooter, wind);
        const zone = zoneAt(hit);
        const ammo = ammoFor(q);
        const damage = damageFor(zone, ammo, shotsPerTeam(s));
        const hp = [...s.hp] as [number, number];
        hp[target] = Math.max(0, hp[target] - damage);
        const shot: Shot = { side: shooter, aim, wind, hit, zone, ammo, damage, at: a.now, questionId: q?.id ?? "" };
        const next: SiegeState = { ...s, phase: "shot", hp, shots: [...s.shots, shot], aimStart: null };
        if (hp[target] === 0) return { ...next, phase: "finished", winner: s.teams[shooter].id, endReason: "collapse" };
        return next;
      }

      case "next":
        if (s.phase !== "shot" && s.phase !== "reveal") return s;
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
