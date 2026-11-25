import type { Difficulty } from "../shared/difficulty";
import { botRng } from "../shared/solo";
import { AIM_LOCK_MS, hitPoint, sightAt, type Wind } from "./logic";

/**
 * Rakibin oku bıraktığı an: nişangâh (rüzgâr payıyla) hedefin ortasına yeterince yaklaşınca. Beceri
 * arttıkça daha iyi bir an bekler; uygun an gelmezse 6 saniye sonra bırakır.
 */
export function botReleaseAt(seed: number, key: string, skill: number, aimStart: number, wind: Wind, d: Difficulty): number {
  const rng = botRng(seed, `ok:${key}`);
  const within = 0.46 - 0.32 * skill + rng() * 0.12;
  const from = AIM_LOCK_MS + 900 + rng() * 1500;
  for (let t = from; t < from + 6000; t += 16) {
    const p = hitPoint(sightAt(t, d), wind, d);
    if (Math.hypot(p.x, p.y) < within) return aimStart + t;
  }
  return aimStart + from + 6000;
}
