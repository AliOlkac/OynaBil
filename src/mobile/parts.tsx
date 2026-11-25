"use client";

import type { CSSProperties, ReactNode } from "react";
import { sfx } from "@/lib/sound";
import { rankName, tierOf, TOP_STEP } from "./league";

/** Dokunuşa küçük bir titreşim ve tık sesi: mobilde her eylem karşılık verir. */
export function tap() {
  sfx.tap();
  try {
    navigator.vibrate?.(8);
  } catch {
    // Titreşim desteklenmiyorsa sessizce geçilir.
  }
}

/** Lig rozeti: kalkan biçimi, lig renginde; ortasında basamak (III, II, I). */
export function LeagueShield({ step, className = "size-24" }: { step: number; className?: string }) {
  const tier = tierOf(step);
  const label = step >= TOP_STEP ? "★" : ["III", "II", "I"][step % 3];
  return (
    <svg viewBox="0 0 100 112" className={className} role="img" aria-label={rankName(step)}>
      <path d="M50 4 L94 18 V62 C94 84 74 100 50 108 C26 100 6 84 6 62 V18 Z" fill="var(--color-ink-950)" />
      <path d="M50 11 L88 23 V61 C88 80 71 94 50 101 C29 94 12 80 12 61 V23 Z" fill={tier.color} />
      <path d="M50 11 L88 23 V61 C88 80 71 94 50 101 Z" fill="var(--color-ink-950)" opacity={0.16} />
      <path d="M50 19 L80 28.5 V40 L50 30.5 L20 40 V28.5 Z" fill="var(--color-cream)" opacity={0.28} />
      <text x={50} y={74} textAnchor="middle" fontSize={step >= TOP_STEP ? 40 : 30} fontWeight={800} fill="var(--color-ink-950)">
        {label}
      </text>
    </svg>
  );
}

/** Kalın kenarlı, basınca çöken oyun düğmesi. */
export function GameButton({
  children,
  onPress,
  tone = "gold",
  className = "",
  disabled = false,
}: {
  children: ReactNode;
  onPress: () => void;
  tone?: "gold" | "blue" | "green" | "ghost" | "red";
  className?: string;
  disabled?: boolean;
}) {
  const tones = {
    gold: ["var(--color-kehribar)", "var(--color-kehribar-deep)", "var(--color-ink-950)"],
    blue: ["var(--color-kobalt)", "var(--color-kobalt-deep)", "var(--color-ink-950)"],
    green: ["var(--color-zumrut)", "var(--color-zumrut-deep)", "var(--color-ink-950)"],
    red: ["var(--color-mercan)", "var(--color-mercan-deep)", "var(--color-ink-950)"],
    ghost: ["var(--color-ink-700)", "var(--color-ink-950)", "var(--color-cream)"],
  }[tone];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        tap();
        onPress();
      }}
      className={`pressable flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-lg font-bold disabled:opacity-50 ${className}`}
      style={{ background: tones[0], color: tones[2], "--edge": tones[1], "--press-depth": "0.35rem" } as CSSProperties}
    >
      {children}
    </button>
  );
}

/** Lig puanı çubuğu. */
export function LpBar({ lp, color = "var(--color-kehribar)", className = "" }: { lp: number; color?: string; className?: string }) {
  return (
    <div className={`h-3 overflow-hidden rounded-full bg-ink-950 ${className}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(lp)}>
      <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, lp))}%`, background: color, transition: "width var(--dur-scene) var(--ease-out)" }} />
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-ink-800 p-4 shadow-[var(--surface-light)] ${className}`}>{children}</div>;
}
