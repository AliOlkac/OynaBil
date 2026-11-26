import { byDifficulty, type Difficulty } from "../shared/difficulty";
import { botRng } from "../shared/solo";
import { AIM_LOCK_MS, DRAW_MS, hitPoint, releaseAim, WIND_STEPS, type Point, type Wind } from "./logic";

/**
 * Rakibin atışı: yayı gerer, nişanı rüzgâra karşı kaydırır (beceri düştükçe payı yanlış kestirir), sonra
 * sallantı hedefin ortasına yeterince yaklaşınca bırakır. Uygun an gelmezse yorulmadan bırakır.
 */
export function botShot(seed: number, key: string, skill: number, aimStart: number, wind: Wind, d: Difficulty): { drawAt: number; at: number; aim: Point } {
  const rng = botRng(seed, `ok:${key}`);
  const misjudge = (rng() - 0.5) * 2 * (0.35 - 0.3 * skill);
  const aim = { x: -wind * byDifficulty(d, WIND_STEPS) * (1 + misjudge), y: (rng() - 0.5) * 0.2 * (1 - skill) };
  const drawAt = aimStart + AIM_LOCK_MS + 500 + rng() * 900;
  const within = 0.36 - 0.26 * skill + rng() * 0.1;
  for (let t = DRAW_MS + 200 + rng() * 400; t < DRAW_MS + 3500; t += 16) {
    const p = hitPoint(releaseAim(aim, t, d), wind, d);
    if (Math.hypot(p.x, p.y) < within) return { drawAt, at: drawAt + t, aim };
  }
  return { drawAt, at: drawAt + DRAW_MS + 3500, aim };
}
