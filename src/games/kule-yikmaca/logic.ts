import type { PlayableQuestion } from "@/core/deck";
import { duelAnswer, freshDuel, type Duel } from "../shared/duel";
import type { AnswerLog, Team } from "../types";

/**
 * Kule Yıkmaca oyun mantığı.
 *
 * İki takımın birer kulesi ve kulesinin önünde bir mancınığı vardır. İki takıma aynı soru sorulur
 * (düello sorusu): ilk doğru cevaplayan takım atış hakkı kazanır. Hasar üç şeye bağlıdır:
 * - Bilgi: soruyu bilmek. Zor soruyu bilen takım ateşli gülle atar.
 * - Beceri: mancınığı sapan gibi geri çekip açıyı ve gücü ayarlamak. Taş gerçek bir mermi gibi uçar;
 *   yolun yalnızca başı gösterilir, gerisini oyuncu kestirir.
 * - Şans: her turda değişen rüzgâr. Arkadan esen rüzgâr taşı ileri taşır, önden esen geri iter.
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
/** Nişangâh ölçeğinin tamamı (0..1) kaç metre eder; yer, ölçekte 0.12'dedir. */
export const RANGE_M = 12;
/** Taşın kepçeden çıktığı nokta ile karşı kulenin yüzü arasındaki yatay mesafe ve çıkış yüksekliği (metre). */
export const FIELD = { distance: 29.6, height: 3.8 } as const;
export const GRAVITY = 16;
/** Çıkış hızı (m/sn): çekiş gücü 0 iken ve 1 iken. */
export const SPEED = { min: 15, max: 24 } as const;
/** Atış açısının sınırları (radyan). */
export const ANGLE = { min: (12 * Math.PI) / 180, max: (76 * Math.PI) / 180 } as const;
/** Rüzgârın her kademesi taşın yatay hızını bu kadar değiştirir (m/sn). */
export const WIND_PUSH = 0.5;
/** Yolun gösterilen kısmı (kuleye olan mesafenin oranı): gerisini oyuncu kestirir. */
export const PREVIEW = 0.42;
/** Bu kadar çekilmeden bırakılan mancınık ateşlenmez (yanlış dokunuş). */
export const MIN_PULL = 0.12;
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

/** Mancınığın çekilişi: açı (radyan, yataydan yukarı) ve güç (0..1). */
export type Launch = { angle: number; power: number };

export type Shot = {
  /** Atan taraf: 0 soldaki, 1 sağdaki takım. */
  side: 0 | 1;
  launch: Launch;
  /** Rüzgâr olmasaydı taşın çarpacağı yükseklik (0..1 ölçeğinde; yerin altı ve çatının üstü olabilir). */
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
  | { type: "fire"; launch: Launch; now: number }
  | { type: "next"; now: number }
  | { type: "pause"; now: number }
  | { type: "resume"; now: number };

// ---- saf yardımcılar (sahne de kullanır) ----

export const clampLaunch = (l: Launch): Launch => ({
  angle: Math.min(ANGLE.max, Math.max(ANGLE.min, l.angle)),
  power: Math.min(1, Math.max(0, l.power)),
});

/** Taşın hızı: rüzgâr yalnızca yatay hızı değiştirir (arkadan eserse artırır). */
export function velocityOf(launch: Launch, side: 0 | 1, wind: number): { vx: number; vy: number } {
  const l = clampLaunch(launch);
  const v = SPEED.min + (SPEED.max - SPEED.min) * l.power;
  return { vx: Math.max(3, v * Math.cos(l.angle) + windShift(side, wind)), vy: v * Math.sin(l.angle) };
}

/** Taşın, kuleye olan mesafenin `frac` oranındaki yüksekliği (metre, yerden). `frac` 1'den büyük olabilir. */
export function pathHeight(launch: Launch, side: 0 | 1, wind: number, frac: number): number {
  const { vx, vy } = velocityOf(launch, side, wind);
  const t = (frac * FIELD.distance) / vx;
  return FIELD.height + vy * t - (GRAVITY / 2) * t * t;
}

/** Taşın yere düştüğü yer (kuleye olan mesafenin oranı): kule olmasaydı nereye inerdi. */
export function landingFraction(launch: Launch, side: 0 | 1, wind: number): number {
  const { vx, vy } = velocityOf(launch, side, wind);
  const t = (vy + Math.sqrt(vy * vy + 2 * GRAVITY * FIELD.height)) / GRAVITY;
  return (vx * t) / FIELD.distance;
}

/** Kule yüzüne varış süresi (saniye). */
export function flightSeconds(launch: Launch, side: 0 | 1, wind: number, frac = 1): number {
  return (frac * FIELD.distance) / velocityOf(launch, side, wind).vx;
}

/** Taşın kule yüzündeki yüksekliği, nişangâh ölçeğinde (0.12 yer, 0.86 çatının ucu). */
export function impactOf(launch: Launch, side: 0 | 1, wind: number): number {
  return pathHeight(launch, side, wind, 1) / RANGE_M + BANDS[0].to;
}

/** Verilen açıyla, kulenin `target` yüksekliğine (0..1) isabet ettiren güç; ulaşılamıyorsa en yakını. */
export function powerFor(angle: number, side: 0 | 1, wind: number, target: number): number {
  let lo = 0;
  let hi = 1;
  // Güç arttıkça taş kule yüzüne daha yüksekten varır (bu açı aralığında tekdüze).
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    if (impactOf({ angle, power: mid }, side, wind) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
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

/** Atan taraf için rüzgârın yatay hıza etkisi (m/sn): sağa esen rüzgâr soldaki takımın taşını ileri taşır, sağdakininkini geri iter. */
export function windShift(side: 0 | 1, wind: number): number {
  return wind * (side === 0 ? 1 : -1) * WIND_PUSH;
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
        if (!Number.isFinite(a.launch.angle) || !Number.isFinite(a.launch.power) || a.launch.power < MIN_PULL) return s;
        const launch = clampLaunch(a.launch);
        const wind = windFor(s.seed, roundOf(s));
        const aim = impactOf(launch, shooter, 0);
        const hit = impactOf(launch, shooter, wind);
        const zone = zoneAt(hit);
        const ammo = ammoFor(q);
        const damage = damageFor(zone, ammo, shotsPerTeam(s));
        const hp = [...s.hp] as [number, number];
        hp[target] = Math.max(0, hp[target] - damage);
        const shot: Shot = { side: shooter, launch, aim, wind, hit, zone, ammo, damage, at: a.now, questionId: q?.id ?? "" };
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
