import { byDifficulty, type Difficulty } from "../shared/difficulty";
import { botRng } from "../shared/solo";
import { METER_LOCK_MS, METER_PERIOD, METER_SPEED, SWEET, type Range } from "./logic";

/** Rakibin mesafe seçimi: çoğunlukla 2 sayı, ara sıra üçlük. */
export function botRange(seed: number, key: string): Range {
  return botRng(seed, `mesafe:${key}`)() < 0.3 ? 3 : 2;
}

/**
 * Rakibin atışı: topa basar (`pressAt`), güç çubuğu ilk dolarken yeşilin çevresinde bırakır (`at`);
 * beceri arttıkça ortaya yaklaşır.
 */
export function botShot(seed: number, key: string, skill: number, meterStart: number, range: Range, d: Difficulty): { pressAt: number; at: number } {
  const rng = botRng(seed, `atis:${key}`);
  const spread = 0.2 - 0.13 * skill;
  const power = Math.min(0.98, Math.max(0.05, SWEET + (rng() - 0.5) * 2 * spread));
  const period = METER_PERIOD[range] / byDifficulty(d, METER_SPEED);
  const pressAt = meterStart + METER_LOCK_MS + 700 + rng() * 600;
  return { pressAt, at: pressAt + (power / 2) * period };
}
