"use client";

import { useEffect, useRef } from "react";
import { hashSeed } from "@/core/cards";
import type { PlayableQuestion } from "@/core/deck";
import { createRng } from "@/core/random";
import type { AnswerLog } from "../types";

/**
 * Tek oyunculu mod (mobil prototip): oyuncu soldaki takımdır (0), sağdaki takımı (1) bilgisayar oynar.
 * Oyun kuralları değişmez; bilgisayar aynı eylemleri (cevap, atış) gecikmeyle gönderir. Rakibin soruyu
 * bilme olasılığı ve atış isabeti `skill` (0..1) ile ölçeklenir, kararları oyun tohumundan türetilir.
 */
export type SoloResult = { winner: 0 | 1 | "draw"; score: [number, number]; log: AnswerLog[]; deck: PlayableQuestion[] };
export type SoloMode = { bot: { skill: number }; onResult: (result: SoloResult) => void };

export const BOT_SIDE = 1 as const;

/** Rakibin bu karar için rastgele sayı üreteci: aynı oyun yeniden açılınca aynı kararı verir. */
export function botRng(seed: number, key: string) {
  return createRng(hashSeed(`${seed}:bot:${key}`));
}

/** Rakibin soruya vereceği cevap ve ne kadar düşüneceği. */
export function botAnswerPlan(seed: number, key: string, skill: number, q: Pick<PlayableQuestion, "correctIndex" | "options">) {
  const rng = botRng(seed, `cevap:${key}`);
  const delay = 2800 + rng() * 5200 * (1.3 - skill * 0.6);
  const right = rng() < 0.38 + skill * 0.47;
  const wrongs = q.options.map((_, i) => i).filter((i) => i !== q.correctIndex);
  return { delay, option: right ? q.correctIndex : wrongs[Math.floor(rng() * wrongs.length)] };
}

/** `active` iken `delay` ms sonra (ya da `at` anında) `fn` çalışır; anahtar değişince ya da etkinlik bitince iptal olur. */
export function useBotAction(active: boolean, key: string, when: { delay: number } | { at: number }, fn: () => void) {
  const live = useRef(fn);
  useEffect(() => {
    live.current = fn;
  });
  useEffect(() => {
    if (!active) return;
    const delay = "at" in when ? when.at - Date.now() : when.delay;
    const id = window.setTimeout(() => live.current(), Math.max(0, delay));
    return () => window.clearTimeout(id);
    // Gecikme, anahtar belirlenince sabittir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, key]);
}

/**
 * Tek oyunculu maçın ortak akışı: tanıtım ekranı atlanır, rakip soruları cevaplar, maç bitince sonuç
 * bir kez bildirilir (sonuç ekranını mobil kabuk çizer).
 */
export function useSolo(
  solo: SoloMode | undefined,
  o: {
    seed: number;
    ready: boolean;
    start: () => void;
    /** Oyun bitti ve bitiş gösterisi tamamlandı. */
    done: boolean;
    result: () => SoloResult;
    /** Soru açık, süre akıyor ve rakip henüz yanlış cevap vermedi. */
    asking: boolean;
    questionKey: string;
    question: PlayableQuestion | undefined;
    answer: (option: number) => void;
  },
) {
  const live = useRef(o);
  useEffect(() => {
    live.current = o;
  });
  useEffect(() => {
    if (solo && o.ready) live.current.start();
  }, [solo, o.ready]);
  const reported = useRef(false);
  useEffect(() => {
    if (!solo || !o.done || reported.current) return;
    reported.current = true;
    solo.onResult(live.current.result());
  }, [solo, o.done]);
  const plan = solo && o.question ? botAnswerPlan(o.seed, o.questionKey, solo.bot.skill, o.question) : null;
  useBotAction(Boolean(solo) && o.asking && plan !== null, o.questionKey, { delay: plan?.delay ?? 0 }, () => plan && live.current.answer(plan.option));
}
