import * as THREE from "three";
import { cssColor } from "@/lib/color";
import type { Tier } from "./support";

/**
 * 3D sahnelerin ortak araçları: belirteç renkleri, kodla üretilen dokular, çizici (renderer) kurulumu
 * ve iki kemikli uzuvlar için ters kinematik. Sahneler hazır model ya da resim dosyası indirmez;
 * her şey burada tuvale çizilerek üretilir, böylece site çevrimdışı çalışmaya devam eder.
 */

/** `var(--color-x)` belirtecini ya da doğrudan bir rengi three.js rengine çevirir. */
export function tokenColor(value: string): THREE.Color {
  return new THREE.Color(cssColor(value));
}

/** Belirtecin tuval (2D) çiziminde kullanılacak hâli. */
export const tokenCss = (value: string) => cssColor(value);

export type TierSettings = {
  pixelRatio: number;
  shadows: boolean;
  shadowSize: number;
  antialias: boolean;
  /** Üç boyutlu taraftar sırası: [kale arkası, yan tribünler]. Gerisi tribüne çizilmiş taraftardır. */
  crowdRows: [number, number];
  /** Süsler: tribündeki flaşlar, bayraklar, ağın hafif salınımı. */
  extras: boolean;
};

/** Kademe başına çizim ayarı (docs/TASARIM.md, "Üç boyutlu sahneler"). */
export function tierSettings(tier: Tier): TierSettings {
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  if (tier === "yuksek") return { pixelRatio: Math.min(dpr, 2), shadows: true, shadowSize: 2048, antialias: true, crowdRows: [16, 7], extras: true };
  if (tier === "orta") return { pixelRatio: Math.min(dpr, 1.25), shadows: true, shadowSize: 1024, antialias: true, crowdRows: [10, 4], extras: true };
  return { pixelRatio: Math.min(dpr, 1) * 0.8, shadows: false, shadowSize: 512, antialias: false, crowdRows: [7, 0], extras: false };
}

export function createRenderer(canvas: HTMLCanvasElement, tier: Tier): THREE.WebGLRenderer {
  const s = tierSettings(tier);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: s.antialias, alpha: false, powerPreference: "high-performance", stencil: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = s.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setPixelRatio(s.pixelRatio);
  return renderer;
}

/** Tuvale çizip dokuya çevirir. Renk dokuları sRGB'dir; tekrar eden dokular için `repeat` verilir. */
export function canvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  opts: { repeat?: [number, number]; anisotropy?: number; mipmaps?: boolean } = {},
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  draw(ctx, width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = opts.anisotropy ?? 4;
  if (opts.repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(opts.repeat[0], opts.repeat[1]);
  }
  if (opts.mipmaps === false) {
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
  }
  return tex;
}

/** Tekrarlanabilir sözde rastgele sayı (dokular her açılışta aynı çıksın). */
export function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 0xffffffff;
  };
}

/** Yumuşak ışık lekesi: projektör parlaması, flaş, toz. Toplamalı karışımla kullanılır. */
export function glowTexture(size = 128): THREE.CanvasTexture {
  return canvasTexture(
    size,
    size,
    (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.25, "rgba(255,255,255,0.55)");
      g.addColorStop(0.6, "rgba(255,255,255,0.12)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
    { mipmaps: true },
  );
}

const Y = new THREE.Vector3(0, 1, 0);
const tmpDir = new THREE.Vector3();

/** +Y boyunca uzanan bir parçayı (kol, bacak, direk) `a` noktasından `b` noktasına yerleştirir. */
export function placeSegment(obj: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3) {
  tmpDir.subVectors(b, a);
  const len = tmpDir.length();
  obj.position.copy(a);
  if (len > 1e-6) obj.quaternion.setFromUnitVectors(Y, tmpDir.multiplyScalar(1 / len));
}

const ikDir = new THREE.Vector3();
const ikPerp = new THREE.Vector3();

/**
 * İki kemikli ters kinematik (omuz-dirsek-el, kalça-diz-ayak). `pole` eklemin büküleceği yönü gösterir.
 * Hedef uzanılamayacak kadar uzaksa uzuv hedefe doğru dümdüz uzanır.
 */
export function solveLimb(root: THREE.Vector3, target: THREE.Vector3, l1: number, l2: number, pole: THREE.Vector3, mid: THREE.Vector3, end: THREE.Vector3) {
  ikDir.subVectors(target, root);
  const raw = ikDir.length();
  const dist = Math.min(Math.max(raw, Math.abs(l1 - l2) + 1e-4), l1 + l2 - 1e-4);
  if (raw < 1e-6) ikDir.set(0, -1, 0);
  else ikDir.multiplyScalar(1 / raw);
  const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  ikPerp.copy(pole).addScaledVector(ikDir, -pole.dot(ikDir));
  if (ikPerp.lengthSq() < 1e-8) ikPerp.set(ikDir.y, -ikDir.x, 0);
  ikPerp.normalize();
  mid.copy(root).addScaledVector(ikDir, a).addScaledVector(ikPerp, h);
  end.copy(root).addScaledVector(ikDir, dist);
}

/** Bir nesnenin ve altındakilerin geometri, malzeme ve dokularını bırakır. */
export function disposeTree(root: THREE.Object3D) {
  const seen = new Set<{ dispose(): void }>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) seen.add(mesh.geometry);
    const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const m of mats) {
      seen.add(m);
      for (const v of Object.values(m)) if (v instanceof THREE.Texture) seen.add(v);
    }
  });
  seen.forEach((d) => d.dispose());
}

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOut = (t: number) => 1 - (1 - t) ** 3;
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
/** Kare hızından bağımsız yumuşak takip katsayısı. */
export const follow = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);
