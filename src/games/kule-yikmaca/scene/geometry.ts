import type { Vec } from "../../shared/skeleton";
import { BANDS, type Shot } from "../logic";

/**
 * Kule Yıkmaca sahnesinin dünya ölçüleri. Saf geometri: çizim de, motor da buradan beslenir.
 * Kulenin bölgeleri oyun mantığındaki `BANDS` sınırlarından çizilir; nişangâh pencerenin
 * hizasındaysa taş da gerçekten pencereye çarpar.
 */

export const GROUND = 760;
/** Nişangâhın taradığı yükseklik (dünya birimi). */
export const RANGE = 600;
/** Nişangâh 0: kulenin önündeki toprak. */
export const Y0 = GROUND + BANDS[0].to * RANGE;
export const yOf = (p: number) => Y0 - p * RANGE;

const edge = (i: number) => yOf(BANDS[i].to);
/** Bölge sınırları: temel, gövde, pencere, gövde, burç, külah. */
export const Y_BASE_TOP = edge(1);
export const Y_WINDOW_BOTTOM = edge(2);
export const Y_WINDOW_TOP = edge(3);
export const Y_BODY_TOP = edge(4);
export const Y_ROOF_BASE = edge(5);
export const Y_APEX = edge(6);
/** Burcun taşkın rafı ile mazgallar arası. */
export const Y_PARAPET = Y_BODY_TOP - 26;

export const BASE_HALF = 96;
export const BODY_HALF = 74;
export const PARAPET_HALF = 90;
export const ROOF_HALF = 88;

/** Kuleler sahanın iki ucunda; mancınıklar kendi kulelerinin önünde, karşı kuleden uzakta. */
export const TOWER_X: [number, number] = [180, 2020];
export const CATAPULT_X: [number, number] = [480, 1720];
export const CENTER = (TOWER_X[0] + TOWER_X[1]) / 2;
/** Çizilen dünyanın yatay sınırları; kamera bunların dışına çıkmaz. */
export const WORLD_LEFT = -1600;
export const WORLD_RIGHT = 3800;
/** Soldaki takımın ileri yönü +x, sağdakinin -x. */
export const dirOf = (side: 0 | 1) => (side === 0 ? 1 : -1);

/** Kulenin verilen yükseklikteki yarım genişliği. */
export function halfWidthAt(y: number): number {
  if (y > Y_BASE_TOP) return BASE_HALF;
  if (y > Y_BODY_TOP) return BODY_HALF;
  if (y > Y_ROOF_BASE) return PARAPET_HALF;
  if (y >= Y_APEX) return (ROOF_HALF * (y - Y_APEX)) / (Y_ROOF_BASE - Y_APEX);
  return 0;
}

// ---- mancınık (yerel: yer ortası 0,0; +x ileri) ----
export const PIVOT: Vec = { x: 10, y: -64 };
export const ARM_LEN = 128;
/** Kolun açısı (derece, ileriden saat yönünün tersine): dinlenirken kasnağa yaslı, kurulunca geride. */
export const ARM_REST = 78;
export const ARM_COCKED = 185;
export const ARM_RELEASE = 105;
export const DRUM: Vec = { x: -74, y: -46 };
export const CRANK_R = 18;
export const PILE: Vec = { x: -150, y: 0 };

export function armTip(angleDeg: number, length = ARM_LEN): Vec {
  const a = (angleDeg * Math.PI) / 180;
  return { x: PIVOT.x + Math.cos(a) * length, y: PIVOT.y - Math.sin(a) * length };
}

/** Yerel bir noktayı dünyaya taşır. */
export function catapultToWorld(side: 0 | 1, p: Vec, recoil = 0): Vec {
  const d = dirOf(side);
  return { x: CATAPULT_X[side] + d * (p.x + recoil), y: GROUND + p.y };
}

// ---- uçuş ----
export type Flight = {
  from: Vec;
  to: Vec;
  /** Parabolün geçtiği ara nokta. */
  via: Vec;
  duration: number;
  end: "tower" | "short" | "long";
};

/** Atışın uçuş yolu: taş kepçeden çıkar, isabet yüksekliğine göre kuleye, önüne ya da arkasına düşer. */
export function flightFor(shot: Pick<Shot, "side" | "hit" | "zone">): Flight {
  const side = shot.side;
  const d = dirOf(side);
  const target = (1 - side) as 0 | 1;
  const tx = TOWER_X[target];
  const from = catapultToWorld(side, armTip(ARM_RELEASE));
  let to: Vec;
  let end: Flight["end"];
  let via: Vec | null = null;
  if (shot.zone === "kisa") {
    const shortBy = Math.min(1, Math.max(0, (BANDS[0].to - shot.hit) / 0.3));
    to = { x: tx - d * (BASE_HALF + 40 + shortBy * 240), y: GROUND + 10 };
    end = "short";
  } else if (shot.zone === "uzun") {
    const overBy = Math.min(1, Math.max(0, (shot.hit - BANDS[6].to) / 0.3));
    to = { x: tx + d * (190 + overBy * 200), y: GROUND + 6 };
    // Taş, çatının ve bayrağın üstünden geçer.
    via = { x: tx, y: Math.min(yOf(shot.hit), Y_APEX - 70) };
    end = "long";
  } else {
    const y = yOf(shot.hit);
    to = { x: tx - d * halfWidthAt(y), y };
    end = "tower";
  }
  if (!via) {
    const dx = Math.abs(to.x - from.x);
    via = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 200 - dx * 0.12 };
  }
  const duration = 1.1 + Math.abs(to.x - from.x) / 3500 + (end === "long" ? 0.15 : 0);
  return { from, to, via, duration, end };
}

/** Üç noktadan geçen parabolün x'teki yüksekliği (Lagrange). */
export function parabolaY(f: Pick<Flight, "from" | "via" | "to">, x: number): number {
  const { from: a, via: b, to: c } = f;
  const l0 = ((x - b.x) * (x - c.x)) / ((a.x - b.x) * (a.x - c.x));
  const l1 = ((x - a.x) * (x - c.x)) / ((b.x - a.x) * (b.x - c.x));
  const l2 = ((x - a.x) * (x - b.x)) / ((c.x - a.x) * (c.x - b.x));
  return a.y * l0 + b.y * l1 + c.y * l2;
}

/** Uçuşun u (0..1) anındaki konumu: yatayda sabit hız, dikeyde parabol. */
export function flightAt(f: Flight, u: number): Vec {
  const x = f.from.x + (f.to.x - f.from.x) * u;
  return { x, y: parabolaY(f, x) };
}
