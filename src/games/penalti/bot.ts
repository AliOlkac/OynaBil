import { botRng } from "../shared/solo";
import { KICK_LOCK_MS } from "./logic";

/** Rakibin penaltısı: bir köşeye doğru; beceri düştükçe direğe ya da auta gitme olasılığı artar. */
export function botKick(seed: number, key: string, skill: number, kickStart: number): { at: number; x: number; y: number } {
  const rng = botRng(seed, `sut:${key}`);
  const side = rng() < 0.5 ? -1 : 1;
  const wild = rng() < 0.28 - 0.2 * skill;
  const x = side * (wild ? 0.97 + rng() * 0.2 : 0.3 + rng() * 0.6);
  const y = wild ? 0.7 + rng() * 0.5 : 0.15 + rng() * 0.7;
  return { at: kickStart + KICK_LOCK_MS + 1100 + rng() * 900, x, y };
}
