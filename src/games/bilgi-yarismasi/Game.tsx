"use client";

import confetti from "canvas-confetti";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, Clock, Crown, Divide, Flame, Pause, Play, SkipForward, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { GameIntro } from "@/components/game/GameIntro";
import { Results } from "@/components/game/Results";
import { TimerRing } from "@/components/game/TimerRing";
import { Button } from "@/components/ui/Button";
import { TeamEmblem } from "@/components/ui/TeamEmblem";
import { findUnit } from "@/core/repository";
import { clock, usePersistentReducer, useNow } from "@/lib/hooks";
import { dur, ease, spring, stagger } from "@/lib/motion";
import { cssColor } from "@/lib/color";
import { sfx } from "@/lib/sound";
import { bilgiYarismasi } from "../registry";
import { TEAM_STYLES } from "../teams";
import type { AnswerLog, GameProps, Team } from "../types";
import {
  createQuiz,
  currentTeam,
  POINTS_CORRECT,
  POINTS_STEAL,
  quizReducer,
  standings,
  totalQuestions,
  type JokerKind,
  type QuizSettings,
  type QuizState,
} from "./logic";

const LETTERS = ["A", "B", "C", "D"];

function promptSize(text: string) {
  if (text.length <= 70) return "text-3xl sm:text-5xl";
  if (text.length <= 125) return "text-2xl sm:text-4xl";
  return "text-2xl sm:text-3xl";
}

/** Yeniden yüklenen bir oyunda süre kendiliğinden akmasın: öğretmen "Devam" diyene kadar duraklatılır. */
function hydrate(s: QuizState): QuizState {
  if (s.phase === "question" && s.deadline !== null) {
    return { ...s, deadline: null, remaining: Math.max(5_000, s.deadline - Date.now()) };
  }
  return s;
}

