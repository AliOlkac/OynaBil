/**
 * Halat çeken çocuğun iskeleti. Saf geometri: bir duruş (poz) alır, çizilecek noktaları döner.
 *
 * Yerel koordinatlar: ayakların ortası (0,0), yukarı -y, çocuk +x yönüne (ipe, merkeze) bakar.
 * Sağdaki takım aynı iskeleti aynalanmış çizer.
 */

import { add, FOREARM, HEAD_R, knee, LEG, reach, scale, TORSO, UPPER_ARM, up, type Vec } from "../../shared/skeleton";

export { fmt, FOREARM, HEAD_R, LEG, reach, TORSO, UPPER_ARM, type Vec } from "../../shared/skeleton";

export type Pose = {
  /** Geriye yaslanma açısı (radyan). 0 dik, ~0.55 asılmış, negatif öne düşme. */
  lean: number;
  /** İpin yerel yüksekliği (negatif, ayağa göre). null: eller ipte değil. */
  ropeY: number | null;
  /** 0..1: kollar havada sevinç. */
  armsUp: number;
  /** Adım: ayaklar geriye kayar (çekiş anı). */
  step: number;
};

export type Skeleton = {
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

export function solve(pose: Pose): Skeleton {
  const stance = 21 + pose.step * 4;
  const footBack = { x: -stance - pose.step * 6, y: 0 };
  const footFront = { x: stance - pose.step * 6, y: 0 };
  const legLean = pose.lean * 0.72;
  const hip = add({ x: -pose.step * 6, y: 0 }, scale(up(legLean), LEG));
  const shoulder = add(hip, scale(up(pose.lean), TORSO));
  // Baş ileri, ipe doğru bakar; çekerken çene öne çıkar.
  const headAngle = pose.lean * 0.7;
  const head = add(add(shoulder, scale(up(pose.lean * 0.85), HEAD_R + 6)), { x: 3, y: 0 });

  let handFar: Vec;
  let handNear: Vec;
  let elbowFar: Vec;
  let elbowNear: Vec;
  if (pose.ropeY !== null && pose.armsUp < 0.5) {
    // İki el ipte, biri diğerinin biraz önünde. Kol neredeyse gergin: ipe asılmış.
    const dy = pose.ropeY - shoulder.y;
    const dx = Math.sqrt(Math.max(0, (UPPER_ARM + FOREARM) ** 2 * 0.9 - dy * dy));
    const front = reach(shoulder, { x: shoulder.x + dx, y: pose.ropeY });
    const back = reach(shoulder, { x: front.hand.x - 13, y: pose.ropeY });
    handNear = front.hand;
    elbowNear = front.elbow;
    handFar = back.hand;
    elbowFar = back.elbow;
  } else {
    // Kollar yukarıda (sevinç) ya da serbest (düşerken).
    const lift = pose.armsUp;
    const free = (side: number) => {
      const target = add(shoulder, { x: 18 + side * 10, y: 40 - lift * 100 });
      return reach(shoulder, target);
    };
    const near = free(1);
    const far = free(-1);
    handNear = near.hand;
    elbowNear = near.elbow;
    handFar = far.hand;
    elbowFar = far.elbow;
  }

  return {
    footBack,
    footFront,
    kneeBack: knee(hip, footBack, 6 + pose.lean * 6),
    kneeFront: knee(hip, footFront, 9 + pose.lean * 10),
    hip,
    shoulder,
    head,
    headAngle,
    elbowFar,
    handFar,
    elbowNear,
    handNear,
  };
}

