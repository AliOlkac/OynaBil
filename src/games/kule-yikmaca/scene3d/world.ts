import { BANDS, type Shot } from "../logic";
import { RANGE as SVG_RANGE, Y0 as SVG_Y0 } from "../scene/geometry";

/**
 * Kule Yıkmaca'nın üç boyutlu sahnesinin ölçüleri (metre) ve atışın yolu. Saf geometri, three.js içermez.
 *
 * Saha x ekseni boyunca uzanır: soldaki takımın kulesi -x, sağdakinin +x ucundadır; +y yukarı,
 * kamera +z tarafındadır. Kulenin bölgeleri oyun mantığındaki `BANDS` sınırlarından kurulur:
 * nişangâh pencerenin hizasındaysa taş gerçekten pencereye çarpar.
 */

export type V3 = { x: number; y: number; z: number };

/** Nişangâh ölçeğinin tamamı (0..1) kaç metre eder. */
export const RANGE = 12;
/** Nişangâh değerinin yerden yüksekliği; 0.12'nin altı toprağın altıdır (kısa düşen atış). */
export const heightOf = (p: number) => (p - BANDS[0].to) * RANGE;
/** Çizim sahnesinin (SVG) y değerini metreye çevirir: hasar cetveli iki sahnede aynı veriden çizilir. */
export const heightOfSvgY = (y: number) => heightOf((SVG_Y0 - y) / SVG_RANGE);

const edge = (i: number) => heightOf(BANDS[i].to);
export const H_BASE = edge(1);
export const H_WINDOW_BOTTOM = edge(2);
export const H_WINDOW_TOP = edge(3);
export const H_BODY_TOP = edge(4);
export const H_ROOF_BASE = edge(5);
export const H_APEX = edge(6);

export const R_BASE = 1.95;
export const R_BODY = 1.5;
export const R_PARAPET = 1.8;
export const R_ROOF = 1.9;

export const TOWER_X: [number, number] = [-18.4, 18.4];
export const CATAPULT_X: [number, number] = [-12.4, 12.4];
/** Soldaki takımın ileri yönü +x, sağdakinin -x. */
export const dirOf = (side: 0 | 1) => (side === 0 ? 1 : -1);

/** Kulenin verilen yükseklikteki yarıçapı (külahta sivrilir). */
export function radiusAt(y: number): number {
  if (y < H_BASE) return R_BASE;
  if (y < H_BODY_TOP) return R_BODY;
  if (y < H_ROOF_BASE) return R_PARAPET;
  if (y <= H_APEX) return (R_ROOF * (H_APEX - y)) / (H_APEX - H_ROOF_BASE);
  return 0;
}

// ---- mancınık (yerel: yer ortası 0,0; +x ileri, +y yukarı, +z kameraya doğru) ----
export const PIVOT = { x: 0.2, y: 1.28 };
export const ARM_LEN = 2.56;
/** Kolun açısı (derece, ileriden yukarı doğru): dinlenirken yastığa yaslı, kurulunca geride. */
export const ARM_REST = 78;
export const ARM_COCKED = 185;
export const ARM_RELEASE = 105;
export const DRUM = { x: -1.48, y: 0.92 };
export const CRANK_R = 0.26;
/** Vinç kolunun tutamağı mancınığın kamera tarafındadır. */
export const CRANK_Z = 0.86;
export const PILE = { x: -2.75, z: 0.5 };
export const STONE_R = 0.27;
/** Taş kepçenin içinde, kolun ucundan bu kadar içeride durur. */
const BUCKET_INSET = 0.2;
/** Ekip mancınığın kamera tarafında durur: kurucu vinçte, gözcü önde. */
export const CREW_SPOT = { kurucu: { x: -1.95, z: 0.92 }, gozcu: { x: 2.35, z: 1.25 } } as const;

export function armTip(angleDeg: number, length = ARM_LEN): { x: number; y: number } {
  const a = (angleDeg * Math.PI) / 180;
  return { x: PIVOT.x + Math.cos(a) * length, y: PIVOT.y + Math.sin(a) * length };
}

/** Kepçedeki taşın yeri: kolun ucunda, kepçenin açık yüzüne doğru. */
export function bucketPoint(angleDeg: number): { x: number; y: number } {
  const a = (angleDeg * Math.PI) / 180;
  const tip = armTip(angleDeg);
  return { x: tip.x + Math.sin(a) * BUCKET_INSET, y: tip.y - Math.cos(a) * BUCKET_INSET };
}

/** Mancınığın yerel bir noktasını dünyaya taşır. Sağdaki mancınık x ekseninde aynalıdır; ekip yine kamera tarafındadır. */
export function catapultToWorld(side: 0 | 1, p: { x: number; y: number }, recoil = 0, z = 0): V3 {
  return { x: CATAPULT_X[side] + dirOf(side) * (p.x + recoil), y: p.y, z };
}

// ---- uçuş ----
export type Flight = {
  from: V3;
  to: V3;
  /** Parabolün geçtiği ara nokta. */
  via: V3;
  duration: number;
  end: "tower" | "short" | "long";
  /** Iskalayan taşın yerde yuvarlanacağı mesafe. */
  roll: number;
};

