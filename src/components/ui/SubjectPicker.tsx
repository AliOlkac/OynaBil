"use client";

import type { Subject } from "@/core/model";

/** Ders seçimi: dersler yan yana düğmeler hâlinde durur, tahtada parmakla seçilir. Tek ders varsa görünmez. */
export function SubjectPicker({ subjects, value, onChange, size = "md" }: { subjects: Subject[]; value: string; onChange: (id: string) => void; size?: "md" | "lg" }) {
  if (subjects.length < 2) return null;
  return (
    <div role="radiogroup" aria-label="Ders" className="flex flex-wrap gap-2">
      {subjects.map((s) => {
        const on = s.id === value;
        return (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={on}
            title={s.name}
            onClick={() => onChange(s.id)}
            className={`rounded-md font-semibold whitespace-nowrap transition-colors duration-(--dur-base) ${size === "lg" ? "h-12 px-4 text-lg" : "h-10 px-3 text-base"} ${
              on ? "bg-firuze text-ink-950" : "bg-ink-950/50 text-ink-300 hover:text-cream"
            }`}
          >
            {s.shortName}
          </button>
        );
      })}
    </div>
  );
}
