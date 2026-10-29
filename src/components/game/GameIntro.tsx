"use client";

import { motion } from "motion/react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Girih } from "@/components/ui/Girih";
import { TeamEmblem } from "@/components/ui/TeamEmblem";
import { TEAM_STYLES } from "@/games/teams";
import type { GameDefinition, Team } from "@/games/types";
import { dur, ease, spring, stagger } from "@/lib/motion";

/** Oyun başlamadan önce tahtada gösterilen ekran: kurallar ve takımlar. Öğretmen burada kuralları anlatır. */
export function GameIntro({ game, teams, questionInfo, onStart }: { game: GameDefinition; teams: Team[]; questionInfo: string; onStart: () => void }) {
  return (
    <div className="relative flex flex-1 items-center overflow-hidden px-12 pb-10">
      <Girih className="text-cream opacity-[0.06]" />
      <div className="relative grid w-full grid-cols-1 items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <motion.h1
            className="text-6xl leading-none font-bold"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: dur.slow, ease }}
          >
            {game.name}
          </motion.h1>
          <p className="mt-4 text-xl text-ink-300">{questionInfo}</p>
          <ol className="mt-8 flex flex-col gap-4">
            {game.howTo.map((line, i) => (
              <motion.li
                key={line}
                className="flex gap-4 text-xl leading-snug"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * stagger, duration: dur.base, ease }}
              >
                <span className="tabular grid size-9 shrink-0 place-items-center rounded-full bg-ink-700 text-base font-bold text-firuze">{i + 1}</span>
                <span className="pt-1">{line}</span>
              </motion.li>
            ))}
          </ol>
        </div>

        <div className="flex flex-col gap-4">
          {teams.map((team, i) => {
            const style = TEAM_STYLES[team.color];
            return (
              <motion.div
                key={team.id}
                className="flex items-center gap-5 rounded-xl px-7 py-5"
                style={{ background: style.soft }}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...spring.enter, delay: 0.15 + i * stagger }}
              >
                <TeamEmblem color={team.color} className="size-12" />
                <span className="text-3xl font-bold" style={{ color: style.base }}>
                  {team.name}
                </span>
              </motion.div>
            );
          })}
          <Button variant="primary" size="xl" className="mt-4 w-full" icon={<Play className="size-7 fill-current" />} onClick={onStart} autoFocus>
            Başla
          </Button>
        </div>
      </div>
    </div>
  );
}
