"use client";

import { useSyncExternalStore } from "react";
import { readJson, writeJson } from "@/lib/storage";

/**
 * 3D sahnelerin açılıp açılmayacağına karar verir. Bu dosya three.js'i içe aktarmaz;
 * oyun ekranı önce buraya sorar, 3D motoru ancak gerekiyorsa ayrı bir parça olarak indirilir.
 *
 * - "otomatik": ekran kartıyla çizen bir WebGL varsa 3D, yoksa çizim (SVG) sahnesi.
 * - "acik": öğretmen 3D'yi kendisi açtı; yavaş da olsa 3D denenir.
 * - "kapali": öğretmen kapattı ya da tahta 3D'yi akıcı çizemedi; çizim sahnesi kullanılır.
 */
export type Stage3dPref = "otomatik" | "acik" | "kapali";

/** Kalite kademesi: tahtanın gücüne göre gölge, çözünürlük ve kalabalık ayrıntısı. */
export type Tier = "yuksek" | "orta" | "dusuk";
export const TIERS: readonly Tier[] = ["yuksek", "orta", "dusuk"];

const PREF_KEY = "oynabil.sahne3d";
const TIER_KEY = "oynabil.sahne3d.kalite";

const listeners = new Set<() => void>();
let pref: Stage3dPref | null = null;

export function getStage3dPref(): Stage3dPref {
  if (pref === null) {
    const saved = typeof window === "undefined" ? "otomatik" : readJson<string>(PREF_KEY, "otomatik");
    pref = saved === "acik" || saved === "kapali" ? saved : "otomatik";
  }
  return pref;
}

export function setStage3dPref(next: Stage3dPref) {
  pref = next;
  writeJson(PREF_KEY, next);
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

type Probe = { webgl: boolean; gpu: boolean };
let probe: Probe | null = null;

/** İşlemciyle çizen (ekran kartsız) WebGL sürücülerinin adları. Bunlarla sahne tahtada akmaz. */
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render/i;

/** Tarayıcı WebGL 2 çizebiliyor mu ve bunu ekran kartıyla mı yapıyor? (Yazılımsal çizim tahtada akmaz.) */
export function probeWebgl(): Probe {
  if (probe) return probe;
  if (typeof document === "undefined") return { webgl: false, gpu: false };
  /** @returns çizicinin adı; bağlam açılamadıysa null. */
  const attempt = (strict: boolean): string | null => {
    try {
      const canvas = document.createElement("canvas");
      // three.js WebGL 2 ister; yalnızca WebGL 1 olan eski tarayıcıda 3D sahne açılmaz.
      const gl = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: strict });
      if (!gl) return null;
      const info = gl.getExtension("WEBGL_debug_renderer_info");
      const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? "");
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      return name;
    } catch {
      return null;
    }
  };
  // Tarayıcı "yavaş olur" diye uyarmıyorsa ve çizici yazılımsal değilse ekran kartı var sayılır.
  const strict = attempt(true);
  const gpu = strict !== null && !SOFTWARE_RENDERER.test(strict);
  probe = { webgl: strict !== null || attempt(false) !== null, gpu };
  return probe;
}

/** Bu cihazda şu an 3D sahne kullanılmalı mı? */
export function shouldUse3d(p: Stage3dPref = getStage3dPref()): boolean {
  if (p === "kapali") return false;
  const { webgl, gpu } = probeWebgl();
  return p === "acik" ? webgl : gpu;
}

/** 3D tercihi ve bu cihazın 3D çizip çizemediği. Sunucuda (dışa aktarımda) her zaman kapalı görünür. */
export function useStage3d(): { enabled: boolean; pref: Stage3dPref; available: boolean } {
  const current = useSyncExternalStore(subscribe, getStage3dPref, () => "kapali" as Stage3dPref);
  const available = useSyncExternalStore(
    subscribe,
    () => probeWebgl().webgl,
    () => false,
  );
  const enabled = useSyncExternalStore(
    subscribe,
    () => shouldUse3d(),
    () => false,
  );
  return { enabled, pref: current, available };
}

/** Önceki oyunda oturan kalite kademesi; yoksa cihazın görünen gücünden tahmin edilir. */
export function initialTier(): Tier {
  const saved = readJson<string>(TIER_KEY, "");
  if (saved === "yuksek" || saved === "orta" || saved === "dusuk") return saved;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 4;
  if (!probeWebgl().gpu || cores <= 2 || memory <= 2) return "dusuk";
  return cores >= 8 && memory >= 8 ? "yuksek" : "orta";
}

export function rememberTier(tier: Tier) {
  writeJson(TIER_KEY, tier);
}

/**
 * Kare süresini izler; sahne akmıyorsa bir alt kademeye inilmesini, en alt kademede de akmıyorsa
 * 3D'den vazgeçilmesini söyler. Yukarı çıkmaz: kademe gidip gelirse görüntü titrer.
 */
export function createFrameWatch(tier: Tier) {
  let current = tier;
  let slowFrames = 0;
  let frames = 0;
  let sum = 0;
  return {
    get tier() {
      return current;
    },
    /** @returns "in" kademe düştü, "vazgec" 3D akmıyor, yoksa null. */
    sample(dtMs: number): "in" | "vazgec" | null {
      // Sekme arka plandayken ya da yükleme sırasında gelen dev kareler sayılmaz.
      if (dtMs > 400) return null;
      frames++;
      sum += dtMs;
      if (frames < 90) return null;
      const avg = sum / frames;
      frames = 0;
      sum = 0;
      // 30 kare/sn'nin altı (33 ms) yavaş sayılır; arka arkaya iki ölçüm gerekir.
      slowFrames = avg > 36 ? slowFrames + 1 : 0;
      if (slowFrames < 2) return null;
      slowFrames = 0;
      const i = TIERS.indexOf(current);
      if (i < TIERS.length - 1) {
        current = TIERS[i + 1];
        return "in";
      }
      return avg > 60 ? "vazgec" : null;
    },
  };
}
