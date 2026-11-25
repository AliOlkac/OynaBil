"use client";

import { AnimatePresence, motion } from "motion/react";
import { spring } from "@/lib/motion";
import type { ShotResult } from "../logic";
import { RESULT_TEXT } from "../timeline";
import type { SceneTeam } from "./types";

/** Ağır çekim tekrarın köşe etiketi. */
export function ReplayChip({ on }: { on: boolean }) {
  return (
    <AnimatePresence>
      {on && (
        <motion.p
          key="replay"
          className="pointer-events-none absolute top-3 left-3 flex items-center gap-2 rounded-lg bg-ink-950/85 px-3 py-1.5 text-sm font-bold tracking-widest text-cream sm:top-4 sm:left-4 sm:text-lg"
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0 }}
          transition={spring.enter}
        >
          <span className="size-2.5 rounded-full bg-mercan sm:size-3" />
          TEKRAR
        </motion.p>
      )}
    </AnimatePresence>
  );
}

export type Banner = { result: ShotResult; side: 0 | 1; points: number; id: number };

/** Atışın sonucu sahnenin altında büyük harflerle: "+3 ÜÇLÜK!", "ÇEMBERDEN DÖNDÜ!". */
export function ResultBanner({ banner, teams }: { banner: Banner | null; teams: [SceneTeam, SceneTeam] }) {
  const made = banner ? banner.points > 0 : false;
  const title = banner ? (made ? (banner.points === 3 ? "ÜÇLÜK!" : banner.result === "temiz" ? "TERTEMİZ!" : "BASKET!") : RESULT_TEXT[banner.result].title.toLocaleUpperCase("tr")) : "";
  return (
    <AnimatePresence>
      {banner && (
        <motion.p
          key={banner.id}
          className="pointer-events-none absolute inset-x-0 bottom-[5%] text-center text-4xl font-bold tracking-wide sm:text-6xl"
          style={{ color: made ? teams[banner.side].base : "var(--color-cream)", WebkitTextStroke: "0.14em var(--color-ink-950)", paintOrder: "stroke fill" }}
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.1 }}
          transition={spring.celebrate}
        >
          {made && `+${banner.points} `}
          {title}
        </motion.p>
      )}
    </AnimatePresence>
  );
}
