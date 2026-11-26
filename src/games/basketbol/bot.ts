import { botRng } from "../shared/solo";
import { METER_LOCK_MS, powerFor, type Launch, type Range } from "./logic";

/** Rakibin mesafe seçimi: çoğunlukla 2 sayı, ara sıra üçlük. */
export function botRange(seed: number, key: string): Range {
  return botRng(seed, `mesafe:${key}`)() < 0.3 ? 3 : 2;
}

/**
 * Rakibin atışı: bir açı seçer, topu çemberin ortasının biraz önüne ya da arkasına indirecek kadar çeker.
 * Beceri arttıkça sapma azalır; üçlükte sapma daha büyüktür. Mesafe seçildikten biraz sonra bırakır.
 */
export function botShot(seed: number, key: string, skill: number, rangeAt: number, range: Range): { at: number; launch: Launch } {
  const rng = botRng(seed, `atis:${key}`);
  const angle = ((48 + rng() * 12) * Math.PI) / 180;
  const spread = (0.75 - 0.5 * skill) * (range === 3 ? 1.25 : 1);
  const miss = (rng() + rng() - 1) * spread;
  return { at: rangeAt + METER_LOCK_MS + 1500 + rng() * 700, launch: { angle, power: powerFor(angle, range, miss) } };
}
