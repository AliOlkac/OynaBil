import type { Vec } from "../../shared/skeleton";
import type { Third } from "../logic";

/**
 * Penaltı sahnesinin ölçüleri. Kamera topun arkasından kaleye bakar; kale ağzı ekrana paraleldir.
 * Kale koordinatı (x: -1 sol direk, +1 sağ direk; y: 0 zemin, 1 üst direk) ile dünya arasında çeviri yapar.
 */

export const GOAL_CX = 800;
export const GOAL_HALF = 360;
export const GOAL_BOTTOM = 640;
export const GOAL_H = 240;
export const GOAL_TOP = GOAL_BOTTOM - GOAL_H;
export const POST = 12;
/** Ağın arka yüzü: kale ağzından biraz küçük ve yukarıda, derinlik hissi için. */
export const NET_BACK = { left: 486, right: 1114, top: 430, bottom: 626 };

export const SPOT: Vec = { x: 800, y: 845 };
export const BALL_NEAR = 30;
export const BALL_FAR = 16;

export const KEEPER_HIP: Vec = { x: 800, y: 556 };
/** Kalecinin kalçasından eldivenlerine uzanabildiği mesafe (kollar başın üstünde). */
export const KEEPER_REACH = 124;

/** Şutçular sahanın ön köşelerinde bekler; hak kazanan topun arkasına koşar. */
export const KICKER_HOME: [Vec, Vec] = [
  { x: 290, y: 1000 },
  { x: 1310, y: 1000 },
];
export const KICKER_READY: Vec = { x: 690, y: 968 };
export const KICKER_STRIKE: Vec = { x: 752, y: 906 };

export const WORLD_LEFT = -1200;
export const WORLD_RIGHT = 2800;

export const toScreen = (x: number, y: number): Vec => ({ x: GOAL_CX + x * GOAL_HALF, y: GOAL_BOTTOM - y * GOAL_H });
export const toGoal = (p: Vec): { x: number; y: number } => ({ x: (p.x - GOAL_CX) / GOAL_HALF, y: (GOAL_BOTTOM - p.y) / GOAL_H });

/** Kale ağzındaki bir noktanın ağın arka yüzündeki karşılığı (gol olunca ağ orada esner). */
export function toNetBack(p: Vec): Vec {
  const fx = (p.x - (GOAL_CX - GOAL_HALF)) / (GOAL_HALF * 2);
  const fy = (p.y - GOAL_TOP) / GOAL_H;
  return { x: NET_BACK.left + fx * (NET_BACK.right - NET_BACK.left), y: NET_BACK.top + fy * (NET_BACK.bottom - NET_BACK.top) };
}

/** Topun uçuşu: u=0 penaltı noktası, u=1 kale ağzı. Uzaklaştıkça küçülür, hafif bir yay çizer. */
export function ballAt(target: Vec, u: number): { p: Vec; r: number; ground: Vec } {
  const e = 1 - (1 - Math.min(1, u)) ** 1.35;
  const lift = Math.sin(Math.PI * Math.min(1, u)) * 26;
  const p = { x: SPOT.x + (target.x - SPOT.x) * e, y: SPOT.y + (target.y - SPOT.y) * e - lift };
  const r = BALL_NEAR + (BALL_FAR - BALL_NEAR) * Math.min(1, u);
  const ground = { x: p.x, y: SPOT.y + 14 + (GOAL_BOTTOM + 4 - SPOT.y - 14) * e };
  return { p, r, ground };
}

/** Kalecinin atladığı yer (kurtarışta topun yeri, değilse kendi seçtiği üçlüde bir nokta). */
export function guessPoint(third: Third, height: number): Vec {
  const x = third === "sol" ? -0.62 : third === "sag" ? 0.62 : 0;
  return toScreen(x, height);
}

/**
 * Kalecinin uçuşu: eldivenlerin `target`a ulaşması için kalçanın nerede ve gövdenin ne kadar
 * yatık olması gerektiği. Açı dikeyden, saat yönünde pozitif (radyan).
 */
export function divePose(target: Vec): { hip: Vec; angle: number } {
  const dx = target.x - KEEPER_HIP.x;
  const dy = target.y - KEEPER_HIP.y;
  // Ortaya gelen top için atlamaz, yerinde uzanır ya da zıplar.
  if (Math.abs(dx) < 150) {
    const angle = Math.max(-0.35, Math.min(0.35, dx / 420));
    return { hip: { x: target.x - Math.sin(angle) * KEEPER_REACH, y: Math.min(KEEPER_HIP.y + 40, target.y + Math.cos(angle) * KEEPER_REACH) }, angle };
  }
  let angle = Math.atan2(dx, -dy);
  const limit = (100 * Math.PI) / 180;
  angle = Math.max(-limit, Math.min(limit, angle));
  return { hip: { x: target.x - Math.sin(angle) * KEEPER_REACH, y: target.y + Math.cos(angle) * KEEPER_REACH }, angle };
}
