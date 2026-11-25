import { byDifficulty, type Difficulty } from "../shared/difficulty";
import { botRng } from "../shared/solo";
import { AIM_LOCK_MS, SWEEP_MS, SWEEP_SPEED, windShift } from "./logic";

/** Pencerenin ortası (nişangâh ölçeğinde). */
const WINDOW = 0.43;

/**
 * Rakibin ATEŞ dediği an: nişangâhın ikinci çıkışında, rüzgâr payıyla pencere hizasında. Beceri düştükçe
 * nişan pencereden uzaklaşır (gövdeye, burca ya da boşa gider).
 */
export function botFireAt(seed: number, key: string, skill: number, aimStart: number, wind: number, d: Difficulty): number {
  const rng = botRng(seed, `tas:${key}`);
  const spread = 0.24 - 0.17 * skill;
  const aim = Math.min(0.97, Math.max(0.03, WINDOW - windShift(1, wind) + (rng() - 0.5) * 2 * spread));
  const period = SWEEP_MS / byDifficulty(d, SWEEP_SPEED);
  return aimStart + AIM_LOCK_MS + period + (aim / 2) * period;
}
