"use client";

import { loadSamples, loopSample, playSample, type Playing } from "@/lib/samples";
import { onSoundChange, sfx } from "@/lib/sound";

/**
 * Okçuluk oyununun sesleri: Türkçe spiker, açık alan uğultusu, yayın gerilmesi, kirişin bırakılması,
 * okun vızıltısı ve hedefe saplanması. Kayıtlar `public/ses/okculuk` altındadır (bkz. docs/SESLER.md).
 * Bir kayıt yoksa aynı olay için `sfx` içindeki üretilmiş ses çalar; oyun ses dosyaları olmadan da oynanır.
 */

const BASE = "/ses/okculuk/";

const LINES = { baslangic: 1, hazir: 3, ruzgar: 1, onluk: 2, dokuz: 1, iyi: 2, orta: 2, kotu: 1, iska: 2, pas: 2, uzatma: 1, bitis: 2, berabere: 1 } as const;
export type Line = keyof typeof LINES;

const EFFECTS = ["alan-ortam", "alan-cosku", "alan-ah", "ruzgar", "yay-ger", "birak", "ucus", "hedef", "cimen"] as const;
const AMBIENCE = { quiet: 0.16, tense: 0.08 } as const;

let speech: Playing | null = null;
let ambience: Playing | null = null;
let ambienceLevel: keyof typeof AMBIENCE | null = null;
const turn: Partial<Record<Line, number>> = {};

const effect = (name: (typeof EFFECTS)[number], gain: number, delay = 0) => playSample(BASE + name, { gain, delay });

function startAmbience() {
  if (ambience || !ambienceLevel) return;
  ambience = loopSample(`${BASE}alan-ortam`, AMBIENCE[ambienceLevel]);
}

export const archeryAudio = {
  preload() {
    const speechFiles = (Object.keys(LINES) as Line[]).flatMap((line) => Array.from({ length: LINES[line] }, (_, i) => `spiker-${line}-${i + 1}`));
    void loadSamples(BASE, [...EFFECTS, ...speechFiles]).then(startAmbience);
  },

  /** Alan uğultusu: soru sırasında alçak; nişan alınırken seyirci susar, daha da alçalır. `null` keser. */
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

  draw: () => effect("yay-ger", 0.55) ?? sfx.bowDraw(),
  release: () => effect("birak", 0.85) ?? sfx.bowRelease(),
  whoosh: () => effect("ucus", 0.5) ?? sfx.whoosh(0.45),
  thud: (strength = 1) => effect("hedef", 0.5 + 0.4 * strength) ?? sfx.arrowHit(strength),
  grass: () => effect("cimen", 0.6) ?? sfx.arrowHit(0.3),
  wind: () => effect("ruzgar", 0.45),
  crowdCheer: () => effect("alan-cosku", 0.7) ?? sfx.roar(),
  crowdOoh: () => effect("alan-ah", 0.6) ?? sfx.aww(),

  stop() {
    archeryAudio.ambience(null);
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
