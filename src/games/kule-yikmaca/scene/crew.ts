import { add, HEAD_R, knee, LEG, reach, scale, TORSO, up, type Vec } from "../../shared/skeleton";

/**
 * Mancınık ekibindeki çocuğun duruşu. Halat Çekme ile aynı ölçüler; ayakta duran, çömelen,
 * kolunu bir hedefe uzatan, sevinen ve başını koruyan çocuk için tek bir çözücü.
 *
 * Yerel koordinatlar: ayakların ortası (0,0), yukarı -y, çocuk +x yönüne bakar.
 */

export type CrewPose = {
  /** Öne eğilme (radyan); negatif geriye yaslanma. */
  lean: number;
  /** 0 dik, 1 çömelmiş. */
  crouch: number;
  /** Ellerin hedefi (yerel); null: kol serbest sarkar. */
  near: Vec | null;
  far: Vec | null;
  /** 0..1 kollar havada. */
  armsUp: number;
  /** 0..1 eller başın üstünde: korunma ya da üzülme. */
  cover: number;
};

export type CrewSkeleton = {
  footBack: Vec;
  footFront: Vec;
  kneeBack: Vec;
  kneeFront: Vec;
  hip: Vec;
  shoulder: Vec;
  head: Vec;
  headAngle: number;
  elbowFar: Vec;
  handFar: Vec;
  elbowNear: Vec;
  handNear: Vec;
};

export const STAND: CrewPose = { lean: 0.04, crouch: 0, near: null, far: null, armsUp: 0, cover: 0 };

const mix = (a: Vec, b: Vec, t: number): Vec => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

export function solveCrew(p: CrewPose): CrewSkeleton {
  const footBack = { x: -14, y: 0 };
  const footFront = { x: 14, y: 0 };
  const hip = { x: -p.crouch * 10, y: -LEG * (1 - 0.4 * p.crouch) };
  const shoulder = add(hip, scale(up(-p.lean), TORSO));
  const head = add(add(shoulder, scale(up(-p.lean * 0.8), HEAD_R + 6)), { x: 2, y: 0 });

  const arm = (target: Vec | null, side: number) => {
    let t = target ?? add(shoulder, { x: 6 + side * 4, y: 60 });
    if (p.armsUp > 0) t = mix(t, add(shoulder, { x: 12 + side * 12, y: -60 }), p.armsUp);
    if (p.cover > 0) t = mix(t, add(head, { x: 4 + side * 9, y: -14 }), p.cover);
    return reach(shoulder, t);
  };
  const near = arm(p.near, 1);
  const far = arm(p.far, -1);

  return {
    footBack,
    footFront,
    kneeBack: knee(hip, footBack, 4 + p.crouch * 22),
    kneeFront: knee(hip, footFront, 5 + p.crouch * 28),
    hip,
    shoulder,
    head,
    headAngle: -p.lean * 0.6 - p.cover * 0.25,
    elbowFar: far.elbow,
    handFar: far.hand,
    elbowNear: near.elbow,
    handNear: near.hand,
  };
}
