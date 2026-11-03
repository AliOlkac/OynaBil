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

let noiseBuffer: AudioBuffer | null = null;

/** Filtrelenmiş beyaz gürültü: toz, çamur, kalabalık gibi perdesiz sesler için. */
function noise(start: number, duration: number, opts: { freq: number; q?: number; gain?: number; type?: BiquadFilterType; attack?: number; sweepTo?: number }) {
  const ac = audio();
  if (!ac) return;
  if (!noiseBuffer) {
    noiseBuffer = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const t = ac.currentTime + start;
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ac.createBiquadFilter();
  filter.type = opts.type ?? "bandpass";
  filter.frequency.setValueAtTime(opts.freq, t);
  if (opts.sweepTo) filter.frequency.exponentialRampToValueAtTime(opts.sweepTo, t + duration);
  filter.Q.value = opts.q ?? 1;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.2, t + (opts.attack ?? 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  src.connect(filter).connect(g).connect(ac.destination);
  src.start(t, Math.random());
  src.stop(t + duration + 0.05);
}

export const sfx = {
  /** Takım ipe asılır: kısa bir hamle ve ipin gerilmesi. */
  heave: () => {
    noise(0, 0.22, { freq: 900, q: 0.8, gain: 0.16, sweepTo: 300 });
    tone(150, 0, 0.18, { type: "triangle", gain: 0.12, to: 95 });
  },
  /** Yanlış cevap: buz çıtırtısı. */
  freeze: () => {
    [1568, 2093, 2637].forEach((f, i) => tone(f, i * 0.05, 0.25, { type: "sine", gain: 0.05 }));
    noise(0, 0.3, { freq: 6000, q: 2, gain: 0.05, type: "highpass" });
    tone(196, 0, 0.2, { type: "sawtooth", gain: 0.05, to: 150 });
  },
  splash: () => {
    noise(0, 0.6, { freq: 700, q: 0.7, gain: 0.35, sweepTo: 180, type: "lowpass" });
    tone(110, 0, 0.3, { type: "sine", gain: 0.2, to: 55 });
  },
  /** Damga vurulması. */
  thud: () => {
    tone(95, 0, 0.28, { type: "sine", gain: 0.3, to: 48 });
    noise(0, 0.08, { freq: 1800, q: 0.7, gain: 0.18 });
  },
  snap: () => {
    noise(0, 0.12, { freq: 3000, q: 0.5, gain: 0.3, type: "highpass" });
    tone(80, 0.02, 0.35, { type: "sine", gain: 0.18, to: 45 });
  },
  /** Kalabalık sevinci: yükselip alçalan gürültü. */
  cheer: () => {
    noise(0, 2.2, { freq: 1200, q: 0.6, gain: 0.12, attack: 0.4 });
    noise(0.1, 2, { freq: 2400, q: 0.8, gain: 0.06, attack: 0.5 });
  },

  // ---- Kule Yıkmaca ----
  /** Vinç kurulurken cırcır tıkırtısı. */
  crank: () => {
    for (let i = 0; i < 7; i++) {
      tone(1250 - i * 40, i * 0.085, 0.03, { type: "square", gain: 0.035 });
      noise(i * 0.085, 0.03, { freq: 3500, q: 2, gain: 0.05 });
    }
  },
  /** Taş kepçeye oturur. */
  load: () => {
    tone(150, 0, 0.14, { type: "sine", gain: 0.22, to: 90 });
    noise(0, 0.06, { freq: 1200, q: 0.8, gain: 0.1 });
  },
  /** Ateşli gülle tutuşur. */
  ignite: () => noise(0, 0.5, { freq: 1500, q: 0.6, gain: 0.09, attack: 0.08, sweepTo: 700 }),
  /** Kol kasnağa çarpar, taş fırlar. */
  launch: () => {
    noise(0, 0.07, { freq: 900, q: 1, gain: 0.32 });
    tone(170, 0, 0.18, { type: "triangle", gain: 0.18, to: 60 });
    tone(90, 0.02, 0.25, { type: "sine", gain: 0.2, to: 50 });
  },
  /** Taş havada ıslık çalar. */
  whoosh: (duration: number) => noise(0, Math.max(0.4, duration), { freq: 2200, q: 2.5, gain: 0.07, attack: Math.max(0.1, duration * 0.4), sweepTo: 500 }),
  /** Kuleye isabet: gümbürtü ve dökülen taşlar; hasar büyüdükçe daha güçlü. */
  hit: (damage: number) => {
    const g = Math.min(0.42, 0.22 + damage / 120);
    tone(78, 0, 0.55, { type: "sine", gain: g, to: 38 });
    noise(0, 0.12, { freq: 1600, q: 0.7, gain: g * 0.8 });
    for (let i = 0; i < 5; i++) noise(0.08 + i * 0.07 + Math.random() * 0.04, 0.09, { freq: 700 - i * 80, q: 1.2, gain: 0.08, type: "lowpass" });
  },
  /** Pencereye isabet: cam ve tahta kırılır, ardından bir çan. */
  crit: () => {
    tone(70, 0, 0.6, { type: "sine", gain: 0.42, to: 36 });
    noise(0, 0.32, { freq: 5200, q: 0.8, gain: 0.16, type: "highpass" });
    noise(0.02, 0.18, { freq: 1100, q: 1.4, gain: 0.22 });
    tone(1318.5, 0.08, 0.6, { type: "triangle", gain: 0.09 });
    tone(1760, 0.16, 0.7, { type: "triangle", gain: 0.08 });
  },
  /** Iska: taş toprağa gömülür. */
  miss: () => {
    noise(0, 0.28, { freq: 380, q: 0.7, gain: 0.3, type: "lowpass" });
    tone(95, 0, 0.22, { type: "sine", gain: 0.14, to: 60 });
  },
  /** Düşen blok yere vurur. */
  thump: () => tone(110, 0, 0.12, { type: "sine", gain: 0.12, to: 70 }),
  /** Mancınık tutukluk yapar: tok bir ses, gevşek bir yay. */
  misfire: () => {
    noise(0, 0.08, { freq: 700, q: 1, gain: 0.2 });
    tone(320, 0.04, 0.4, { type: "triangle", gain: 0.12, to: 110 });
    tone(140, 0.42, 0.2, { type: "sine", gain: 0.12, to: 90 });
  },
  /** Kule yıkılır: uzun gürleme, dökülen taşlar, son büyük gümbürtü. */
  collapse: () => {
    noise(0, 2.6, { freq: 320, q: 0.6, gain: 0.42, attack: 0.25, type: "lowpass", sweepTo: 140 });
    for (let i = 0; i < 9; i++) noise(0.2 + i * 0.18 + Math.random() * 0.08, 0.14, { freq: 900 - i * 60, q: 1, gain: 0.12 });
    tone(60, 0.9, 0.9, { type: "sine", gain: 0.36, to: 32 });
  },

  // ---- Penaltı ----
  /** Hakem düdüğü: kısa, titreşimli iki öten. */
  whistle: () => {
    tone(2900, 0, 0.18, { type: "sine", gain: 0.09, to: 3100 });
    tone(2950, 0.22, 0.32, { type: "sine", gain: 0.1, to: 2750 });
    noise(0, 0.5, { freq: 3000, q: 6, gain: 0.03 });
  },
  /** Topa vuruş. */
  kick: () => {
    tone(130, 0, 0.12, { type: "sine", gain: 0.3, to: 70 });
    noise(0, 0.05, { freq: 1500, q: 0.8, gain: 0.22 });
  },
  /** Top ağa gömülür. */
  net: () => noise(0, 0.45, { freq: 2400, q: 0.7, gain: 0.16, sweepTo: 900 }),
  /** Gol: tribün coşar. */
  roar: () => {
    noise(0, 2.6, { freq: 900, q: 0.5, gain: 0.2, attack: 0.15 });
    noise(0.05, 2.4, { freq: 1800, q: 0.7, gain: 0.1, attack: 0.2 });
    [523.25, 659.25, 783.99].forEach((f, i) => tone(f, 0.1 + i * 0.1, 0.4, { type: "triangle", gain: 0.1 }));
  },
  /** Kurtarış: eldivene çarpan topun tok sesi. */
  save: () => {
    tone(160, 0, 0.18, { type: "sine", gain: 0.3, to: 80 });
    noise(0, 0.08, { freq: 900, q: 0.8, gain: 0.25 });
  },
  /** Tribünün "ooo" sesi. */
  ooh: () => noise(0.05, 1.3, { freq: 500, q: 1.4, gain: 0.16, attack: 0.25, sweepTo: 900 }),
  /** Direk: metal çınlaması. */
  clang: () => {
    tone(1180, 0, 0.9, { type: "triangle", gain: 0.12 });
    tone(1770, 0, 0.7, { type: "sine", gain: 0.08 });
    tone(2650, 0, 0.4, { type: "sine", gain: 0.05 });
    noise(0, 0.05, { freq: 4000, q: 1, gain: 0.12, type: "highpass" });
  },
  /** Tribünün hayal kırıklığı. */
  aww: () => noise(0.05, 1.2, { freq: 800, q: 1.1, gain: 0.13, attack: 0.2, sweepTo: 350 }),

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
