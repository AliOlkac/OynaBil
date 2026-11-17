import type { Zone } from "../logic";
import { GRAVITY, H_APEX, H_BASE, H_BODY_TOP, H_ROOF_BASE, H_WINDOW_BOTTOM, H_WINDOW_TOP, R_BASE, R_BODY, R_PARAPET, type V3 } from "./world";

/**
 * Kulenin taşları ve yıkılışı. Saf hesap, three.js içermez.
 *
 * Kule sıra sıra örülmüş taşlardan kurulur. İsabet alan yerin taşları yerinden fırlar, kule yıkılınca
 * hepsi bir moloz yığınına dökülür. Taşların düşeceği yer ve süre önceden, tohumlu rastgelelikle
 * hesaplanır: aynı oyun yeniden açıldığında kule aynı hâliyle, molozu aynı yerde görünür.
 */

export type BlockPart = "base" | "body" | "cini" | "parapet" | "merlon";

/** Bir taşın kuledeki yeri (kule yerelinde): `yaw` taşın dışa bakan yüzünün açısı (+z'den +x'e doğru). */
export type BlockSpec = { part: BlockPart; x: number; y: number; z: number; yaw: number; w: number; h: number; d: number };

/** Taşlar arasındaki derz payı. */
const JOINT = 0.965;

function course(out: BlockSpec[], part: BlockPart, y0: number, h: number, radius: number, depth: number, count: number, offset: number, every = 1, widthK = 1) {
  const step = (Math.PI * 2) / count;
  const full = 2 * radius * Math.tan(Math.PI / count);
  for (let i = 0; i < count; i += every) {
    const yaw = (i + offset) * step;
    const r = radius - depth / 2;
    out.push({ part, x: Math.sin(yaw) * r, y: y0 + h / 2, z: Math.cos(yaw) * r, yaw, w: full * JOINT * widthK, h: h * JOINT, d: depth });
  }
}

/** Kulenin bütün taşları, aşağıdan yukarıya. Sıralar yarım taş kaydırılarak örülür. */
export function towerLayout(): BlockSpec[] {
  const out: BlockSpec[] = [];
  let row = 0;
  const stack = (part: BlockPart, from: number, to: number, courses: number, radius: number, depth: number, count: number) => {
    const h = (to - from) / courses;
    for (let i = 0; i < courses; i++) course(out, part, from + i * h, h, radius, depth, count, row++ % 2 ? 0.5 : 0);
  };
  stack("base", 0, H_BASE, 3, R_BASE, 0.5, 16);
  stack("body", H_BASE, H_WINDOW_BOTTOM, 4, R_BODY, 0.42, 12);
  stack("body", H_WINDOW_BOTTOM, H_WINDOW_TOP, 3, R_BODY, 0.42, 12);
  stack("body", H_WINDOW_TOP, H_BODY_TOP - 0.42, 3, R_BODY, 0.42, 12);
  // Gövdenin en üst sırası çini kuşaktır.
  stack("cini", H_BODY_TOP - 0.42, H_BODY_TOP, 1, R_BODY, 0.42, 12);
  // Burç: taşkın raf, korkuluk ve mazgal dişleri.
  stack("parapet", H_BODY_TOP, H_BODY_TOP + 0.9, 2, R_PARAPET, 0.45, 14);
  course(out, "merlon", H_BODY_TOP + 0.9, H_ROOF_BASE - H_BODY_TOP - 0.9, R_PARAPET, 0.45, 14, 0, 2, 0.8);
  return out;
}

/** Bölgeye ve hasara göre yerinden çıkacak taş sayısı. */
export function knockCount(zone: Zone, damage: number): number {
  if (damage <= 0) return 0;
  // Külaha çarpan taş kiremitleri dağıtır; burçtan yalnızca birkaç taş düşer.
  if (zone === "kulah") return Math.max(2, Math.round(damage * 0.2));
  return Math.max(3, Math.min(22, Math.round(damage * 0.45)));
}

