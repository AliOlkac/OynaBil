"use client";

import { loadSamples, loopSample, playSample, type Playing } from "@/lib/samples";
import { onSoundChange, sfx } from "@/lib/sound";

/**
 * Penaltı oyununun sesleri: Türkçe spiker, tribün ve vuruş sesleri. Kayıtlar `public/ses/penalti`
 * altındadır (nasıl üretildikleri: docs/SESLER.md). Bir kayıt henüz inmediyse aynı olay için
 * `sfx` içindeki üretilmiş ses çalar; oyun ses dosyaları olmadan da eksiksiz oynanır.
 */

const BASE = "/ses/penalti/";

/** Spiker replikleri ve kaçar çeşidi olduğu. */
const LINES = { baslangic: 1, hazir: 3, gol: 4, kurtaris: 3, direk: 2, aut: 2, pas: 2, seri: 1, bitis: 2, berabere: 1 } as const;
export type Line = keyof typeof LINES;

const EFFECTS = ["tribun-ortam", "tribun-gol", "tribun-ah", "tribun-alkis", "duduk", "vurus", "ag", "direk", "eldiven"] as const;

const AMBIENCE = { quiet: 0.16, tense: 0.3 } as const;

let speech: Playing | null = null;
let ambience: Playing | null = null;
let ambienceLevel: keyof typeof AMBIENCE | null = null;
const turn: Partial<Record<Line, number>> = {};

const effect = (name: (typeof EFFECTS)[number], gain: number, delay = 0) => playSample(BASE + name, { gain, delay });

function startAmbience() {
  if (ambience || !ambienceLevel) return;
  ambience = loopSample(`${BASE}tribun-ortam`, AMBIENCE[ambienceLevel]);
}

export const penaltyAudio = {
  /** Kayıtları indirir ve çözer. Oyun açılırken çağrılır; bitince tribün uğultusu başlayabilir. */
  preload() {
    const speechFiles = (Object.keys(LINES) as Line[]).flatMap((line) => Array.from({ length: LINES[line] }, (_, i) => `spiker-${line}-${i + 1}`));
    void loadSamples(BASE, [...EFFECTS, ...speechFiles]).then(startAmbience);
  },

  /**
   * Tribün uğultusu: soru sırasında alçak, şut anında yüksek. `null` uğultuyu keser.
   * Ses sonradan açılırsa uğultu kendiliğinden geri gelir.
   */
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

  whistle: () => effect("duduk", 0.5) ?? sfx.whistle(),
  kick: () => {
    if (!effect("vurus", 0.9)) sfx.kick();
    sfx.whoosh(0.8);
  },
  net: () => effect("ag", 0.7) ?? sfx.net(),
  post: () => effect("direk", 0.8) ?? sfx.clang(),
  gloves: () => effect("eldiven", 0.9) ?? sfx.save(),
  /** Gol: tribün coşar. */
  crowdGoal: () => effect("tribun-gol", 0.75) ?? sfx.roar(),
  /** Kaçan şut: tribün "ooo" der. */
  crowdOoh: () => effect("tribun-ah", 0.6) ?? sfx.aww(),
  /** Kurtarış: şaşkınlık ve alkış. */
  crowdApplause: () => effect("tribun-alkis", 0.6) ?? sfx.ooh(),

  /** Oyun kapanırken: uğultu ve süren replik susar. */
  stop() {
    penaltyAudio.ambience(null);
    speech?.stop(0.2);
    speech = null;
  },
};

if (typeof window !== "undefined") {
  onSoundChange((on) => {
    // Ses kapanınca kayıtlar samples.ts içinde susturulur; açılınca uğultu geri gelir.
    ambience = null;
    speech = null;
    if (on) startAmbience();
  });
}
