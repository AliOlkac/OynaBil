"use client";

import { useEffect, useRef } from "react";
import { POWER_HALF, POWER_SWEET, powerAt } from "./logic";

/**
 * Şutun güç çubuğu: soldan sağa dolup boşalır. Yeşil isabetli vuruştur; solu zayıf (kaleci yetişir),
 * sağı fazla sert (top yükselip açılır). Yer, oyun mantığıyla aynı fonksiyondan (`powerAt`) çizilir.
 */
export function PowerBar({ aimAt }: { aimAt: number }) {
  const needle = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (needle.current) needle.current.style.left = `${(powerAt(Date.now() - aimAt) * 100).toFixed(2)}%`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [aimAt]);
  const pct = (v: number) => `${(Math.max(0, Math.min(1, v)) * 100).toFixed(2)}%`;
  return (
    <div className="w-full min-w-[14rem]">
      <div className="relative h-14 sm:h-16" role="img" aria-label="Güç çubuğu: iğne yeşildeyken vur">
        <div className="absolute inset-0 overflow-hidden rounded-xl bg-ink-950 shadow-[var(--surface-light)]">
          <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-ink-700 to-ink-600" style={{ width: pct(POWER_SWEET - POWER_HALF) }} />
          <div className="absolute inset-y-0 bg-zumrut/85" style={{ left: pct(POWER_SWEET - POWER_HALF), width: pct(POWER_HALF * 2) }} />
          <div className="absolute inset-y-0 right-0 bg-gradient-to-r from-mercan/60 to-mercan" style={{ left: pct(POWER_SWEET + POWER_HALF) }} />
          {/* Bölge adları çubuğun içinde: alçak ekranda da kesilmez. */}
          <span className="absolute inset-y-0 left-0 grid place-items-center text-sm font-bold text-cream/80" style={{ width: pct(POWER_SWEET - POWER_HALF) }}>
            Zayıf: kaleci yetişir
          </span>
          <span className="absolute inset-y-0 right-0 grid place-items-center text-sm font-bold text-ink-950/80" style={{ left: pct(POWER_SWEET + POWER_HALF) }}>
            Sert
          </span>
        </div>
        <div ref={needle} className="absolute -inset-y-1.5 w-2 -translate-x-1/2 rounded-full bg-cream shadow-[0_0_0_3px_var(--color-ink-950)]" style={{ left: "0%" }} />
      </div>
    </div>
  );
}
