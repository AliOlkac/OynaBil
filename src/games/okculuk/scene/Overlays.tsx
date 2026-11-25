"use client";

import { AnimatePresence, motion } from "motion/react";
import { spring } from "@/lib/motion";
import type { ShotResult } from "../logic";
import { RESULT_TEXT } from "../timeline";
import type { SceneTeam } from "./types";

export { ReplayChip } from "../../basketbol/scene/Overlays";

export type Banner = { result: ShotResult; side: 0 | 1; points: number; id: number };

/** Atışın sonucu sahnenin altında büyük harflerle: "+10 TAM ON İKİDEN!", "ISKA!". */
export function ResultBanner({ banner, teams }: { banner: Banner | null; teams: [SceneTeam, SceneTeam] }) {
  const scored = banner ? banner.points > 0 : false;
  const title = banner ? RESULT_TEXT[banner.result].title.toLocaleUpperCase("tr") : "";
  return (
    <AnimatePresence>
      {banner && (
        <motion.p
          key={banner.id}
          className="pointer-events-none absolute inset-x-0 bottom-[5%] text-center text-4xl font-bold tracking-wide sm:text-6xl"
          style={{ color: scored ? teams[banner.side].base : "var(--color-cream)", WebkitTextStroke: "0.14em var(--color-ink-950)", paintOrder: "stroke fill" }}
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.1 }}
          transition={spring.celebrate}
        >
          {scored && `+${banner.points} `}
          {title}
        </motion.p>
      )}
    </AnimatePresence>
  );
}
