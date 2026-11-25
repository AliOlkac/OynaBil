"use client";

import type { Grade } from "@/core/model";
import type { GameConfig, TeamColor } from "@/games/types";
import type { AnswerLog } from "@/games/types";
import { createLocalStore } from "@/lib/store";
import { applyMatch, startRank, type MatchChange, type Outcome, type Rank } from "./league";

/**
 * Mobil prototipin oyuncu kaydı: telefonda saklanır (sunucu yok). Lig basamağı, kalkanlar, maç geçmişi
 * ve ünite bazında başarı. Sunuculu sürümde bu kayıt hesaba taşınır (docs/MOBIL-PLATFORM.md).
 */

export const MOBILE_GAMES = ["basketbol", "okculuk", "penalti", "kule-yikmaca", "halat-cekme", "bilgi-yarismasi"] as const;
export type MobileGameId = (typeof MOBILE_GAMES)[number];
export const PLAYER_ID = "sen";
export const MAX_SHIELDS = 3;
export const QUEST_MATCHES = 3;

export type MatchRecord = {
  sessionId: string;
  at: number;
  gameId: string;
  subjectId: string;
  opponent: string;
  outcome: Outcome;
  score: [number, number];
  delta: number;
};

export type Profile = {
  /** İlk açılışta ad ve sınıf sorulur. */
  ready: boolean;
  name: string;
  grade: Grade;
  /** Oyuncunun rengi ve amblemi; rakip başka bir renk alır. */
  color: TeamColor;
  /** Seçili ders; "karisik" her maçta başka bir ders getirir. */
  subject: string;
  game: MobileGameId | "sirayla";
  rank: Rank;
  shields: number;
  history: MatchRecord[];
  /** Ünite -> doğru ve toplam cevap. */
  stats: Record<string, { right: number; total: number }>;
  /** Günlük görevin ödülünün verildiği gün (YYYY-AA-GG). */
  questDay: string | null;
  /** Yarıda kalan maç: sayfa yenilense de sürer. */
  active: { config: GameConfig; opponent: string; skill: number } | null;
};

const FRESH: Profile = { ready: false, name: "", grade: 7, color: "kobalt", subject: "karisik", game: "sirayla", rank: startRank(), shields: 0, history: [], stats: {}, questDay: null, active: null };

export const profileStore = createLocalStore<Profile>("oynabil.mobil.v1", FRESH);
export const useProfile = () => ({ ...FRESH, ...profileStore.use() });
export const getProfile = (): Profile => ({ ...FRESH, ...profileStore.get() });
export const updateProfile = (patch: Partial<Profile>) => profileStore.set({ ...getProfile(), ...patch });
export const resetProfile = () => profileStore.set(FRESH);

export const dayKey = (at: number) => {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const matchesToday = (p: Profile, now: number) => p.history.filter((m) => dayKey(m.at) === dayKey(now)).length;

/** Maç ve çalışma cevaplarını ünite istatistiğine ekler. */
export function addStats(stats: Profile["stats"], entries: readonly { unit: string; correct: boolean }[]): Profile["stats"] {
  const next = { ...stats };
  for (const e of entries) {
    const u = next[e.unit] ?? { right: 0, total: 0 };
    next[e.unit] = { right: u.right + (e.correct ? 1 : 0), total: u.total + 1 };
  }
  return next;
}

/** En çok zorlanılan üniteler: en az iki cevap verilmiş, başarı oranı düşük olanlar önce. */
export function weakUnits(stats: Profile["stats"], limit = 3): { unit: string; right: number; total: number }[] {
  return Object.entries(stats)
    .filter(([, v]) => v.total >= 2 && v.right / v.total < 0.75)
    .map(([unit, v]) => ({ unit, ...v }))
    .sort((a, b) => a.right / a.total - b.right / b.total || b.total - a.total)
    .slice(0, limit);
}

export type MatchOutcome = MatchChange & { record: MatchRecord; questDone: boolean };

/** Biten maçı kayda işler. Aynı maç (sessionId) ikinci kez işlenmez. */
export function recordMatch(
  p: Profile,
  m: { sessionId: string; gameId: string; subjectId: string; opponent: string; winner: 0 | 1 | "draw"; score: [number, number]; log: readonly AnswerLog[] },
  now: number,
): { profile: Profile; outcome: MatchOutcome } | null {
  if (p.history.some((h) => h.sessionId === m.sessionId)) return null;
  const outcome: Outcome = m.winner === "draw" ? "draw" : m.winner === 0 ? "win" : "loss";
  const change = applyMatch(p.rank, outcome, p.shields > 0);
  const record: MatchRecord = { sessionId: m.sessionId, at: now, gameId: m.gameId, subjectId: m.subjectId, opponent: m.opponent, outcome, score: m.score, delta: change.delta };
  const history = [...p.history, record].slice(-40);
  let shields = p.shields - (change.shieldUsed ? 1 : 0);
  // Günlük görev: günde üç maç bir kalkan kazandırır.
  const today = dayKey(now);
  const questDone = p.questDay !== today && history.filter((h) => dayKey(h.at) === today).length >= QUEST_MATCHES;
  if (questDone) shields = Math.min(MAX_SHIELDS, shields + 1);
  const profile: Profile = {
    ...p,
    rank: change.rank,
    shields,
    history,
    stats: addStats(p.stats, m.log.filter((l) => l.teamId === PLAYER_ID)),
    questDay: questDone ? today : p.questDay,
    active: null,
  };
  return { profile, outcome: { ...change, record, questDone } };
}

export const BOT_NAMES = ["Deniz_K", "MaviRoket", "Zeynep34", "Poyraz", "AtaTürkmen", "Elif.06", "Kaptan35", "Ada_Su", "Rüzgâr", "Yıldız07", "Efe_Can", "Bilge"];

/** Rakibin rengi: oyuncununkinden farklı. */
export const rivalColor = (mine: TeamColor): TeamColor => (mine === "mercan" ? "kobalt" : "mercan");

/** Süren galibiyet serisi (son maçtan geriye doğru). */
export function winStreak(p: Pick<Profile, "history">): number {
  let n = 0;
  for (let i = p.history.length - 1; i >= 0 && p.history[i].outcome === "win"; i--) n++;
  return n;
}
