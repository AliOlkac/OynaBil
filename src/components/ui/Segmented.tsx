"use client";

import { motion } from "motion/react";
import { useId } from "react";
import { spring } from "@/lib/motion";

/** Birkaç seçenekten biri. Seçili olanın arkasındaki zemin kayarak yer değiştirir. */
export function Segmented<V extends string | number>({
  label,
  value,
  options,
  onChange,
  size = "md",
}: {
  label: string;
  value: V;
  options: { value: V; label: string }[];
  onChange: (value: V) => void;
  size?: "md" | "lg";
}) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-lg bg-ink-950/60 p-1">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={`relative min-w-0 flex-1 rounded-md font-semibold whitespace-nowrap transition-colors duration-(--dur-base) ${
              size === "lg" ? "h-14 px-2 text-lg sm:px-4 sm:text-xl" : "h-11 px-2 text-base sm:px-3"
            } ${selected ? "text-ink-950" : "text-ink-300 hover:text-cream"}`}
          >
            {selected && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-md bg-firuze"
                transition={spring.ui}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-4 rounded-lg px-1 py-1 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{label}</span>
        <span className="block text-sm text-ink-400">{hint}</span>
      </span>
      <span className={`relative h-8 w-14 shrink-0 rounded-full transition-colors duration-(--dur-base) ${checked ? "bg-firuze" : "bg-ink-700"}`}>
        <motion.span
          className="absolute top-1 left-1 size-6 rounded-full bg-cream"
          animate={{ x: checked ? "1.5rem" : 0 }}
          transition={spring.ui}
        />
      </span>
    </button>
  );
}
