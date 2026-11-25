"use client";

import { ArrowLeft, ArrowRight, Wind as WindIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import type { Difficulty } from "../shared/difficulty";
import { AIM_LOCK_MS, sightAt, type Point, type Wind } from "./logic";
import { RING_COLORS } from "./timeline";

/**
 * Nişangâh dürbünü: hedef önden görünür, artı işareti hedefin üstünde salınır. Yer, oyun mantığıyla
 * aynı fonksiyondan (`sightAt`) hesaplanır; dokunulduğu anda görünen yer ile okun nişanı birebir aynıdır.
 * Ok bırakılınca dürbün okun saplandığı yeri gösterir.
 */
export function AimScope({ aimStart, wind, hit, color, difficulty }: { aimStart: number | null; wind: Wind; hit: Point | null; color: string; difficulty: Difficulty }) {
  const cross = useRef<SVGGElement>(null);
  useEffect(() => {
    if (aimStart === null) return;
    let raf = 0;
    const tick = () => {
      const elapsed = Date.now() - aimStart;
      const p = sightAt(elapsed, difficulty);
      const el = cross.current;
      if (el) {
        el.setAttribute("transform", `translate(${p.x.toFixed(4)} ${(-p.y).toFixed(4)})`);
        // Yay gerilirken nişangâh soluk; kilit bitince belirginleşir.
        el.style.opacity = elapsed < AIM_LOCK_MS ? "0.35" : "1";
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [aimStart, difficulty]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-end gap-2">
      <svg viewBox="-1.32 -1.32 2.64 2.64" className="aspect-square w-full rounded-full bg-ink-950/85 shadow-[var(--surface-light)]" role="img" aria-label="Nişangâh">
        {/* Saman taban */}
        <circle r={1.28} fill="var(--color-ahsap-acik)" />
        {Array.from({ length: 10 }, (_, i) => {
          const r = 1 - i * 0.1;
          const color = RING_COLORS[Math.floor(i / 2)];
          return <circle key={i} r={r} fill={`${color}`} stroke={i < 2 ? "var(--color-ink-600)" : i < 4 ? "var(--color-ink-600)" : "var(--color-ink-950)"} strokeWidth={0.008} />;
        })}
        <circle r={0.05} fill="none" stroke="var(--color-ink-950)" strokeWidth={0.008} />
        {hit && (
          <g transform={`translate(${hit.x} ${-hit.y})`}>
            <circle r={0.07} fill="var(--color-ink-950)" opacity={0.35} />
            <circle r={0.035} fill={color} stroke="var(--color-ink-950)" strokeWidth={0.015} />
          </g>
        )}
        {aimStart !== null && !hit && (
          <g ref={cross} style={{ opacity: 0.35 }}>
            <circle r={0.16} fill="none" stroke="var(--color-ink-950)" strokeWidth={0.05} />
            <circle r={0.16} fill="none" stroke={color} strokeWidth={0.026} />
            <path d="M-0.3 0 H-0.08 M0.08 0 H0.3 M0 -0.3 V-0.08 M0 0.08 V0.3" stroke="var(--color-ink-950)" strokeWidth={0.05} strokeLinecap="round" />
            <path d="M-0.3 0 H-0.08 M0.08 0 H0.3 M0 -0.3 V-0.08 M0 0.08 V0.3" stroke={color} strokeWidth={0.024} strokeLinecap="round" />
            <circle r={0.018} fill={color} />
          </g>
        )}
      </svg>
      <WindGauge wind={wind} />
    </div>
  );
}

/** Rüzgâr: yönü okla, şiddeti 0-3 çizgiyle. */
export function WindGauge({ wind, large = false }: { wind: Wind; large?: boolean }) {
  const level = Math.abs(wind);
  const Arrow = wind < 0 ? ArrowLeft : ArrowRight;
  return (
    <p
      className={`flex items-center gap-2 rounded-lg bg-ink-950/85 font-bold ${large ? "px-4 py-2 text-xl" : "px-3 py-1 text-base sm:text-lg"} ${level === 3 ? "text-ates" : "text-cream"}`}
      aria-label={level === 0 ? "Rüzgâr yok" : `Rüzgâr ${wind < 0 ? "sola" : "sağa"}, şiddeti ${level}`}
    >
      <WindIcon className={large ? "size-6" : "size-5"} />
      {level === 0 ? (
        "Rüzgâr yok"
      ) : (
        <>
          <span className="flex gap-0.5" aria-hidden>
            {[1, 2, 3].map((k) => (
              <span key={k} className={`h-4 w-1.5 rounded-full ${k <= level ? "bg-current" : "bg-ink-600"}`} />
            ))}
          </span>
          <Arrow className={large ? "size-6" : "size-5"} strokeWidth={3} />
          <span>{wind < 0 ? "sola" : "sağa"}</span>
        </>
      )}
    </p>
  );
}