/** İsabet noktasına en yakın sağlam taşlar. Küçük bir rastgelelik deliğin kenarını düzensiz yapar. */
export function pickBlocks(layout: readonly BlockSpec[], intact: readonly boolean[], impact: V3, count: number, rnd: () => number): number[] {
  const scored: { i: number; score: number }[] = [];
  for (let i = 0; i < layout.length; i++) {
    if (!intact[i]) continue;
    const b = layout[i];
    const dist = Math.hypot(b.x - impact.x, b.y - impact.y, b.z - impact.z);
    scored.push({ i, score: dist * (1 + rnd() * 0.3) });
  }
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, count).map((s) => s.i);
}

/**
 * Düşen taşın yolculuğu ve duracağı yer. `flip` taşın hangi yüzü üstüne yatacağını söyler
 * (0: örüldüğü gibi, 1: ön yüzü üste, 2: yanı üste); `spins` havada kaç tam tur atacağını.
 */
export type Fall = { t0: number; T: number; rest: V3; yaw: number; flip: 0 | 1 | 2; tilt: number; tiltDir: number; spins: number; axis: number };

const halfExtent = (b: BlockSpec, flip: 0 | 1 | 2) => (flip === 0 ? b.h : flip === 1 ? b.d : b.w) / 2;
const fallTime = (drop: number) => Math.sqrt((2 * Math.max(0.3, drop)) / GRAVITY);

/** İsabetle yerinden çıkan taş: kulenin, atışın geldiği taraftaki dibine düşer. `toward` o tarafın x yönüdür. */
export function knockFall(b: BlockSpec, toward: 1 | -1, at: number, rnd: () => number): Fall {
  const flip = Math.floor(rnd() * 3) as 0 | 1 | 2;
  const y = halfExtent(b, flip);
  const out = R_BASE + 0.3 + rnd() * 1.3;
  const side = (rnd() - 0.42) * 4.4;
  return {
    t0: at + rnd() * 0.1,
    T: fallTime(b.y - y) * (1.05 + rnd() * 0.25) + 0.08,
    rest: { x: toward * out, y, z: side },
    yaw: rnd() * Math.PI * 2,
    flip,
    tilt: 0,
    tiltDir: 0,
    spins: 1 + Math.floor(rnd() * 2),
    axis: rnd() * Math.PI * 2,
  };
}

/** Moloz yığınının merkezi, kulenin devrildiği yöne doğru kayıktır. */
export const HEAP_SHIFT = 1.1;
export const HEAP_RADIUS = 4.4;

/** Yıkılan kulenin moloz yığınının, merkezinden `r` uzaklıktaki yüksekliği. */
export function heapHeight(r: number): number {
  const k = Math.max(0, 1 - r / HEAP_RADIUS);
  return 2.2 * k ** 1.5;
}

/**
 * Yıkılışta bir taşın yolculuğu: alttaki taşlar önce çözülür, üsttekiler kulenin devrildiği yöne
 * (`fallDir`) doğru daha uzağa düşer. Taşlar yığının içinde eğik durur.
 */
export function collapseFall(b: BlockSpec, fallDir: 1 | -1, at: number, rnd: () => number): Fall {
  const flip = Math.floor(rnd() * 3) as 0 | 1 | 2;
  const r = 0.3 + Math.sqrt(rnd()) * (HEAP_RADIUS - 0.7);
  const theta = rnd() * Math.PI * 2;
  const topple = fallDir * b.y * 0.2;
  const x = fallDir * HEAP_SHIFT + topple + Math.cos(theta) * r;
  const z = Math.sin(theta) * r * 0.9;
  const fromCentre = Math.hypot(x - fallDir * HEAP_SHIFT, z);
  const y = heapHeight(fromCentre) * (0.12 + 0.88 * rnd()) + halfExtent(b, flip);
  return {
    t0: at + 0.32 + (b.y / H_APEX) * 0.42 + rnd() * 0.14,
    T: fallTime(b.y - y) * (1 + rnd() * 0.2) + 0.05,
    rest: { x, y, z },
    yaw: rnd() * Math.PI * 2,
    flip,
    tilt: rnd() * 0.5,
    tiltDir: rnd() * Math.PI * 2,
    spins: Math.floor(rnd() * 2),
    axis: rnd() * Math.PI * 2,
  };
}

/** Yıkılışın gösterisi bu kadar sürer; sonrasında bütün taşlar yerindedir. */
export const COLLAPSE_SECONDS = 2.4;
