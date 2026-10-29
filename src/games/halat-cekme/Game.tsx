"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, Flame, Snowflake, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { GameIntro } from "@/components/game/GameIntro";
import { Results } from "@/components/game/Results";
import { Button } from "@/components/ui/Button";
import { TeamEmblem } from "@/components/ui/TeamEmblem";
import type { PlayableQuestion } from "@/core/deck";
import { clock, usePersistentReducer, useNow } from "@/lib/hooks";
import { dur, ease, spring } from "@/lib/motion";
import { sfx } from "@/lib/sound";
import { halatCekme } from "../registry";
import { TEAM_STYLES } from "../teams";
import type { AnswerLog, GameProps, Team } from "../types";
import { createTug, FREEZE_MS, tugReducer, type SideState, type TugSettings, type TugState } from "./logic";
import { TugScene, type SceneInput, type SceneTeam } from "./scene/TugScene";

const LETTERS = ["A", "B", "C", "D"];
/** Bitiş gösterisinin süresi; sonra sonuç ekranı gelir. */
const SHOWTIME_MS = 4_600;

function formatClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Bir takımın son cevaplarından üst üste kaç doğru geldiği. */
function streakOf(log: AnswerLog[], teamId: string) {
  let n = 0;
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i].teamId !== teamId) continue;
    if (!log[i].correct) break;
    n++;
  }
  return n;
}

