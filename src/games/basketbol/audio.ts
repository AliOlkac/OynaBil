"use client";

import { loadSamples, loopSample, playSample, type Playing } from "@/lib/samples";
import { onSoundChange, sfx } from "@/lib/sound";

/**
 * Basketbol oyununun sesleri: Türkçe spiker, salon uğultusu, file, çember, panya ve sekme sesleri.
 * Kayıtlar `public/ses/basketbol` altındadır (bkz. docs/SESLER.md). Bir kayıt yoksa aynı olay için
 * `sfx` içindeki üretilmiş ses çalar; oyun ses dosyaları olmadan da eksiksiz oynanır.
 */

const BASE = "/ses/basketbol/";

const LINES = { baslangic: 1, hazir: 3, basket: 3, uclu: 2, temiz: 1, cember: 1, kacti: 3, kisa: 1, ates: 1, pas: 2, uzatma: 1, bitis: 2, berabere: 1 } as const;
export type Line = keyof typeof LINES;

const EFFECTS = ["salon-ortam", "salon-cosku", "salon-ah", "file", "cember", "panya", "sekme", "buzzer"] as const;
const AMBIENCE = { quiet: 0.14, tense: 0.26 } as const;

let speech: Playing | null = null;
let ambience: Playing | null = null;
let ambienceLevel: keyof typeof AMBIENCE | null = null;
const turn: Partial<Record<Line, number>> = {};

const effect = (name: (typeof EFFECTS)[number], gain: number, delay = 0) => playSample(BASE + name, { gain, delay });

function startAmbience() {
  if (ambience || !ambienceLevel) return;
  ambience = loopSample(`${BASE}salon-ortam`, AMBIENCE[ambienceLevel]);
}

export const basketAudio = {
  preload() {
    const speechFiles = (Object.keys(LINES) as Line[]).flatMap((line) => Array.from({ length: LINES[line] }, (_, i) => `spiker-${line}-${i + 1}`));
    void loadSamples(BASE, [...EFFECTS, ...speechFiles]).then(startAmbience);
  },

  /** Salon uğultusu: soru sırasında alçak, atış anında yüksek. `null` keser. */
  ambience(level: keyof typeof AMBIENCE | null) {
    ambienceLevel = level;
    if (!level) {
      ambience?.stop(0.6);
      ambience = null;
      return;
    }
    if (ambience) ambience.setGain(AMBIENCE[level], 0.8);
    else startAmbience();
  },

  /** Spiker konuşur. Süren replik kesilir: son olay her zaman önceliklidir. */
  say(line: Line, delay = 0) {
    const n = (turn[line] ?? Math.floor(Math.random() * LINES[line])) % LINES[line];
    turn[line] = n + 1;
    speech?.stop(0.12);
    speech = playSample(`${BASE}spiker-${line}-${n + 1}`, { gain: 0.95, delay });
  },

  swish: () => effect("file", 0.8) ?? sfx.swish(),
  rim: (strength = 1) => effect("cember", 0.45 + 0.45 * strength) ?? sfx.rim(strength),
  board: () => effect("panya", 0.8) ?? sfx.board(),
  bounce: (strength = 1) => effect("sekme", 0.25 + 0.6 * strength) ?? sfx.bounce(strength),
  buzzer: () => effect("buzzer", 0.55) ?? sfx.buzzer(),
  crowdCheer: () => effect("salon-cosku", 0.7) ?? sfx.roar(),
  crowdOoh: () => effect("salon-ah", 0.6) ?? sfx.aww(),

  stop() {
    basketAudio.ambience(null);
    speech?.stop(0.2);
    speech = null;
  },
};

if (typeof window !== "undefined") {
  onSoundChange((on) => {
    ambience = null;
    speech = null;
    if (on) startAmbience();
  });
}
