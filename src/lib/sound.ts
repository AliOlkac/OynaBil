"use client";

import { readJson, writeJson } from "./storage";

/**
 * Ses efektleri Web Audio ile üretilir: dosya indirmez, çevrimdışı çalışır,
 * lisans sorunu yoktur. Tahta hoparlöründe sınıfı rahatsız etmeyecek kadar kısa ve yumuşaktır.
 */

const KEY = "oynabil.ses";
let ctx: AudioContext | null = null;
let enabled: boolean | null = null;

export function isSoundOn(): boolean {
  if (enabled === null) enabled = readJson<boolean>(KEY, true);
  return enabled;
}

export function setSoundOn(on: boolean) {
  enabled = on;
  writeJson(KEY, on);
}

function audio(): AudioContext | null {
  if (typeof window === "undefined" || !isSoundOn()) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, duration: number, opts: { type?: OscillatorType; gain?: number; to?: number } = {}) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + start;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(freq, t);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t + duration);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.18, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

export const sfx = {
  tap: () => tone(660, 0, 0.06, { type: "triangle", gain: 0.08 }),
  tick: () => tone(1046, 0, 0.05, { type: "square", gain: 0.035 }),
  correct: () => {
    tone(523.25, 0, 0.14, { type: "triangle" });
    tone(659.25, 0.09, 0.14, { type: "triangle" });
    tone(783.99, 0.18, 0.28, { type: "triangle" });
  },
  wrong: () => {
    tone(196, 0, 0.22, { type: "sawtooth", gain: 0.07, to: 150 });
    tone(147, 0.12, 0.3, { type: "sawtooth", gain: 0.06, to: 110 });
  },
  steal: () => tone(300, 0, 0.25, { type: "triangle", gain: 0.12, to: 900 }),
  pull: () => tone(220, 0, 0.12, { type: "triangle", gain: 0.12, to: 330 }),
  go: () => tone(880, 0, 0.35, { type: "triangle", gain: 0.16 }),
  count: () => tone(587.33, 0, 0.16, { type: "triangle", gain: 0.12 }),
  win: () => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.12, 0.3, { type: "triangle", gain: 0.16 }));
    tone(1046.5, 0.5, 0.7, { type: "triangle", gain: 0.14 });
  },
};
