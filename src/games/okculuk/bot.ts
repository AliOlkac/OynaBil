import type { Difficulty } from "../shared/difficulty";
import { botRng } from "../shared/solo";
import { AIM_LOCK_MS, DRAW_MS, hitPoint, releaseAim, type Wind } from "./logic";

/**
 * Rakibin atışı: yayı gerer (`drawAt`), nişangâh (rüzgâr payıyla) hedefin ortasına yeterince yaklaşınca
 * bırakır (`at`). Beceri arttıkça daha iyi bir an bekler; uygun an gelmezse 4 saniye sonra bırakır.
 */
export function botShot(seed: number, key: string, skill: number, aimStart: number, wind: Wind, d: Difficulty): { drawAt: number; at: number } {
  const rng = botRng(seed, `ok:${key}`);
  const within = 0.46 - 0.32 * skill + rng() * 0.12;
  const drawAt = aimStart + AIM_LOCK_MS + 500 + rng() * 900;
  for (let t = DRAW_MS + 100 + rng() * 600; t < DRAW_MS + 4000; t += 16) {
    const p = hitPoint(releaseAim(t, d), wind, d);
    if (Math.hypot(p.x, p.y) < within) return { drawAt, at: drawAt + t };
  }
  return { drawAt, at: drawAt + DRAW_MS + 4000 };
}
