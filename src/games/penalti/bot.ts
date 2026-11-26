import { botRng } from "../shared/solo";
import { KICK_LOCK_MS, POWER_HALF, POWER_SWEET } from "./logic";
import type { Swipe } from "./swipe";

/**
 * Rakibin penaltısı: topun başına geçtikten biraz sonra bir köşeye doğru çizgi çizer. Beceri düştükçe
 * hedef direğe yaklaşır ve hız isabetli aralıktan kaçar (zayıf vuruş ya da auta giden sert vuruş);
 * becerikli rakip ara sıra falso da verir.
 */
export function botKick(seed: number, key: string, skill: number, kickStart: number): Swipe & { kickAt: number } {
  const rng = botRng(seed, `sut:${key}`);
  const side = rng() < 0.5 ? -1 : 1;
  const x = side * (0.42 + rng() * (0.42 + 0.08 * (1 - skill)));
  const y = 0.15 + rng() * 0.6;
  const spread = POWER_HALF * (2.4 - 1.6 * skill);
  const power = Math.min(0.98, Math.max(0.05, POWER_SWEET + (rng() - 0.5) * 2 * spread));
  const curve = rng() < skill * 0.5 ? (rng() - 0.5) * 1.2 : 0;
  return { kickAt: kickStart + KICK_LOCK_MS + 1400 + rng() * 1000, x, y, power, curve };
}
