/**
 * Mobil lig sistemi (saf hesap). Görünen kısım: lig basamağı ve 0-100 lig puanı. Arkada gizli bir
 * beceri puanı (MMR) tutulur; rakibin gücü ve kazanılan puan ona göre ayarlanır.
 * Ayrıntı: docs/MOBIL-PLATFORM.md, "Lig ve puan sistemi".
 */

export const TIERS = [
  { id: "bronz", name: "Bronz", color: "var(--color-lig-bronz)" },
  { id: "gumus", name: "Gümüş", color: "var(--color-lig-gumus)" },
  { id: "altin", name: "Altın", color: "var(--color-lig-altin)" },
  { id: "platin", name: "Platin", color: "var(--color-lig-platin)" },
  { id: "elmas", name: "Elmas", color: "var(--color-lig-elmas)" },
  { id: "usta", name: "Usta", color: "var(--color-lig-usta)" },
] as const;

/** Bronz III = 0 … Elmas I = 14, Usta = 15. */
export const TOP_STEP = 15;
/** Bu basamağın altında (Bronz ve Gümüş) lig düşmesi yoktur. */
export const SAFE_BELOW = 6;
/** Yeni basamağa çıkınca bu kadar maç puan kaybedilmez. */
export const GUARD_MATCHES = 3;
export const START_MMR = 1000;

const ROMAN = ["III", "II", "I"];

export type Rank = { step: number; lp: number; mmr: number; guard: number };
export type Outcome = "win" | "loss" | "draw";

export const startRank = (): Rank => ({ step: 0, lp: 0, mmr: START_MMR, guard: 0 });

export function tierOf(step: number) {
  return TIERS[Math.min(TIERS.length - 1, Math.floor(step / 3))];
}

export function rankName(step: number): string {
  return step >= TOP_STEP ? "Usta" : `${tierOf(step).name} ${ROMAN[step % 3]}`;
}

/** Basamağa denk gelen beceri puanı: oyuncu bunun üstündeyse daha hızlı yükselir. */
export const stepMmr = (step: number) => 820 + step * 90;

/** Rakibin becerisi (0..1): oyuncunun gizli puanına göre. */
export function botSkill(mmr: number): number {
  return Math.min(0.92, Math.max(0.12, (mmr - 760) / 1250));
}

export type MatchChange = { rank: Rank; delta: number; promoted: boolean; demoted: boolean; shieldUsed: boolean; guarded: boolean };

/** Bir dereceli maçın sonucunu işler. `shield`: oyuncunun kalkanı var; yenilgide puan kaybını yarıya indirir. */
export function applyMatch(r: Rank, outcome: Outcome, shield: boolean): MatchChange {
  const edge = Math.max(-6, Math.min(10, (r.mmr - stepMmr(r.step)) / 20));
  let mmr = r.mmr;
  let delta = 0;
  let shieldUsed = false;
  let guarded = false;
  if (outcome === "win") {
    delta = Math.round(22 + edge);
    mmr += 28;
  } else if (outcome === "loss") {
    mmr = Math.max(600, mmr - 22);
    if (r.guard > 0) guarded = true;
    else {
      delta = -Math.round(15 - edge * 0.5);
      if (shield) {
        delta = Math.ceil(delta / 2);
        shieldUsed = true;
      }
    }
  } else delta = 4;

  let step = r.step;
  let lp = r.lp + delta;
  let promoted = false;
  let demoted = false;
  if (step < TOP_STEP && lp >= 100) {
    step += 1;
    lp = step === TOP_STEP ? lp - 100 : Math.min(30, lp - 100);
    promoted = true;
  } else if (lp < 0) {
    if (step >= SAFE_BELOW && step > 0) {
      step -= 1;
      lp = 70;
      demoted = true;
    } else lp = 0;
  }
  const guard = promoted ? GUARD_MATCHES : Math.max(0, r.guard - 1);
  return { rank: { step, lp, mmr, guard }, delta: step === r.step ? lp - r.lp : delta, promoted, demoted, shieldUsed, guarded };
}
