import { BOSS_R, type Shot, type ShotResult } from "./logic";

/**
 * Okçuluk sahnesinin ölçüleri (metre) ve okun zaman çizelgesi. Saf hesap, three.js içermez; 3D sahne de
 * çizim sahnesi de okun yerini buradan okur, ağır çekim tekrar da aynı fonksiyonu oynatır.
 *
 * Atış çizgisi z = 0'dadır, hedef -z yönünde TARGET_D metre ileride durur; +y yukarı, +x sağ.
 * Hedef yüzünün yarıçapı FACE_R'dir; oyun mantığındaki nişan koordinatı (yarıçap 1) bununla ölçeklenir.
 */

export type V3 = { x: number; y: number; z: number };

export const TARGET_D = 14;
export const TARGET_Y = 1.3;
export const FACE_R = 0.5;
/** Hedefin önündeki yüzün z'si (saman tabanın kalınlığı kadar öne). */
export const FACE_Z = -TARGET_D + 0.16;
export const ARROW_LEN = 0.66;
/** Okun yayı terk ettiği yer: okçunun çenesinin hizası, atış çizgisinin biraz önü. */
export const NOCK: V3 = { x: 0, y: 1.17, z: -0.2 };
/** Uçuş süresi (saniye): okul okçuluğunda ok saniyede ~30 m gider. */
export const FLIGHT = 0.48;
/** Hedefi bulmayan ok hedefin bu kadar arkasında çimene saplanır. */
const OVERSHOOT = 4.5;

/** Nişan koordinatını (yarıçap 1) hedef yüzündeki dünya noktasına çevirir. */
export function facePoint(p: { x: number; y: number }, z = FACE_Z): V3 {
  return { x: p.x * FACE_R, y: TARGET_Y + p.y * FACE_R, z };
}

export type ArrowEvent = { t: number; kind: "release" | "target" | "boss" | "ground" };

export type ArrowPlan = {
  result: ShotResult;
  /** Ok hedefe (yüz ya da saman taban) saplanır mı. */
  sticks: boolean;
  from: V3;
  to: V3;
  /** Yayın tepesinin yüksekliği (düz çizgiye göre). */
  arc: number;
  /** Okun saplandığı an. */
  hitAt: number;
  events: ArrowEvent[];
  /** Gösterinin bittiği an. */
  end: number;
  /** Tekrar gösteriminin ilgilendiği aralık. */
  replay: { from: number; to: number };
};

export function planArrow(shot: Pick<Shot, "hit" | "result">): ArrowPlan {
  const r = Math.hypot(shot.hit.x, shot.hit.y);
  const sticks = r < BOSS_R;
  let to: V3;
  let hitAt = FLIGHT;
  if (sticks) {
    // Ok ucunun bir kısmı tabana gömülür.
    to = facePoint(shot.hit, FACE_Z - 0.12);
  } else {
    // Hedefin yanından geçer, arkadaki çimene eğik saplanır.
    const k = (TARGET_D + OVERSHOOT) / TARGET_D;
    const p = facePoint(shot.hit);
    to = { x: p.x * k, y: 0.05, z: -(TARGET_D + OVERSHOOT) };
    hitAt = FLIGHT * k * 1.05;
  }
  const kind: ArrowEvent["kind"] = !sticks ? "ground" : r < 1 ? "target" : "boss";
  return {
    result: shot.result,
    sticks,
    from: NOCK,
    to,
    arc: sticks ? 0.28 : 0.4,
    hitAt,
    events: [
      { t: 0, kind: "release" },
      { t: hitAt, kind },
    ],
    end: hitAt + 1.3,
    replay: { from: -0.12, to: hitAt + 0.45 },
  };
}

/** Okun `t` anındaki ucu ve yönü (birim vektör, uçuş yönünde). `t < 0` yaydadır. */
export function arrowAt(plan: ArrowPlan, t: number, pos: V3, dir: V3): V3 {
  const u = Math.max(0, Math.min(1, t / plan.hitAt));
  const { from: a, to: b } = plan;
  pos.x = a.x + (b.x - a.x) * u;
  pos.z = a.z + (b.z - a.z) * u;
  // Yerçekimi yayı: ortada en yüksek. Çimene düşen ok sonda daha dik iner.
  const lift = 4 * plan.arc * u * (1 - u);
  pos.y = a.y + (b.y - a.y) * (plan.sticks ? u : u * u) + lift;
  const du = 0.001;
  const u2 = Math.min(1, u + du);
  const u1 = u2 - du;
  const yAt = (v: number) => a.y + (b.y - a.y) * (plan.sticks ? v : v * v) + 4 * plan.arc * v * (1 - v);
  dir.x = (b.x - a.x) * du;
  dir.z = (b.z - a.z) * du;
  dir.y = yAt(u2) - yAt(u1);
  const n = Math.hypot(dir.x, dir.y, dir.z) || 1;
  dir.x /= n;
  dir.y /= n;
  dir.z /= n;
  return pos;
}

/** Saplanan okun titreşimi: saplandıktan sonra hızla sönen bir salınım (radyan). */
export function quiver(plan: ArrowPlan, t: number): number {
  const s = t - plan.hitAt;
  if (s <= 0) return 0;
  return Math.sin(s * 55) * 0.09 * Math.exp(-s * 5);
}

/** Okçunun hareketi: yay gerilir (0..1), bırakınca kol geri savrulur. `t` bırakıştan bu yana (negatif: gerilirken). */
export function archerAt(drawn: number, t: number): { draw: number; follow: number } {
  if (t < 0) return { draw: drawn, follow: 0 };
  return { draw: 0, follow: Math.min(1, t / 0.12) * Math.exp(-Math.max(0, t - 0.12) * 2.2) };
}

export const RESULT_TEXT: Record<ShotResult, { title: string; detail: string }> = {
  onluk: { title: "Tam on ikiden!", detail: "Sarının tam ortası" },
  dokuz: { title: "Dokuz!", detail: "Sarı halka" },
  iyi: { title: "Kırmızı halka", detail: "Ortaya çok yakın" },
  orta: { title: "Mavi halka", detail: "Hedefte, ortadan uzak" },
  kotu: { title: "Kenardan", detail: "Hedefin dış halkası" },
  iska: { title: "Iska!", detail: "Ok hedefi bulamadı" },
};

/** Halka renkleri dıştan içe: beyaz, siyah, mavi, kırmızı, sarı (her renk iki halka). */
export const RING_COLORS = ["var(--color-cream)", "var(--color-ink-950)", "var(--color-kobalt)", "var(--color-mercan)", "var(--color-kehribar)"] as const;
