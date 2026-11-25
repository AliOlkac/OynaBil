import { byDifficulty, type Difficulty } from "../shared/difficulty";
import { botRng } from "../shared/solo";
import { METER_LOCK_MS, METER_PERIOD, METER_SPEED, SWEET, type Range } from "./logic";

/** Rakibin mesafe seçimi: çoğunlukla 2 sayı, ara sıra üçlük. */
export function botRange(seed: number, key: string): Range {
  return botRng(seed, `mesafe:${key}`)() < 0.3 ? 3 : 2;
}

/** Rakibin AT dediği an: çubuğun ikinci çıkışında, yeşilin çevresinde; beceri arttıkça ortaya yaklaşır. */
export function botShootAt(seed: number, key: string, skill: number, meterStart: number, range: Range, d: Difficulty): number {
  const rng = botRng(seed, `atis:${key}`);
  const spread = 0.2 - 0.13 * skill;
  const power = Math.min(0.98, Math.max(0.05, SWEET + (rng() - 0.5) * 2 * spread));
  const period = METER_PERIOD[range] / byDifficulty(d, METER_SPEED);
  return meterStart + METER_LOCK_MS + period + (power / 2) * period;
}
