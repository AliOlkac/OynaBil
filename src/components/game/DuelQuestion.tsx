"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, Hourglass, X } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { TeamEmblem } from "@/components/ui/TeamEmblem";
import type { PlayableQuestion } from "@/core/deck";
import { dur, ease, spring } from "@/lib/motion";
import type { Duel } from "@/games/shared/duel";
import { TEAM_STYLES } from "@/games/teams";
import type { Team } from "@/games/types";

const LETTERS = ["A", "B", "C", "D"];

/**
 * Düello sorusu paneli: soru bir kez, ortada yazılır; iki takım şıkları kendi yarısında,
 * kendi sırasıyla görür. İki öğrenci tahtada aynı anda dokunabilir (pointerdown).
 * Yanlış cevap veren tarafın şıkları kapanır ve hangi şıkkı seçtiği karar anına kadar gösterilmez.
 */
export function DuelQuestion({
  question,
  teams,
  duel,
  orders,
  revealed,
  disabled = false,
  meta,
  timer,
  onAnswer,
}: {
  question: PlayableQuestion;
  teams: [Team, Team];
  duel: Duel;
  orders: [number[], number[]];
  /** Doğru cevap gösterilsin mi (karar verildi ya da süre doldu). */
  revealed: boolean;
  disabled?: boolean;
  meta?: ReactNode;
  timer?: ReactNode;
  onAnswer: (side: 0 | 1, option: number) => void;
}) {
  return (
    <section className="flex min-h-0 flex-1 flex-col px-3 pt-3 pb-3 sm:px-8">
      <div className="flex items-start gap-4 sm:gap-6">
        <div className="min-w-0 flex-1">
          {meta}
          <h2 className={`mt-1.5 leading-tight font-bold text-balance ${question.prompt.length > 90 ? "text-xl sm:text-3xl" : "text-2xl sm:text-4xl"}`}>{question.prompt}</h2>
        </div>
        {timer}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:min-h-0 sm:flex-1 sm:grid-cols-2 sm:gap-6">
        {([0, 1] as const).map((side) => (
          <DuelSidePanel
            key={side}
            side={side}
            team={teams[side]}
            question={question}
            duel={duel}
            order={orders[side]}
            revealed={revealed}
            disabled={disabled}
            onAnswer={(option) => onAnswer(side, option)}
          />
        ))}
      </div>
    </section>
  );
}

function DuelSidePanel({
  side,
  team,
  question,
  duel,
  order,
  revealed,
  disabled,
  onAnswer,
}: {
  side: 0 | 1;
  team: Team;
  question: PlayableQuestion;
  duel: Duel;
  order: number[];
  revealed: boolean;
  disabled: boolean;
  onAnswer: (option: number) => void;
}) {
  const style = TEAM_STYLES[team.color];
  const won = duel.winner === side;
  const locked = duel.locked[side];
  const decided = duel.winner !== null || revealed;
  const waiting = locked && !decided;
  const closed = disabled || decided || locked;

  return (
    <div data-side={side} className="relative flex min-h-0 flex-col rounded-xl p-2 sm:p-3" style={{ background: style.soft, boxShadow: won ? `inset 0 0 0 0.25rem ${style.base}` : undefined }}>
      <div className={`flex items-center gap-2 px-1 ${side === 1 ? "flex-row-reverse" : ""}`}>
        <TeamEmblem color={team.color} className="size-6 shrink-0" />
        <span className="truncate text-lg font-bold" style={{ color: style.base }}>
          {team.name}
        </span>
        <AnimatePresence>
          {won && (
            <motion.span
              key="won"
              className={`flex items-center gap-1 rounded-md bg-zumrut px-2 py-0.5 text-sm font-bold text-ink-950 ${side === 1 ? "mr-auto" : "ml-auto"}`}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={spring.celebrate}
            >
              <Check className="size-4" strokeWidth={3} /> Bildi!
            </motion.span>
          )}
          {locked && (
            <motion.span
              key="locked"
              className={`flex items-center gap-1 rounded-md bg-mercan px-2 py-0.5 text-sm font-bold text-ink-950 ${side === 1 ? "mr-auto" : "ml-auto"}`}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={spring.celebrate}
            >
              <X className="size-4" strokeWidth={3} /> Yanlış
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <div className="relative mt-2 grid min-h-0 flex-1 auto-rows-[minmax(3.25rem,1fr)] grid-cols-2 gap-2 sm:gap-3">
        {order.map((original, shown) => {
          const correct = original === question.correctIndex;
          const picked = duel.picked[side] === original;
          let tone: "idle" | "correct" | "wrong" | "dim" = "idle";
          if (decided) tone = correct && (revealed || won) ? "correct" : picked && revealed ? "wrong" : "dim";
          else if (locked) tone = "dim";
          const colors = {
            idle: { bg: "var(--color-ink-800)", fg: "var(--color-cream)", edge: "var(--color-ink-950)" },
            correct: { bg: "var(--color-zumrut)", fg: "var(--color-ink-950)", edge: "var(--color-zumrut-deep)" },
            wrong: { bg: "var(--color-mercan)", fg: "var(--color-ink-950)", edge: "var(--color-mercan-deep)" },
            dim: { bg: "var(--color-ink-850)", fg: "var(--color-ink-400)", edge: "var(--color-ink-900)" },
          }[tone];
          const text = question.options[original];
          return (
            <button
              key={`${question.id}-${original}`}
              type="button"
              disabled={closed}
              // İki öğrenci aynı anda dokunabilsin: tıklama olayı çoklu dokunuşta yalnız birine gider.
              onPointerDown={(e) => {
                if (e.button !== 0 || closed) return;
                e.preventDefault();
                onAnswer(original);
              }}
              onKeyDown={(e) => {
                if (closed || (e.key !== "Enter" && e.key !== " ")) return;
                e.preventDefault();
                onAnswer(original);
              }}
              className="pressable flex min-h-0 items-center gap-3 rounded-lg px-3 text-left disabled:cursor-default"
              style={{ background: colors.bg, color: colors.fg, "--edge": colors.edge } as CSSProperties}
            >
              <span
                className="grid size-9 shrink-0 place-items-center rounded-md text-lg font-bold sm:size-10"
                style={{ background: tone === "idle" ? "var(--color-ink-700)" : "rgb(7 18 40 / 0.18)", color: tone === "idle" ? style.base : "inherit" }}
              >
                {tone === "correct" ? <Check className="size-6" strokeWidth={3} /> : tone === "wrong" ? <X className="size-6" strokeWidth={3} /> : LETTERS[shown]}
              </span>
              <span className={`leading-tight font-semibold ${text.length > 34 ? "text-base sm:text-lg" : text.length > 16 ? "text-lg sm:text-xl" : "text-lg sm:text-2xl"}`}>{text}</span>
            </button>
          );
        })}
        <AnimatePresence>
          {waiting && (
            <motion.div
              key="wait"
              className="absolute inset-0 grid place-items-center rounded-lg bg-ink-950/75"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: dur.base, ease }}
            >
              <p className="flex items-center gap-3 text-2xl font-bold text-cream">
                <Hourglass className="size-7 text-kehribar" /> Yanlış! Rakibini bekle.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
