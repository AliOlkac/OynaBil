import { botRng } from "../shared/solo";
import { AIM_LOCK_MS, powerFor, type Launch } from "./logic";

/** Pencerenin ortası (nişangâh ölçeğinde). */
const WINDOW = 0.43;

/**
 * Rakibin atışı: 38-50 derece arasında bir açı seçer ve rüzgârı hesaba katarak pencereye isabet ettiren
 * gücü bulur. Beceri düştükçe güç şaşar: taş gövdeye, burca gider ya da kuleyi bulamaz.
 */
export function botShot(seed: number, key: string, skill: number, aimStart: number, wind: number): { at: number; launch: Launch } {
  const rng = botRng(seed, `tas:${key}`);
  const angle = ((38 + rng() * 12) * Math.PI) / 180;
  const exact = powerFor(angle, 1, wind, WINDOW);
  const spread = 0.13 - 0.1 * skill;
  const power = Math.min(1, Math.max(0.15, exact + (rng() - 0.5) * 2 * spread));
  return { at: aimStart + AIM_LOCK_MS + 1600 + rng() * 900, launch: { angle, power } };
}
