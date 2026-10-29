"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, X } from "lucide-react";
import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { GameIntro } from "@/components/game/GameIntro";
import { Results } from "@/components/game/Results";
import { TeamEmblem } from "@/components/ui/TeamEmblem";
import type { PlayableQuestion } from "@/core/deck";
import { usePersistentReducer, useNow } from "@/lib/hooks";
import { sfx } from "@/lib/sound";
import { halatCekme } from "../registry";
import { TEAM_STYLES } from "../teams";
import type { GameProps, Team } from "../types";
import { createTug, FREEZE_MS, tugReducer, type SideState, type TugSettings, type TugState } from "./logic";
import { dur, ease, spring } from "@/lib/motion";

const LETTERS = ["A", "B", "C", "D"];

function formatClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export default function HalatCekme({ config, deck, onRestart }: GameProps) {
  const settings = config.settings as unknown as TugSettings;
  const teams = config.teams.slice(0, 2) as [Team, Team];
  const reducer = useMemo(() => tugReducer(deck), [deck]);
  const [s, dispatch] = usePersistentReducer<TugState, Parameters<typeof reducer>[1]>(config.sessionId, reducer, () => createTug(teams, settings));

  const playing = s.phase === "playing";
  const now = useNow(playing, 100);
  const countdown = playing && s.startsAt !== null ? Math.ceil((s.startsAt - now) / 1000) : 0;
  const remaining = s.endsAt !== null ? s.endsAt - Math.max(now, s.startsAt ?? now) : settings.seconds * 1000;

  useEffect(() => {
    if (playing && s.endsAt !== null && now >= s.endsAt) dispatch({ type: "time-up", now: Date.now() });
  }, [playing, now, s.endsAt, dispatch]);

  // Geri sayım sesleri
  const lastCount = useRef<number | null>(null);
  useEffect(() => {
    if (!playing || lastCount.current === countdown) return;
    lastCount.current = countdown;
    if (countdown > 0 && countdown <= 3) sfx.count();
    else if (countdown === 0) sfx.go();
  }, [playing, countdown]);

  if (s.phase === "ready") {
    return (
      <GameIntro
        game={halatCekme}
        teams={teams}
        questionInfo={`${formatClock(settings.seconds * 1000)} dakika. İpi ${settings.target} adım kendi tarafına çeken kazanır.`}
        onStart={() => dispatch({ type: "start", now: Date.now() })}
      />
    );
  }

  if (s.phase === "finished") {
    return (
      <Results
        standings={s.sides
          .map((side, i) => ({
            team: teams[i],
            score: side.correct,
            detail: `${side.correct} doğru, ${side.wrong} yanlış`,
          }))
          .sort((a, b) => (s.winner === b.team.id ? 1 : s.winner === a.team.id ? -1 : b.score - a.score))}
        winnerId={s.winner}
        log={s.log}
        deck={deck}
        onRestart={onRestart}
        setupHref={`/kurulum?oyun=${config.gameId}`}
      />
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <RopeArena state={s} teams={teams} remainingMs={remaining} />

      <div className="grid min-h-0 flex-1 grid-cols-2">
        {([0, 1] as const).map((i) => (
          <SidePanel
            key={teams[i].id}
            side={i}
            team={teams[i]}
            state={s.sides[i]}
            deck={deck}
            now={now}
            locked={countdown > 0}
            onAnswer={(option) => dispatch({ type: "answer", side: i, option, now: Date.now() })}
          />
        ))}
      </div>

      <AnimatePresence>
        {countdown > 0 && (
          <motion.div
            className="absolute inset-0 z-30 grid place-items-center bg-ink-950/75"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: dur.fast }}
          >
            <AnimatePresence mode="popLayout">
              <motion.span
                key={countdown}
                className="tabular text-[12rem] leading-none font-bold text-kehribar"
                initial={{ scale: 1.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.7, opacity: 0 }}
                transition={spring.celebrate}
              >
                {countdown}
              </motion.span>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RopeArena({ state, teams, remainingMs }: { state: TugState; teams: [Team, Team]; remainingMs: number }) {
  const target = state.settings.target;
  const left = TEAM_STYLES[teams[0].color];
  const right = TEAM_STYLES[teams[1].color];
  // İp, iki uç çizgi arasında adım adım kayar: -target sol çizgi, +target sağ çizgi.
  const span = 40; // düğümün merkezden çizgiye uzaklığı, yüzde
  const knot = (state.rope / target) * span;

  const lastRope = useRef(state.rope);
  useEffect(() => {
    if (state.rope !== lastRope.current) sfx.pull();
    lastRope.current = state.rope;
  }, [state.rope]);

  return (
    <div className="mx-8 mb-4 shrink-0 rounded-xl bg-ink-850 px-6 pt-3 pb-4 shadow-[var(--surface-light)]">
      <div className="flex items-center justify-between gap-6">
        <TeamTag team={teams[0]} correct={state.sides[0].correct} />
        <div className="tabular rounded-lg bg-ink-950/70 px-4 py-1 text-3xl font-bold" role="timer">
          {formatClock(remainingMs)}
        </div>
        <TeamTag team={teams[1]} correct={state.sides[1].correct} alignRight />
      </div>

      <div className="relative mt-3 h-20 overflow-hidden rounded-lg bg-ink-900/70">
        {/* Kazanma alanları ve çizgileri */}
        <div className="absolute inset-y-0 left-0" style={{ width: `${50 - span}%`, background: left.soft }} />
        <div className="absolute inset-y-0 right-0" style={{ width: `${50 - span}%`, background: right.soft }} />
        <div className="absolute inset-y-0 w-1 -translate-x-1/2" style={{ left: `${50 - span}%`, background: left.base }} />
        <div className="absolute inset-y-0 w-1 translate-x-1/2" style={{ right: `${50 - span}%`, background: right.base }} />

        {/* Adım işaretleri */}
        {Array.from({ length: target * 2 - 1 }, (_, k) => k - (target - 1)).map((step) => (
          <div
            key={step}
            className={`absolute bottom-2 w-0.5 -translate-x-1/2 rounded-full ${step === 0 ? "h-5 bg-cream" : "h-3 bg-ink-600"}`}
            style={{ left: `${50 + (step / target) * span}%` }}
          />
        ))}

        {/* İp ve düğüm birlikte kayar */}
        <motion.div
          className="absolute inset-y-0 -inset-x-[50%]"
          animate={{ x: `${knot / 2}%` }}
          transition={spring.rope}
        >
          <div
            className="absolute top-1/2 h-4 w-full -translate-y-1/2 rounded-full"
            style={{
              background: "repeating-linear-gradient(115deg, #d9b77c 0 0.5rem, #b48a4a 0.5rem 0.85rem)",
              boxShadow: "0 0.25rem 0 rgb(0 0 0 / 0.25)",
            }}
          />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <svg viewBox="0 0 24 24" className="size-14 drop-shadow-[0_0.25rem_0_rgb(0_0_0_/_0.3)]" aria-hidden>
              <polygon
                points="12,0.5 15.2,4.3 20.1,3.9 19.7,8.8 23.5,12 19.7,15.2 20.1,20.1 15.2,19.7 12,23.5 8.8,19.7 3.9,20.1 4.3,15.2 0.5,12 4.3,8.8 3.9,3.9 8.8,4.3"
                fill="var(--color-cream)"
              />
              <circle cx="12" cy="12" r="4" fill="var(--color-mercan)" />
            </svg>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function TeamTag({ team, correct, alignRight = false }: { team: Team; correct: number; alignRight?: boolean }) {
  const style = TEAM_STYLES[team.color];
  return (
    <div className={`flex items-center gap-3 ${alignRight ? "flex-row-reverse text-right" : ""}`}>
      <TeamEmblem color={team.color} className="size-9" />
      <div className="leading-tight">
        <p className="text-2xl font-bold" style={{ color: style.base }}>
          {team.name}
        </p>
        <p className="tabular text-sm text-ink-300">{correct} doğru</p>
      </div>
    </div>
  );
}

function SidePanel({
  side,
  team,
  state,
  deck,
  now,
  locked,
  onAnswer,
}: {
  side: 0 | 1;
  team: Team;
  state: SideState;
  deck: PlayableQuestion[];
  now: number;
  locked: boolean;
  onAnswer: (option: number) => void;
}) {
  const style = TEAM_STYLES[team.color];
  const frozen = state.frozenUntil !== null && now < state.frozenUntil && state.last !== null;
  const flashCorrect = state.last?.correct && now - state.last.at < 450;
  const shownIndex = frozen && state.last ? state.last.question : state.question;
  const q = deck[shownIndex % deck.length];
  const long = q.options.some((o) => o.length > 22);

  const lastAt = useRef(state.last?.at);
  useEffect(() => {
    if (!state.last || state.last.at === lastAt.current) return;
    lastAt.current = state.last.at;
    if (!state.last.correct) sfx.wrong();
  }, [state.last]);

  return (
    <section
      className={`relative flex min-h-0 flex-col px-8 pt-2 pb-6 ${side === 0 ? "border-r-2 border-ink-800" : ""}`}
      aria-label={`${team.name} soruları`}
    >
      <div className="h-1.5 w-24 rounded-full" style={{ background: style.base }} aria-hidden />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${shownIndex}-${frozen ? "f" : "a"}`}
          className="flex min-h-0 flex-1 flex-col"
          initial={{ opacity: 0, x: side === 0 ? -16 : 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: dur.base, ease }}
        >
          <h2 className={`mt-4 leading-tight font-bold text-balance ${q.prompt.length > 90 ? "text-2xl" : "text-3xl"}`}>{q.prompt}</h2>
          <div
            className="mt-5 grid min-h-0 flex-1 grid-cols-2 content-start gap-3"
            style={{ gridTemplateRows: `repeat(${Math.ceil(q.options.length / 2)}, minmax(0, 10rem))` }}
          >
            {q.options.map((option, i) => {
              const tone = frozen ? (i === q.correctIndex ? "correct" : i === state.last?.option ? "wrong" : "dim") : "idle";
              const colors = {
                idle: { bg: "var(--color-ink-800)", fg: "var(--color-cream)", edge: "var(--color-ink-950)" },
                correct: { bg: "var(--color-zumrut)", fg: "var(--color-ink-950)", edge: "var(--color-zumrut-deep)" },
                wrong: { bg: "var(--color-mercan)", fg: "var(--color-ink-950)", edge: "var(--color-mercan-deep)" },
                dim: { bg: "var(--color-ink-850)", fg: "var(--color-ink-400)", edge: "var(--color-ink-900)" },
              }[tone];
              return (
                <button
                  key={i}
                  type="button"
                  disabled={frozen || locked}
                  // Çoklu dokunuş: iki öğrenci aynı anda bastığında tıklama olayı yalnız birine gider; pointerdown ikisine de gelir.
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    e.preventDefault();
                    onAnswer(i);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onAnswer(i);
                    }
                  }}
                  className="pressable flex min-h-0 items-center gap-4 rounded-lg px-5 text-left disabled:cursor-default"
                  style={{ background: colors.bg, color: colors.fg, "--edge": colors.edge } as CSSProperties}
                >
                  <span
                    className="grid size-11 shrink-0 place-items-center rounded-md text-xl font-bold"
                    style={{ background: tone === "idle" ? "var(--color-ink-700)" : "rgb(7 18 40 / 0.18)", color: tone === "idle" ? style.base : "inherit" }}
                  >
                    {tone === "correct" ? <Check className="size-7" strokeWidth={3} /> : tone === "wrong" ? <X className="size-7" strokeWidth={3} /> : LETTERS[i]}
                  </span>
                  <span className={`leading-tight font-semibold ${long ? "text-xl" : "text-2xl"}`}>{option}</span>
                </button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      {frozen && state.frozenUntil !== null && (
        <div key={state.frozenUntil} className="absolute inset-x-8 bottom-2 h-1.5 overflow-hidden rounded-full bg-ink-800" aria-hidden>
          <motion.div
            className="h-full origin-left rounded-full bg-mercan"
            initial={{ scaleX: 1 }}
            animate={{ scaleX: 0 }}
            transition={{ duration: Math.max(0, state.frozenUntil - now) / 1000 || FREEZE_MS / 1000, ease: "linear" }}
          />
        </div>
      )}

      <AnimatePresence>
        {flashCorrect && (
          <motion.div
            key={state.last?.at}
            className="pointer-events-none absolute inset-0 grid place-items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: dur.fast }}
          >
            <motion.span
              className="grid size-28 place-items-center rounded-full bg-zumrut text-ink-950"
              initial={{ scale: 0.4 }}
              animate={{ scale: 1 }}
              transition={spring.celebrate}
            >
              <Check className="size-16" strokeWidth={3.5} />
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
