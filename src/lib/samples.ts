"use client";

import { audioContext, isSoundOn, onSoundChange } from "./sound";

/**
 * Kayıtlı sesler: spiker replikleri, tribün, vuruş sesleri. Dosyalar bir kez indirilip çözülür,
 * sonra gecikmesiz çalınır. Site çevrimdışıyken service worker önbelleğinden gelir.
 *
 * Bir kayıt henüz yüklenmediyse `playSample` null döner; çağıran yer aynı olay için `sfx` içindeki
 * üretilmiş sese düşebilir. Ses kapatılınca süren bütün kayıtlar susar.
 */

const buffers = new Map<string, AudioBuffer>();
const pending = new Map<string, Promise<void>>();
const active = new Set<{ stop: (fade?: number) => void }>();

/** Çözme için ayrı bir bağlam: kullanıcı dokunmadan ve ses kapalıyken de çalışır. */
let decoder: OfflineAudioContext | null = null;

export function loadSamples(base: string, names: readonly string[]): Promise<void> {
  if (typeof window === "undefined" || typeof OfflineAudioContext === "undefined") return Promise.resolve();
  return Promise.all(
    names.map((name) => {
      const key = base + name;
      if (buffers.has(key)) return Promise.resolve();
      let job = pending.get(key);
      if (!job) {
        job = (async () => {
          try {
            const res = await fetch(`${key}.mp3`);
            if (!res.ok) return;
            decoder ??= new OfflineAudioContext(1, 1, 44100);
            buffers.set(key, await decoder.decodeAudioData(await res.arrayBuffer()));
          } catch {
            // Kayıt yoksa ya da çözülemediyse üretilmiş sesler kullanılır.
          } finally {
            pending.delete(key);
          }
        })();
        pending.set(key, job);
      }
      return job;
    }),
  ).then(() => undefined);
}

export type Playing = { stop: (fade?: number) => void; setGain: (gain: number, seconds?: number) => void; duration: number };

function start(ac: AudioContext, buffer: AudioBuffer, gain: number, opts: { rate?: number; delay?: number; fadeIn?: number }): { handle: Playing; source: AudioBufferSourceNode; node: GainNode } {
  const t = ac.currentTime + (opts.delay ?? 0);
  const source = ac.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = opts.rate ?? 1;
  const node = ac.createGain();
  if (opts.fadeIn) {
    node.gain.setValueAtTime(0.0001, t);
    node.gain.linearRampToValueAtTime(gain, t + opts.fadeIn);
  } else node.gain.setValueAtTime(gain, t);
  source.connect(node).connect(ac.destination);
  source.start(t);
  const handle: Playing = {
    duration: buffer.duration / (opts.rate ?? 1),
    stop: (fade = 0.08) => {
      const now = ac.currentTime;
      node.gain.cancelScheduledValues(now);
      node.gain.setValueAtTime(node.gain.value, now);
      node.gain.linearRampToValueAtTime(0.0001, now + fade);
      try {
        source.stop(now + fade + 0.02);
      } catch {
        // zaten durmuş
      }
    },
    setGain: (value, seconds = 0.4) => {
      const now = ac.currentTime;
      node.gain.cancelScheduledValues(now);
      node.gain.setValueAtTime(node.gain.value, now);
      node.gain.linearRampToValueAtTime(Math.max(0.0001, value), now + seconds);
    },
  };
  return { handle, source, node };
}

/** Kaydı bir kez çalar. Ses kapalıysa ya da kayıt hazır değilse null döner. */
export function playSample(key: string, opts: { gain?: number; rate?: number; delay?: number } = {}): Playing | null {
  const buffer = buffers.get(key);
  const ac = buffer ? audioContext() : null;
  if (!buffer || !ac) return null;
  const { handle, source } = start(ac, buffer, opts.gain ?? 1, opts);
  active.add(handle);
  source.onended = () => active.delete(handle);
  return handle;
}

/**
 * Kaydı kesintisiz döndürür (tribün uğultusu). Dosyanın başı ile sonu birbirine geçirilir;
 * mp3'ün başındaki ve sonundaki boşluk bu yüzden duyulmaz.
 */
export function loopSample(key: string, gain: number, overlap = 1.2): Playing | null {
  const buffer = buffers.get(key);
  const ac = buffer ? audioContext() : null;
  if (!buffer || !ac) return null;
  let level = gain;
  let stopped = false;
  let current: Playing | null = null;
  let timer = 0;
  const period = Math.max(0.5, buffer.duration - overlap);
  const next = (first: boolean) => {
    if (stopped) return;
    const previous = current;
    current = start(ac, buffer, level, { fadeIn: first ? 0.6 : overlap }).handle;
    previous?.stop(overlap);
    timer = window.setTimeout(() => next(false), period * 1000);
  };
  next(true);
  const handle: Playing = {
    duration: Infinity,
    stop: (fade = 0.4) => {
      stopped = true;
      window.clearTimeout(timer);
      current?.stop(fade);
      active.delete(handle);
    },
    setGain: (value, seconds) => {
      level = value;
      current?.setGain(value, seconds);
    },
  };
  active.add(handle);
  return handle;
}

export function stopAllSamples(fade = 0.1) {
  for (const p of [...active]) p.stop(fade);
  active.clear();
}

if (typeof window !== "undefined") {
  onSoundChange((on) => {
    if (!on) stopAllSamples();
  });
}

export { isSoundOn };
