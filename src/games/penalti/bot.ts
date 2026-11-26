import { botRng } from "../shared/solo";
import { KICK_LOCK_MS, POWER_HALF, POWER_LOCK_MS, POWER_PERIOD_MS, POWER_SWEET } from "./logic";

/** Güç çubuğunun yükselirken `power` değerine geldiği an (nişandan sonra geçen süre). */
export const powerTime = (power: number) => POWER_LOCK_MS + (power / 2) * POWER_PERIOD_MS;

/**
 * Rakibin penaltısı: bir köşeye nişan alır, sonra güç çubuğunu yeşilin çevresinde durdurur. Beceri
 * düştükçe nişan direğe yaklaşır ve güç yeşilden kaçar (zayıf vuruş ya da auta giden sert vuruş).
 */
export function botKick(seed: number, key: string, skill: number, kickStart: number) {
  const rng = botRng(seed, `sut:${key}`);
  const side = rng() < 0.5 ? -1 : 1;
  const x = side * (0.42 + rng() * (0.42 + 0.08 * (1 - skill)));
  const y = 0.15 + rng() * 0.6;
  const spread = POWER_HALF * (2.4 - 1.6 * skill);
  const power = Math.min(0.98, Math.max(0.05, POWER_SWEET + (rng() - 0.5) * 2 * spread));
  const aimAt = kickStart + KICK_LOCK_MS + 900 + rng() * 700;
  return { aimAt, x, y, kickAt: aimAt + powerTime(power) };
}