export default function BilgiYarismasi({ config, deck, onRestart }: GameProps) {
  const settings = config.settings as unknown as QuizSettings;
  const reducer = useMemo(() => quizReducer(deck), [deck]);
  const [s, dispatch] = usePersistentReducer(config.sessionId, reducer, () => createQuiz(config.teams, settings), hydrate);

  const q = deck[s.current];
  const team = currentTeam(s);
  const timed = s.phase === "question" && s.deadline !== null;
  const now = useNow(timed, 100);
  const remaining = s.deadline !== null ? s.deadline - now : (s.remaining ?? 0);
  const paused = s.phase === "question" && s.deadline === null && s.remaining !== null;

  // Süre dolunca
  useEffect(() => {
    if (timed && remaining <= 0) dispatch({ type: "timeout", now: Date.now() });
  }, [timed, remaining, dispatch]);

  // Son beş saniyede tik sesi
  const lastTick = useRef<number | null>(null);
  const secondsLeft = Math.ceil(remaining / 1000);
  useEffect(() => {
    if (!timed || secondsLeft > 5 || secondsLeft <= 0 || lastTick.current === secondsLeft) return;
    lastTick.current = secondsLeft;
    sfx.tick();
  }, [timed, secondsLeft]);

  // Sonuç sesleri
  const lastOutcome = useRef(s.outcome);
  useEffect(() => {
    if (s.outcome === lastOutcome.current) return;
    lastOutcome.current = s.outcome;
    if (s.outcome === "correct") sfx.correct();
    else if (s.outcome === "stolen") {
      sfx.correct();
      sfx.thud();
    }
    else if (s.outcome === "wrong" || s.outcome === "timeout" || s.outcome === "steal-failed") sfx.wrong();
  }, [s.outcome]);

  // Klavye: A-D / 1-4 cevap, Enter sonraki, P duraklat. Dizüstünden yöneten öğretmen için.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey) return;
      const key = e.key.toLowerCase();
      const index = ["a", "b", "c", "d"].indexOf(key) !== -1 ? ["a", "b", "c", "d"].indexOf(key) : ["1", "2", "3", "4"].indexOf(key);
      if (index !== -1) {
        pick(index);
      } else if ((key === "enter" || key === " ") && s.phase === "reveal") {
        e.preventDefault();
        dispatch({ type: "next", now: Date.now() });
      } else if (key === "p" && s.phase === "question") {
        dispatch({ type: paused ? "resume" : "pause", now: Date.now() });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const unitTitle = q ? findUnit(q.unit)?.title : undefined;
  const reducedMotion = useReducedMotion();
  const [flights, setFlights] = useState<Flight[]>([]);
  const flightId = useRef(0);
  /** Doğru şıktan takımın skor kutusuna uçan puan ve şıktan çıkan konfeti. */
  function celebrate(option: number, scorer: Team, points: number) {
    if (reducedMotion) return;
    const tile = document.querySelector(`[data-tile="${option}"]`);
    const pill = document.querySelector(`[data-team-pill="${scorer.id}"]`);
    if (!tile || !pill) return;
    const a = tile.getBoundingClientRect();
    const b = pill.getBoundingClientRect();
    const from = { x: a.left + a.width / 2, y: a.top + a.height / 2 };
    const to = { x: b.right - b.height * 0.9, y: b.top + b.height / 2 };
    const color = TEAM_STYLES[scorer.color].base;
    confetti({
      particleCount: 50,
      spread: 80,
      startVelocity: 34,
      scalar: 0.9,
      origin: { x: from.x / window.innerWidth, y: from.y / window.innerHeight },
      colors: [color, "var(--color-kehribar)", "var(--color-zumrut)", "var(--color-cream)"].map(cssColor),
      disableForReducedMotion: true,
    });
    flightId.current += 1;
    const id = flightId.current;
    setFlights((list) => [...list, { id, from, to, text: `+${points}`, color }]);
  }

  function pick(option: number) {
    if (s.phase === "question" && !paused) {
      if (option === q.correctIndex && !s.hidden.includes(option)) celebrate(option, team, POINTS_CORRECT);
      dispatch({ type: "answer", option, now: clock() });
    } else if (s.phase === "steal" && s.stealTeam) {
      const thief = s.teams.find((t) => t.id === s.stealTeam)!;
      if (option === q.correctIndex && option !== s.picked && !s.hidden.includes(option)) celebrate(option, thief, POINTS_STEAL);
      dispatch({ type: "steal-answer", option });
    }
  }

  if (s.phase === "ready") {
    return (
      <GameIntro
        game={bilgiYarismasi}
        teams={s.teams}
        questionInfo={`${totalQuestions(s)} soru, her takıma ${settings.rounds} soru${settings.seconds ? `, soru başına ${settings.seconds} saniye` : ""}.`}
        onStart={() => {
          sfx.go();
          dispatch({ type: "start", now: Date.now() });
        }}
      />
    );
  }

  if (s.phase === "finished") {
    const list = standings(s);
    const top = list[0];
    const tie = list.length > 1 && list[1].score === top.score;
    return (
      <Results
        standings={list.map(({ team, score }) => {
          const answers = s.log.filter((l) => l.teamId === team.id);
          const right = answers.filter((l) => l.correct).length;
          const steals = answers.filter((l) => l.stolen && l.correct).length;
          return { team, score, detail: `${right} doğru${steals ? `, ${steals} çalınan soru` : ""}` };
        })}
        winnerId={tie ? "draw" : top.team.id}
        log={s.log}
        deck={deck}
        onRestart={onRestart}
        setupHref={`/kurulum?oyun=${config.gameId}`}
      />
    );
  }

  const revealing = s.phase === "reveal";
  const answering = s.phase === "question" || (s.phase === "steal" && s.stealTeam !== null);
  const stealTeam = s.teams.find((t) => t.id === s.stealTeam);
  const stealer = stealTeam;
  const activeTeam = s.phase === "steal" && stealTeam ? stealTeam : team;
  const activeStyle = TEAM_STYLES[activeTeam.color];


  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Scoreboard state={s} />

      {flights.map((f) => (
        <PointsFlight key={f.id} flight={f} onDone={() => setFlights((list) => list.filter((x) => x.id !== f.id))} />
      ))}

      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-5 sm:px-8 lg:overflow-visible">
        <AnimatePresence>
          {revealing && s.outcome === "stolen" && stealer && (
            <motion.div
              key={`stamp-${q.id}`}
              className="pointer-events-none absolute top-[58%] right-[12%] z-20 rounded-xl border-[0.35rem] bg-ink-900/85 px-6 py-1 text-6xl font-bold tracking-wide"
              style={{ borderColor: TEAM_STYLES[stealer.color].base, color: TEAM_STYLES[stealer.color].base, rotate: -10 }}
              initial={{ scale: 2.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={spring.celebrate}
            >
              ÇALDI!
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex items-start gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 text-lg text-ink-300">
              <span className="tabular font-semibold text-cream">
                Soru {Math.min(s.asked + (revealing || s.phase === "steal" ? 0 : 1), totalQuestions(s))}/{totalQuestions(s)}
              </span>
              {unitTitle && <span className="truncate">{unitTitle}</span>}
            </div>
            <AnimatePresence mode="wait">
              <motion.h2
                key={q.id}
                className={`mt-3 leading-[1.15] font-bold text-balance ${promptSize(q.prompt)}`}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: dur.base, ease }}
              >
                {q.prompt}
              </motion.h2>
            </AnimatePresence>
          </div>
          {settings.seconds > 0 && s.phase === "question" && (
            <button
              type="button"
              onClick={() => dispatch({ type: paused ? "resume" : "pause", now: Date.now() })}
              className="group relative shrink-0 rounded-full"
              aria-label={paused ? "Süreyi devam ettir" : "Süreyi duraklat"}
            >
              <TimerRing remainingMs={remaining} totalMs={settings.seconds * 1000} paused={paused} className="size-28 text-base" />
              <span className="absolute -bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-ink-800 px-2.5 py-0.5 text-xs font-semibold text-ink-300">
                {paused ? <Play className="size-3 fill-current" /> : <Pause className="size-3 fill-current" />}
                {paused ? "Devam" : "Duraklat"}
              </span>
            </button>
          )}
        </div>

        <div
          className={`mt-6 grid flex-1 auto-rows-[minmax(4.5rem,auto)] grid-cols-1 gap-3 pb-5 sm:min-h-0 sm:grid-cols-2 sm:gap-4 ${
            q.options.length > 2 ? "sm:grid-rows-2" : "sm:grid-rows-[minmax(0,15rem)] sm:content-center"
          }`}
        >
          {q.options.map((option, i) => {
            const hidden = s.hidden.includes(i);
            const isCorrect = i === q.correctIndex;
            const wasPicked = s.picked === i || s.stealPicked === i;
            const blocked = hidden || (s.phase === "steal" && s.picked === i);
            const state = revealing ? (isCorrect ? "correct" : wasPicked ? "wrong" : "dim") : blocked ? "blocked" : wasPicked && s.phase === "steal" ? "wrong" : "idle";
            return (
              <AnswerTile
                key={`${q.id}-${i}`}
                index={i}
                text={option}
                state={state}
                disabled={!answering || blocked}
                onPick={() => pick(i)}
                long={q.options.some((o) => o.length > 24)}
              />
            );
          })}
        </div>
      </div>

      <div className="relative min-h-[6.5rem] shrink-0">
        <AnimatePresence mode="wait" initial={false}>
          {s.phase === "question" && (
            <motion.div
              key="jokers"
              className="flex h-full flex-wrap items-center gap-3 px-4 pb-5 sm:gap-4 sm:px-8"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: dur.base, ease }}
            >
              <TurnBadge name={team.name} color={team.color} label="Sıra" />
              {settings.jokers && (
                <div className="ml-auto flex gap-3">
                  <JokerButton kind="half" state={s} optionCount={q.options.length} onUse={(joker) => dispatch({ type: "joker", joker, now: Date.now() })} />
                  {settings.seconds > 0 && <JokerButton kind="time" state={s} optionCount={q.options.length} onUse={(joker) => dispatch({ type: "joker", joker, now: Date.now() })} />}
                  <JokerButton kind="pass" state={s} optionCount={q.options.length} onUse={(joker) => dispatch({ type: "joker", joker, now: Date.now() })} />
                </div>
              )}
            </motion.div>
          )}

          {s.phase === "steal" && (
            <motion.div
              key="steal"
              className="flex h-full flex-wrap items-center gap-3 px-4 pb-5 sm:gap-4 sm:px-8"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: dur.base, ease }}
            >
              {stealTeam ? (
                <>
                  <TurnBadge name={stealTeam.name} color={stealTeam.color} label={`Çalıyor, +${POINTS_STEAL}`} />
                  <p className="text-xl text-ink-300">Kalan şıklardan birini seçin.</p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold">
                    <span className="text-mercan">{s.outcome === "timeout" ? "Süre doldu!" : "Yanlış!"}</span> Soruyu kim çalacak?
                  </p>
                  <div className="ml-auto flex gap-3">
                    {s.teams
                      .filter((t) => t.id !== team.id)
                      .map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          className="pressable flex h-16 items-center gap-3 rounded-lg px-6 text-xl font-bold text-ink-950"
                          style={{ background: TEAM_STYLES[t.color].base, "--edge": TEAM_STYLES[t.color].deep } as CSSProperties}
                          onClick={() => {
                            sfx.steal();
                            dispatch({ type: "steal-team", teamId: t.id });
                          }}
                        >
                          <TeamEmblem color={t.color} className="size-7 [&_*]:fill-ink-950" />
                          {t.name}
                        </button>
                      ))}
                    <Button size="lg" variant="quiet" onClick={() => dispatch({ type: "skip-steal" })}>
                      Kimse
                    </Button>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {revealing && (
            <motion.div
              key="reveal"
              className="flex h-full flex-wrap items-center gap-4 px-4 pb-5 sm:flex-nowrap sm:gap-6 sm:px-8"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: dur.base, ease }}
            >
              <OutcomeBanner state={s} />
              <p className="min-w-0 flex-1 basis-64 text-lg leading-snug text-cream-dim sm:text-xl">{q.explanation}</p>
              <Button variant="primary" size="xl" icon={<ArrowRight className="size-7" />} iconAfter onClick={() => dispatch({ type: "next", now: Date.now() })} autoFocus>
                {s.asked >= totalQuestions(s) ? "Sonuçlar" : "Sonraki"}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sırası gelen takımın rengi ekranın alt kenarında: arka sıralardan bile görülür. */}
      <motion.div className="h-2 shrink-0" animate={{ backgroundColor: activeStyle.base }} transition={{ duration: dur.base }} aria-hidden />
    </div>
  );
}

