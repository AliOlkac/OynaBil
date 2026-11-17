import { BALL_X, BALL_Y, type Third } from "../logic";

/**
 * Penaltı sahnesinin üç boyutlu ölçüleri (metre). Kale çizgisi z=0'dadır, saha +z yönündedir;
 * kamera sahadan kaleye bakar, +x ekranın sağıdır, +y yukarıdır.
 *
 * Oyun mantığı kale koordinatı kullanır (x: -1 sol direk, +1 sağ direk; y: 0 zemin, 1 üst direk).
 * Kale gerçek ölçüsündedir (7,32 x 2,44 m), yani tam 3'e 1.
 */

export type V3 = { x: number; y: number; z: number };

export const GOAL_HALF = 3.66;
export const GOAL_H = 2.44;
export const POST_R = 0.06;
/** Topun yarıçapı, mantıktaki direk payıyla aynıdır: direğe değen top gerçekten direğe değer. */
export const BALL_R = BALL_X * GOAL_HALF;
export const NET_DEPTH_TOP = 0.9;
export const NET_DEPTH_BOTTOM = 2.0;

export const SPOT: V3 = { x: 0, y: BALL_R, z: 11 };
export const KEEPER_Z = 0.4;
/** Kalecinin dik dururken kalça yüksekliği ve kalçadan eldivene uzanabildiği mesafe. */
export const KEEPER_HIP_Y = 0.86;
export const KEEPER_REACH = 1.2;

/** Şutçular ceza sahasının iki yanında bekler; hak kazanan topun arkasına yürür. */
export const KICKER_HOME: [V3, V3] = [
  { x: -3.9, y: 0, z: 13.2 },
  { x: 3.9, y: 0, z: 13.2 },
];
export const KICKER_READY: V3 = { x: -1.15, y: 0, z: 12.9 };
/** Vuruş anında destek ayağı topun yanındadır. */
export const KICKER_STRIKE: V3 = { x: -0.34, y: 0, z: 11.42 };

/** Reklam panoları ve tribün (kale arkası). */
export const BOARD_Z = -6.4;
export const BOARD_H = 1.05;
export const STAND_Z = -8.2;
export const STAND_BASE_Y = 1.35;
export const STAND_RISE = 0.58;

export const goalToWorld = (gx: number, gy: number): V3 => ({ x: gx * GOAL_HALF, y: gy * GOAL_H, z: 0 });
export const worldToGoal = (x: number, y: number) => ({ x: x / GOAL_HALF, y: y / GOAL_H });

/** Ağın arka yüzünün kale çizgisinden uzaklığı; yukarı çıktıkça azalır. */
export function netDepthAt(y: number): number {
  const t = Math.max(0, Math.min(1, y / GOAL_H));
  return NET_DEPTH_BOTTOM + (NET_DEPTH_TOP - NET_DEPTH_BOTTOM) * t;
}

/** Tribün yüzeyinin verilen derinlikteki yüksekliği. */
export const standHeightAt = (z: number) => STAND_BASE_Y + Math.max(0, STAND_Z - z) * STAND_RISE;

/** Kalecinin atladığı yer (kurtaramadığı şutlarda kendi seçtiği üçlüde bir nokta). */
export function guessPoint(third: Third, height: number): { x: number; y: number } {
  const gx = third === "sol" ? -0.62 : third === "sag" ? 0.62 : 0;
  return { x: gx * GOAL_HALF, y: height * GOAL_H };
}

/** Top üst direğe mi çarptı (yan direğe değil)? */
export const hitsBar = (gx: number, gy: number) => gy > 1 - BALL_Y && Math.abs(gx) <= 1 - BALL_X;