export default function HalatCekme({ config, deck, onRestart }: GameProps) {
  const settings = config.settings as unknown as TugSettings;
  const teams = config.teams.slice(0, 2) as [Team, Team];
  const reducer = useMemo(() => tugReducer(deck), [deck]);
  const [s, dispatch] = usePersistentReducer<TugState, Parameters<typeof reducer>[1]>(config.sessionId, reducer, () => createTug(teams, settings));
  const reducedMotion = Boolean(useReducedMotion());

  const playing = s.phase === "playing";
  const now = useNow(playing, 100);
  const countdown = playing && s.startsAt !== null ? Math.ceil((s.startsAt - now) / 1000) : 0;
  const goFlash = playing && s.startsAt !== null && now >= s.startsAt && now - s.startsAt < 800;
  const remaining = s.endsAt !== null ? s.endsAt - Math.max(now, s.startsAt ?? now) : settings.seconds * 1000;

  // Oyun bu ekranda biterse önce bitiş gösterisi oynar; bitmiş hâlde açıldıysa sonuçlar hemen gelir.
  const [showResults, setShowResults] = useState(() => s.phase === "finished");
  useEffect(() => {
    if (s.phase !== "finished" || showResults) return;
    const id = window.setTimeout(() => setShowResults(true), SHOWTIME_MS);
    return () => window.clearTimeout(id);
  }, [s.phase, showResults]);

  useEffect(() => {
    if (playing && s.endsAt !== null && now >= s.endsAt) dispatch({ type: "time-up", now: clock() });
  }, [playing, now, s.endsAt, dispatch]);

  const lastCount = useRef<number | null>(null);
  useEffect(() => {
    if (!playing || lastCount.current === countdown) return;
    lastCount.current = countdown;
    if (countdown > 0 && countdown <= 3) sfx.count();
    else if (countdown === 0) sfx.go();
  }, [playing, countdown]);

  const winnerIndex = s.winner === null ? null : s.winner === "draw" ? "draw" : s.winner === teams[0].id ? 0 : 1;
  const frozen: [boolean, boolean] = [0, 1].map((i) => {
    const f = s.sides[i].frozenUntil;
    return f !== null && now < f;
  }) as [boolean, boolean];
  const sceneInput: SceneInput = {
    rope: s.rope,
    target: s.settings.target,
    phase: s.phase === "finished" ? "finished" : playing && countdown <= 0 ? "go" : "ready",
    winner: winnerIndex,
    pullAt: [s.sides[0].correct, s.sides[1].correct],
    missAt: [s.sides[0].wrong, s.sides[1].wrong],
    frozen,
  };

  if (s.phase === "ready") {
    return (
      <GameIntro
        game={halatCekme}
        teams={teams}
        questionInfo={`${formatClock(settings.seconds * 1000)} dakika. İpi ${settings.target} adım kendi tarafına çeken kazanır, kaybeden çamura düşer.`}
        onStart={() => dispatch({ type: "start", now: clock() })}
      />
    );
  }

  if (s.phase === "finished" && showResults) {
    return (
      <Results
        standings={s.sides
          .map((side, i) => ({
            team: teams[i],
            score: side.correct,
            detail: `${side.correct} doğru, ${side.wrong} yanlış`,
          }))
          .sort((a, b) => (s.winner === b.team.id ? 1 : s.winner === a.team.id ? -1 : b.score - a.score))}
        scoreLabel="doğru"
        winnerId={s.winner}
        log={s.log}
        deck={deck}
        onRestart={onRestart}
        setupHref={`/kurulum?oyun=${config.gameId}`}
      />
    );
  }

  const finished = s.phase === "finished";
  const sceneTeams: [SceneTeam, SceneTeam] = [
    { base: TEAM_STYLES[teams[0].color].base, deep: TEAM_STYLES[teams[0].color].deep },
    { base: TEAM_STYLES[teams[1].color].base, deep: TEAM_STYLES[teams[1].color].deep },
  ];
  const winnerTeam = typeof winnerIndex === "number" ? teams[winnerIndex] : null;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="relative mx-4 h-[44%] min-h-[13rem] shrink-0 overflow-hidden rounded-xl bg-ink-950 shadow-[var(--surface-light)] sm:mx-6">
        <TugScene input={sceneInput} teams={sceneTeams} reducedMotion={reducedMotion} />

        {/* Yayın tarzı skor çubuğu: takımlar ve süre tek yerde */}
        <ScoreBug teams={teams} sides={s.sides} log={s.log} frozen={frozen} clock={formatClock(finished ? 0 : remaining)} finished={finished} />

        {/* Doğru cevapta çeken takımın üstünde +1 */}
        {([0, 1] as const).map((i) => {
          const last = s.sides[i].last;
          const show = !finished && last?.correct && now - last.at < 900;
          return (
            <AnimatePresence key={i}>
              {show && (
                <motion.span
                  key={last!.at}
                  className="pointer-events-none absolute top-[30%] text-5xl font-bold"
                  style={{ left: i === 0 ? "22%" : "70%", color: TEAM_STYLES[teams[i].color].base, textShadow: "0 0.2rem 0 rgb(7 18 40 / 0.6)" }}
                  initial={{ y: 20, opacity: 0, scale: 0.6 }}
                  animate={{ y: -30, opacity: 1, scale: 1 }}
                  exit={{ y: -60, opacity: 0 }}
                  transition={spring.celebrate}
                >
                  Çek!
                </motion.span>
              )}
            </AnimatePresence>
          );
        })}

      </div>

      <div className="relative grid min-h-0 flex-1 grid-cols-2">
        {([0, 1] as const).map((i) => (
          <SidePanel
            key={teams[i].id}
            side={i}
            team={teams[i]}
            state={s.sides[i]}
            deck={deck}
            now={now}
            locked={countdown > 0 || finished}
            onAnswer={(option) => dispatch({ type: "answer", side: i, option, now: clock() })}
          />
        ))}
        {finished && (
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center gap-8 bg-ink-900/90"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: dur.base }}
          >
            <motion.p
              className="flex items-center gap-4 text-6xl font-bold"
              style={{ color: winnerTeam ? TEAM_STYLES[winnerTeam.color].base : "var(--color-cream)" }}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ ...spring.celebrate, delay: 0.7 }}
            >
              {winnerTeam && <TeamEmblem color={winnerTeam.color} className="size-14" />}
              {winnerTeam ? `${winnerTeam.name} kazandı!` : "Berabere! İp koptu!"}
            </motion.p>
            <Button variant="primary" size="xl" icon={<ArrowRight className="size-7" />} iconAfter onClick={() => setShowResults(true)}>
              Sonuçlar
            </Button>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {(countdown > 0 || goFlash) && (
          <motion.div
            className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-ink-950/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: dur.fast }}
          >
            <AnimatePresence mode="popLayout">
              <motion.span
                key={countdown > 0 ? countdown : "go"}
                className={`tabular leading-none font-bold ${countdown > 0 ? "text-[12rem] text-kehribar" : "text-[10rem] text-zumrut"}`}
                style={{ textShadow: "0 0.5rem 0 rgb(7 18 40 / 0.7)" }}
                initial={{ scale: 1.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.7, opacity: 0 }}
                transition={spring.celebrate}
              >
                {countdown > 0 ? countdown : "ÇEK!"}
              </motion.span>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ScoreBug({
  teams,
  sides,
  log,
  frozen,
  clock: time,
  finished,
}: {
  teams: [Team, Team];
  sides: [SideState, SideState];
  log: AnswerLog[];
  frozen: [boolean, boolean];
  clock: string;
  finished: boolean;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
      <div className="flex items-start gap-2">
        {([0, 1] as const).map((i) => {
          const team = teams[i];
          const style = TEAM_STYLES[team.color];
          const streak = streakOf(log, team.id);
          return (
            <div key={team.id} className={`flex flex-col gap-2 ${i === 0 ? "order-1 items-end" : "order-3 items-start"}`}>
              <div
                className={`flex items-center gap-3 rounded-xl bg-ink-950/85 py-2 ${i === 0 ? "pr-4 pl-3" : "flex-row-reverse pr-3 pl-4"}`}
                style={{ boxShadow: `inset 0 -0.3rem 0 ${style.base}` }}
              >
                <TeamEmblem color={team.color} className="size-8" />
                <span className="max-w-[14rem] truncate text-2xl font-bold" style={{ color: style.base }}>
                  {team.name}
                </span>
                <span className="tabular min-w-[2ch] text-center text-3xl font-bold">{sides[i].correct}</span>
              </div>
              <AnimatePresence>
                {frozen[i] && !finished && (
                  <motion.p
                    key="frozen"
                    className="flex items-center gap-2 rounded-lg px-3 py-1 text-lg font-bold text-ink-950"
                    style={{ background: "rgb(190 235 255)" }}
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={spring.celebrate}
                  >
                    <Snowflake className="size-5" /> Dondu!
                  </motion.p>
                )}
                {!frozen[i] && !finished && streak >= 3 && (
                  <motion.p
                    key={`streak-${streak}`}
                    className="flex items-center gap-1.5 rounded-lg bg-kehribar px-3 py-1 text-lg font-bold text-ink-950"
                    initial={{ scale: 0.6, opacity: 0, rotate: -6 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={spring.celebrate}
                  >
                    <Flame className="size-5 fill-current" /> {streak}&apos;lü seri!
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          );
        })}
        <div className="tabular order-2 rounded-xl bg-ink-950/85 px-4 py-2 text-3xl font-bold" role="timer">
          {time}
        </div>
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

  return (
    <section
      className={`relative flex min-h-0 flex-col px-4 pt-3 pb-5 sm:px-6 ${side === 0 ? "border-r-2 border-ink-800" : ""}`}
      aria-label={`${team.name} soruları`}
    >
      <div className={`flex items-center gap-2 ${side === 1 ? "flex-row-reverse" : ""}`}>
        <TeamEmblem color={team.color} className="size-5" />
        <span className="text-sm font-bold tracking-wide uppercase" style={{ color: style.base }}>
          {team.name}
        </span>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${shownIndex}-${frozen ? "f" : "a"}`}
          className="flex min-h-0 flex-1 flex-col"
          initial={{ opacity: 0, x: side === 0 ? -16 : 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: dur.base, ease }}
        >
          <h2 className={`mt-2 leading-tight font-bold text-balance ${q.prompt.length > 90 ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl"}`}>{q.prompt}</h2>
          <div
            className="mt-4 grid min-h-0 flex-1 grid-cols-2 content-start gap-3"
            style={{ gridTemplateRows: `repeat(${Math.ceil(q.options.length / 2)}, minmax(0, 8.5rem))` }}
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
                  className="pressable flex min-h-0 items-center gap-4 rounded-lg px-4 text-left disabled:cursor-default"
                  style={{ background: colors.bg, color: colors.fg, "--edge": colors.edge } as CSSProperties}
                >
                  <span
                    className="grid size-11 shrink-0 place-items-center rounded-md text-xl font-bold"
                    style={{ background: tone === "idle" ? "var(--color-ink-700)" : "rgb(7 18 40 / 0.18)", color: tone === "idle" ? style.base : "inherit" }}
                  >
                    {tone === "correct" ? <Check className="size-7" strokeWidth={3} /> : tone === "wrong" ? <X className="size-7" strokeWidth={3} /> : LETTERS[i]}
                  </span>
                  <span className={`leading-tight font-semibold ${long ? "text-lg sm:text-xl" : "text-xl sm:text-2xl"}`}>{option}</span>
                </button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      {frozen && state.frozenUntil !== null && (
        <div key={state.frozenUntil} className="absolute inset-x-6 bottom-1.5 h-1.5 overflow-hidden rounded-full bg-ink-800" aria-hidden>
          <motion.div
            className="h-full origin-left rounded-full"
            style={{ background: "rgb(190 235 255)" }}
            initial={{ scaleX: 1 }}
            animate={{ scaleX: 0 }}
            transition={{ duration: FREEZE_MS / 1000, ease: "linear" }}
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