/** Bir takımın kendi sırasında üst üste kaç soruyu bildiği. Çalınan sorular seriyi bozmaz. */
function streakOf(log: AnswerLog[], teamId: string) {
  let n = 0;
  for (let i = log.length - 1; i >= 0; i--) {
    const entry = log[i];
    if (entry.teamId !== teamId || entry.stolen) continue;
    if (!entry.correct) break;
    n++;
  }
  return n;
}

function Scoreboard({ state }: { state: QuizState }) {
  const active = state.phase === "steal" && state.stealTeam ? state.stealTeam : currentTeam(state).id;
  const top = Math.max(...state.teams.map((t) => state.scores[t.id]));
  const leaders = state.teams.filter((t) => state.scores[t.id] === top);
  return (
    <div className="grid shrink-0 gap-2 px-4 sm:gap-3 sm:px-8" style={{ gridTemplateColumns: `repeat(${state.teams.length}, minmax(0, 1fr))` }}>
      {state.teams.map((t) => {
        const style = TEAM_STYLES[t.color];
        const isActive = t.id === active && state.phase !== "reveal";
        const leading = top > 0 && leaders.length === 1 && leaders[0].id === t.id;
        const streak = streakOf(state.log, t.id);
        return (
          <motion.div
            key={t.id}
            data-team-pill={t.id}
            className="relative flex items-center gap-2 rounded-lg px-3 py-2 sm:gap-3 sm:px-5 sm:py-3"
            animate={{
              backgroundColor: isActive ? style.soft : "rgb(16 35 74 / 1)",
              boxShadow: isActive ? `inset 0 0 0 3px ${style.base}` : "inset 0 0 0 0px transparent",
            }}
            transition={{ duration: dur.base }}
          >
            <TeamEmblem color={t.color} className="size-8" />
            <span className="hidden min-w-0 flex-1 truncate text-xl font-bold sm:block">{t.name}</span>
            <AnimatePresence>
              {streak >= 2 && (
                <motion.span
                  key={`streak-${streak}`}
                  className="flex items-center gap-1 rounded-md bg-kehribar px-2 py-0.5 text-base font-bold text-ink-950"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={spring.celebrate}
                  title={`Üst üste ${streak} doğru`}
                >
                  <Flame className="size-4 fill-current" />
                  {streak}
                </motion.span>
              )}
            </AnimatePresence>
            <Score value={state.scores[t.id]} color={style.base} />
            <AnimatePresence>
              {leading && (
                <motion.span
                  key="crown"
                  className="absolute -top-4 left-3"
                  initial={{ y: -14, opacity: 0, rotate: -25 }}
                  animate={{ y: 0, opacity: 1, rotate: -12 }}
                  exit={{ y: -10, opacity: 0 }}
                  transition={spring.celebrate}
                  aria-label="Önde"
                >
                  <Crown className="size-7 fill-kehribar text-kehribar" />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}

/** Puan, uçan "+100" kutuya vardığında artar. Sayfa yenilenince doğrudan güncel değerle açılır. */
function Score({ value, color }: { value: number; color: string }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (value === shown) return;
    const id = window.setTimeout(() => setShown(value), value > shown ? 720 : 0);
    return () => window.clearTimeout(id);
  }, [value, shown]);
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={shown}
        className="tabular text-3xl font-bold"
        style={{ color }}
        initial={{ y: 20, opacity: 0, scale: 1.5 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -20, opacity: 0 }}
        transition={spring.celebrate}
      >
        {shown}
      </motion.span>
    </AnimatePresence>
  );
}

type Flight = { id: number; from: { x: number; y: number }; to: { x: number; y: number }; text: string; color: string };

function PointsFlight({ flight, onDone }: { flight: Flight; onDone: () => void }) {
  // Yay, ekranın üst kenarına taşmadan skor kutusuna iner.
  const peak = { x: (flight.from.x + flight.to.x) / 2, y: Math.max(90, Math.min(flight.from.y, flight.to.y) - 60) };
  return (
    <motion.div
      className="pointer-events-none fixed top-0 left-0 z-40"
      initial={{ x: flight.from.x, y: flight.from.y }}
      animate={{ x: [flight.from.x, peak.x, flight.to.x], y: [flight.from.y, peak.y, flight.to.y] }}
      transition={{ duration: 0.72, ease: ease, times: [0, 0.4, 1] }}
      onAnimationComplete={onDone}
    >
      <motion.span
        className="tabular block -translate-x-1/2 -translate-y-1/2 rounded-full px-5 py-1.5 text-4xl font-bold text-ink-950"
        style={{ background: flight.color, boxShadow: "0 0.35rem 0 rgb(7 18 40 / 0.45)" }}
        initial={{ scale: 0.4 }}
        animate={{ scale: [0.4, 1.35, 0.7] }}
        transition={{ duration: 0.72, times: [0, 0.4, 1] }}
      >
        {flight.text}
      </motion.span>
    </motion.div>
  );
}

type TileState = "idle" | "blocked" | "correct" | "wrong" | "dim";

function AnswerTile({
  index,
  text,
  state,
  disabled,
  onPick,
  long,
}: {
  index: number;
  text: string;
  state: TileState;
  disabled: boolean;
  onPick: () => void;
  long: boolean;
}) {
  const palette: Record<TileState, { bg: string; edge: string; fg: string; badge: string; badgeFg: string }> = {
    idle: { bg: "var(--color-ink-800)", edge: "var(--color-ink-950)", fg: "var(--color-cream)", badge: "var(--color-ink-700)", badgeFg: "var(--color-firuze)" },
    blocked: { bg: "var(--color-ink-850)", edge: "var(--color-ink-900)", fg: "var(--color-ink-600)", badge: "var(--color-ink-800)", badgeFg: "var(--color-ink-600)" },
    correct: { bg: "var(--color-zumrut)", edge: "var(--color-zumrut-deep)", fg: "var(--color-ink-950)", badge: "rgb(7 18 40 / 0.18)", badgeFg: "var(--color-ink-950)" },
    wrong: { bg: "var(--color-mercan)", edge: "var(--color-mercan-deep)", fg: "var(--color-ink-950)", badge: "rgb(7 18 40 / 0.18)", badgeFg: "var(--color-ink-950)" },
    dim: { bg: "var(--color-ink-850)", edge: "var(--color-ink-900)", fg: "var(--color-ink-400)", badge: "var(--color-ink-800)", badgeFg: "var(--color-ink-400)" },
  };
  const p = palette[state];
  return (
    <motion.button
      type="button"
      data-tile={index}
      disabled={disabled}
      onClick={onPick}
      className="pressable flex min-h-0 items-center gap-5 rounded-xl px-6 text-left disabled:cursor-default"
      style={{ background: p.bg, color: p.fg, "--edge": p.edge } as CSSProperties}
      initial={{ opacity: 0, y: 18 }}
      animate={
        state === "wrong"
          ? { opacity: 1, y: 0, x: [0, -10, 10, -6, 6, 0] }
          : state === "correct"
            ? { opacity: 1, y: 0, scale: [1, 1.035, 1] }
            : { opacity: state === "blocked" ? 0.45 : 1, y: 0 }
      }
      transition={{ duration: state === "wrong" || state === "correct" ? dur.slow : dur.base, delay: state === "idle" ? index * stagger : 0, ease }}
    >
      <span className="grid size-[3.25rem] shrink-0 place-items-center rounded-lg text-2xl font-bold" style={{ background: p.badge, color: p.badgeFg }}>
        {state === "correct" ? <Check className="size-8" strokeWidth={3} /> : state === "wrong" ? <X className="size-8" strokeWidth={3} /> : LETTERS[index]}
      </span>
      <span className={`leading-tight font-semibold ${long ? "text-xl sm:text-2xl" : "text-xl sm:text-3xl"} ${state === "blocked" ? "line-through" : ""}`}>{text}</span>
    </motion.button>
  );
}

function TurnBadge({ name, color, label }: { name: string; color: Parameters<typeof TeamEmblem>[0]["color"]; label: string }) {
  const style = TEAM_STYLES[color];
  return (
    <div className="flex items-center gap-3 rounded-lg py-2 pr-5 pl-3" style={{ background: style.soft }}>
      <TeamEmblem color={color} className="size-9" />
      <div className="leading-tight">
        <p className="text-sm font-semibold text-ink-300">{label}</p>
        <p className="text-2xl font-bold" style={{ color: style.base }}>
          {name}
        </p>
      </div>
    </div>
  );
}

const JOKERS: Record<JokerKind, { label: string; icon: typeof Divide }> = {
  half: { label: "Yarı yarıya", icon: Divide },
  time: { label: "+15 sn", icon: Clock },
  pass: { label: "Pas", icon: SkipForward },
};

function JokerButton({ kind, state, optionCount, onUse }: { kind: JokerKind; state: QuizState; optionCount: number; onUse: (k: JokerKind) => void }) {
  const available = Boolean(state.jokers[currentTeam(state).id]?.[kind]);
  const applicable = kind !== "half" || (optionCount === 4 && state.hidden.length === 0);
  const { label, icon: Icon } = JOKERS[kind];
  return (
    <Button size="lg" disabled={!available || !applicable} onClick={() => onUse(kind)} icon={<Icon className="size-6" />} aria-label={`Joker: ${label}`}>
      {label}
    </Button>
  );
}

function OutcomeBanner({ state }: { state: QuizState }) {
  const stealer = state.teams.find((t) => t.id === state.stealTeam);
  const team = currentTeam(state);
  const map = {
    correct: { text: `+${POINTS_CORRECT}`, sub: team.name, good: true },
    stolen: { text: `+${POINTS_STEAL}`, sub: `${stealer?.name ?? ""} çaldı`, good: true },
    wrong: { text: "Yanlış", sub: "Doğru cevap yeşilde", good: false },
    timeout: { text: "Süre doldu", sub: "Doğru cevap yeşilde", good: false },
    "steal-failed": { text: "Çalınamadı", sub: "Doğru cevap yeşilde", good: false },
  } as const;
  const o = map[state.outcome ?? "wrong"];
  return (
    <motion.div
      className="flex shrink-0 items-center gap-3 rounded-lg px-5 py-2.5"
      style={{ background: o.good ? "rgb(52 199 132 / 0.16)" : "rgb(255 107 79 / 0.14)" }}
      initial={{ scale: 0.9 }}
      animate={{ scale: 1 }}
      transition={spring.celebrate}
    >
      <span className="grid size-10 place-items-center rounded-full" style={{ background: o.good ? "var(--color-zumrut)" : "var(--color-mercan)", color: "var(--color-ink-950)" }}>
        {o.good ? <Check className="size-6" strokeWidth={3} /> : <X className="size-6" strokeWidth={3} />}
      </span>
      <div className="leading-tight">
        <p className="text-2xl font-bold">{o.text}</p>
        <p className="text-sm text-ink-300">{o.sub}</p>
      </div>
    </motion.div>
  );
}
