/**
 * Sahnelerdeki çocukların ortak iskelet geometrisi. Saf matematik: çizim ve zaman içermez.
 *
 * Yerel koordinatlar: ayakların ortası (0,0), yukarı -y, çocuk +x yönüne bakar.
 * Halat Çekme'de ipi çeken, Kule Yıkmaca'da mancınığı kuran çocuklar bu ölçüleri paylaşır.
 */

export type Vec = { x: number; y: number };

export const LEG = 60;
export const TORSO = 50;
export const UPPER_ARM = 32;
export const FOREARM = 32;
export const HEAD_R = 17;

export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const scale = (a: Vec, s: number): Vec => ({ x: a.x * s, y: a.y * s });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const len = (a: Vec) => Math.hypot(a.x, a.y);
/** Açı kadar geriye yatmış "yukarı" yönü. */
export const up = (angle: number): Vec => ({ x: -Math.sin(angle), y: -Math.cos(angle) });

/** İki kemikli ters kinematik: dirsek aşağı doğru kırılır. Ulaşılamayan hedefe kol uzanır. */
export function reach(shoulder: Vec, target: Vec, a = UPPER_ARM, b = FOREARM): { elbow: Vec; hand: Vec } {
  const delta = sub(target, shoulder);
  const dist = Math.min(len(delta), a + b - 0.5);
  const dir = len(delta) > 0 ? scale(delta, 1 / len(delta)) : { x: 1, y: 0 };
  const hand = add(shoulder, scale(dir, dist));
  const cos = (a * a + dist * dist - b * b) / (2 * a * dist);
  const angle = Math.acos(Math.max(-1, Math.min(1, cos)));
  // Dirsek, omuz-el çizgisinin altına (ekranda +y) kırılır.
  const sign = dir.x >= 0 ? 1 : -1;
  const rot = { x: dir.x * Math.cos(angle) - dir.y * Math.sin(angle) * sign, y: dir.x * Math.sin(angle) * sign + dir.y * Math.cos(angle) };
  return { elbow: add(shoulder, scale(rot, a)), hand };
}

/** Diz, kalça-ayak çizgisinin ortasından öne (+x) doğru `bend` kadar kırılır. */
export function knee(hip: Vec, foot: Vec, bend: number): Vec {
  const mid = scale(add(hip, foot), 0.5);
  const d = sub(foot, hip);
  const l = len(d) || 1;
  const normal = { x: -d.y / l, y: d.x / l };
  const n = normal.x < 0 ? scale(normal, -1) : normal;
  return add(mid, scale(n, bend));
}

export const fmt = (v: Vec) => `${v.x.toFixed(1)} ${v.y.toFixed(1)}`;