/** Atışın yolu: taş kepçeden çıkar, isabet yüksekliğine göre kuleye, önüne ya da arkasına düşer. */
export function flightFor(shot: Pick<Shot, "side" | "hit" | "zone">): Flight {
  const side = shot.side;
  const d = dirOf(side);
  const tx = TOWER_X[(1 - side) as 0 | 1];
  const from = catapultToWorld(side, bucketPoint(ARM_RELEASE));
  let to: V3;
  let end: Flight["end"];
  let via: V3 | null = null;
  let roll = 2.4;
  if (shot.zone === "kisa") {
    const shortBy = Math.min(1, Math.max(0, (BANDS[0].to - shot.hit) / 0.3));
    const gap = 0.9 + shortBy * 4.8;
    to = { x: tx - d * (R_BASE + gap), y: STONE_R, z: 0 };
    // Kısa düşen taş kuleye doğru yuvarlanır ama temele girmez.
    roll = Math.min(roll, gap - 0.5);
    end = "short";
  } else if (shot.zone === "uzun") {
    const overBy = Math.min(1, Math.max(0, (shot.hit - BANDS[6].to) / 0.3));
    to = { x: tx + d * (6 + overBy * 4), y: STONE_R, z: 0 };
    // Taş, külahın ve bayrağın üstünden geçer.
    via = { x: tx, y: Math.max(heightOf(shot.hit), H_APEX + 1.9), z: 0 };
    end = "long";
  } else {
    const y = heightOf(shot.hit);
    to = { x: tx - d * (radiusAt(y) + STONE_R * 0.4), y, z: 0 };
    end = "tower";
  }
  if (!via) {
    const dx = Math.abs(to.x - from.x);
    via = { x: (from.x + to.x) / 2, y: Math.max(from.y, to.y) + 4 + dx * 0.12, z: 0 };
  }
  const duration = 1.1 + Math.abs(to.x - from.x) / 70 + (end === "long" ? 0.15 : 0);
  return { from, to, via, duration, end, roll };
}

/** Üç noktadan geçen parabolün x'teki yüksekliği (Lagrange). */
function parabolaY(f: Pick<Flight, "from" | "via" | "to">, x: number): number {
  const { from: a, via: b, to: c } = f;
  const l0 = ((x - b.x) * (x - c.x)) / ((a.x - b.x) * (a.x - c.x));
  const l1 = ((x - a.x) * (x - c.x)) / ((b.x - a.x) * (b.x - c.x));
  const l2 = ((x - a.x) * (x - b.x)) / ((c.x - a.x) * (c.x - b.x));
  return a.y * l0 + b.y * l1 + c.y * l2;
}

/** Uçuşun u (0..1) anındaki konumu: yatayda sabit hız, dikeyde parabol. */
export function flightAt(f: Flight, u: number, out: V3 = { x: 0, y: 0, z: 0 }): V3 {
  out.x = f.from.x + (f.to.x - f.from.x) * u;
  out.y = parabolaY(f, out.x);
  out.z = 0;
  return out;
}

/** Iskalayan taş yere düştükten `t` saniye sonra nerededir: birkaç kez seker, yuvarlanıp durur. */
export function rollAt(f: Flight, side: 0 | 1, t: number, out: V3 = { x: 0, y: 0, z: 0 }): V3 {
  out.x = f.to.x + dirOf(side) * f.roll * (1 - Math.exp(-1.7 * t));
  out.y = STONE_R + Math.abs(Math.sin(t * 7)) * 0.55 * Math.exp(-3.2 * t);
  out.z = 0;
  return out;
}

/** Tekrarlanabilir sözde rastgele sayı: aynı atış her açılışta aynı taşları aynı yere düşürür. */
export function seededRandom(seed: number) {
  let s = Math.imul(seed | 0, 0x9e3779b1) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 0x100000000;
  };
}

export const GRAVITY = 16;

/**
 * Düşen bir taşın yolu: `p0` noktasından `rest` noktasına `T` saniyede varan bir yay. Çözümlü olduğu
 * için her kare yeniden hesaplanır; fizik adımı ve taşların birbirine çarpması yoktur.
 */
export type Arc = { t0: number; T: number; p0: V3; rest: V3 };

/** @returns 0: henüz kopmadı, 0..1: havada, 1: yere indi. */
export function arcAt(a: Arc, time: number, out: V3): number {
  const t = time - a.t0;
  if (t <= 0) {
    out.x = a.p0.x;
    out.y = a.p0.y;
    out.z = a.p0.z;
    return 0;
  }
  if (t >= a.T) {
    // İnince küçük bir sekme, sonra durur.
    const since = t - a.T;
    out.x = a.rest.x;
    out.z = a.rest.z;
    out.y = a.rest.y + Math.abs(Math.sin(since * 14)) * 0.1 * Math.exp(-since * 7);
    return 1;
  }
  const k = t / a.T;
  // Dikeyde: iki ucu tutturan ve yerçekimiyle eğilen yol.
  const vy0 = (a.rest.y - a.p0.y + 0.5 * GRAVITY * a.T * a.T) / a.T;
  out.x = a.p0.x + (a.rest.x - a.p0.x) * k;
  out.z = a.p0.z + (a.rest.z - a.p0.z) * k;
  out.y = a.p0.y + vy0 * t - 0.5 * GRAVITY * t * t;
  return k;
}
