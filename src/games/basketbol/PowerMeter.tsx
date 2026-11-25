"use client";

import { Flame } from "lucide-react";
import { useEffect, useRef } from "react";
import type { Difficulty } from "../shared/difficulty";
import { meterAt, SWEET, zoneHalf, type Range } from "./logic";

/**
 * Güç çubuğu: soldan sağa dolup boşalır. Yeşil bölgenin ortasındaki koyu şerit tertemiz basket,
 * yeşilin geri kalanı çemberden giren toptur. Yer, oyun mantığıyla aynı fonksiyondan (`meterAt`)
 * hesaplanır; ekranda görünen yer ile atışın sonucu birebir aynıdır.
 */
export function PowerMeter({ range, meterStart, fire, reducedMotion, difficulty }: { range: Range; meterStart: number; fire: boolean; reducedMotion: boolean; difficulty: Difficulty }) {
  const needle = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const p = meterAt(Date.now() - meterStart, range, difficulty);
      if (needle.current) needle.current.style.left = `${(p * 100).toFixed(2)}%`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [range, meterStart, difficulty]);
  const w = zoneHalf(range, fire, difficulty);
  const pct = (v: number) => `${(Math.max(0, Math.min(1, v)) * 100).toFixed(2)}%`;
  return (
    <div className="relative h-14 w-full min-w-[14rem] sm:h-16" role="img" aria-label="Güç çubuğu: iğne yeşil bölgedeyken at">
      <div className="absolute inset-0 overflow-hidden rounded-xl bg-ink-950 shadow-[var(--surface-light)]">
        <div className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-ink-700 via-ink-600 to-mercan/70" />
        <div className="absolute inset-y-0 bg-zumrut/80" style={{ left: pct(SWEET - w), width: pct(w * 2) }} />
        <div className="absolute inset-y-0 bg-zumrut-deep" style={{ left: pct(SWEET - w * 0.4), width: pct(w * 0.8) }} />
      </div>
      <div ref={needle} className="absolute -inset-y-1.5 w-2 -translate-x-1/2 rounded-full bg-cream shadow-[0_0_0_3px_var(--color-ink-950)]" style={{ left: "0%", transition: reducedMotion ? "none" : undefined }} />
      {fire && (
        <span className="absolute -top-3 right-2 flex items-center gap-1 rounded-md bg-ates px-2 py-0.5 text-xs font-bold text-ink-950">
          <Flame className="size-3.5 fill-current" /> Ateşli el
        </span>
      )}
    </div>
  );
}
