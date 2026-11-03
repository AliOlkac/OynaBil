"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, Flag, Hand, Pause, Play, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AutoAdvance } from "@/components/game/AutoAdvance";
import { DuelQuestion } from "@/components/game/DuelQuestion";
import { GameIntro } from "@/components/game/GameIntro";
import { ReportDialog } from "@/components/game/ReportDialog";
import { Results } from "@/components/game/Results";
import { TimerRing } from "@/components/game/TimerRing";
import { Button } from "@/components/ui/Button";
import { TeamEmblem } from "@/components/ui/TeamEmblem";
import { findUnit } from "@/core/repository";
import { clock, usePersistentReducer, useNow } from "@/lib/hooks";
import { memoryScope } from "@/lib/memory";
import { dur, ease, spring } from "@/lib/motion";
import { sfx } from "@/lib/sound";
import { penalti } from "../registry";
import { optionOrder } from "../shared/duel";
import { TEAM_STYLES } from "../teams";
import type { GameProps, Team } from "../types";
import { createPenalty, KICK_LOCK_MS, penaltyReducer, type Kick, type KickResult, type PenaltyAction, type PenaltySettings, type PenaltyState } from "./logic";
import type { ArtTeam } from "./scene/art";
import { PenaltyScene, type SceneInput } from "./scene/PenaltyScene";

/** Şut bittikten sonra sıradaki soruya kendiliğinden geçiş; açıklama okunur. */
const AFTER_KICK_MS = 5_000;
/** İki takım da bilemediğinde açıklama daha uzun kalır. */
const AFTER_MISS_MS = 7_000;
/** Öğretmen klavyeyle de şut çektirebilir: sayı tuşları kaleyi 3x3 böler (sayısal tuş takımı gibi). */
const KEY_SPOTS: Record<string, [number, number]> = {
  "7": [-0.66, 0.78], "8": [0, 0.78], "9": [0.66, 0.78],
  "4": [-0.66, 0.45], "5": [0, 0.45], "6": [0.66, 0.45],
  "1": [-0.66, 0.15], "2": [0, 0.15], "3": [0.66, 0.15],
};

const RESULT_TEXT: Record<KickResult, { title: string; detail: string }> = {
  gol: { title: "GOL!", detail: "Kaleci öbür köşeye uçtu." },
  kurtardi: { title: "Kurtardı!", detail: "Kaleci doğru köşeye uçtu." },
  direk: { title: "Direk!", detail: "Top direkten döndü." },
  aut: { title: "Aut!", detail: "Top kaleyi bulmadı." },
};

/** Yeniden yüklenen oyunda soru süresi kendiliğinden akmaz; öğretmen "Devam" der. */
function hydrate(s: PenaltyState): PenaltyState {
  if (s.phase === "question" && s.deadline !== null) return { ...s, deadline: null, remaining: Math.max(1000, s.deadline - Date.now()) };
  return s;
}

export default function Penalti({ config, deck, onRestart }: GameProps) {
  const settings = config.settings as unknown as PenaltySettings;
  const teams = config.teams.slice(0, 2) as [Team, Team];
  const reducer = useMemo(() => penaltyReducer(deck), [deck]);
  const [s, dispatch] = usePersistentReducer<PenaltyState, PenaltyAction>(config.sessionId, reducer, () => createPenalty(teams, settings, config.seed), hydrate);
  const reducedMotion = Boolean(useReducedMotion());

  // Skor, top ağa girdiği anda; sonuç kartı ve otomatik geçiş şutun gösterisi bitince gelir.
  const [contacted, setContacted] = useState(s.kicks.length);
  const [kickDone, setKickDone] = useState(s.kicks.length);
  const [finaleDone, setFinaleDone] = useState(false);
  const [showResults, setShowResults] = useState(() => s.phase === "finished");
  const [reporting, setReporting] = useState(false);

  const q = deck[s.current];
  const kicking = s.phase === "kick" && s.kickStart !== null;
  const ticking = (s.phase === "question" && s.deadline !== null) || kicking;
  const now = useNow(ticking, kicking ? 100 : 200);
  const paused = s.phase === "question" && s.deadline === null && s.remaining !== null;
  const remaining = s.deadline !== null ? Math.max(0, s.deadline - now) : (s.remaining ?? settings.seconds * 1000);
  const armed = kicking && now - s.kickStart! >= KICK_LOCK_MS;
  const lastKick: Kick | undefined = s.kicks[s.kicks.length - 1];

  const shownGoals = [...s.goals] as [number, number];
  for (let i = contacted; i < s.kicks.length; i++) if (s.kicks[i].result === "gol") shownGoals[s.kicks[i].side] -= 1;

  useEffect(() => {
    if (s.phase === "question" && s.deadline !== null && now >= s.deadline) dispatch({ type: "timeout", now: clock() });
  }, [s.phase, s.deadline, now, dispatch]);

  // Cevap sesleri: doğru cevapta zil, bir takım yanlış cevap verince kısa uyarı.
  const lockedCount = s.duel.locked.filter(Boolean).length;
  const lastLocked = useRef(lockedCount);
  const lastOutcome = useRef(s.outcome);
  useEffect(() => {
    if (lockedCount > lastLocked.current) sfx.wrong();
    lastLocked.current = lockedCount;
  }, [lockedCount]);
  useEffect(() => {
    if (s.outcome === lastOutcome.current) return;
    lastOutcome.current = s.outcome;
    if (s.outcome === "correct") sfx.correct();
    else if (s.outcome === "timeout") sfx.wrong();
  }, [s.outcome]);

  const kick = useCallback((x: number, y: number) => dispatch({ type: "kick", x, y, now: clock() }), [dispatch]);
  const next = useCallback(() => dispatch({ type: "next", now: clock() }), [dispatch]);
  const onContact = useCallback((index: number) => setContacted((n) => Math.max(n, index + 1)), []);
  const onKickDone = useCallback((index: number) => {
    setContacted((n) => Math.max(n, index + 1));
    setKickDone((n) => Math.max(n, index + 1));
  }, []);
  const onFinale = useCallback(() => setFinaleDone(true), []);

  // Klavye: sayı tuşlarıyla şut, boşluk/Enter hemen sonraki soru, P duraklat.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.metaKey || e.ctrlKey) return;
      const key = e.key.toLowerCase();
      if (s.phase === "kick" && KEY_SPOTS[key]) {
        e.preventDefault();
        kick(...KEY_SPOTS[key]);
      } else if ((key === " " || key === "enter") && ((s.phase === "result" && kickDone >= s.kicks.length) || s.phase === "reveal")) {
        e.preventDefault();
        next();
      } else if (key === "p" && s.phase === "question") dispatch({ type: paused ? "resume" : "pause", now: clock() });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (s.phase === "ready") {
    return (
      <GameIntro
        game={penalti}
        teams={teams}
        questionInfo={`${settings.questions} soru${settings.seconds ? `, soru başına ${settings.seconds} saniye` : ""}. İki takıma aynı soru sorulur; ilk bilen takım penaltıyı çeker.`}
        onStart={() => {
          sfx.go();
          dispatch({ type: "start", now: clock() });
        }}
      />
    );
  }

  if (s.phase === "finished" && showResults) {
    return (
      <Results
        standings={([0, 1] as const)
          .map((i) => {
            const right = s.log.filter((l) => l.teamId === teams[i].id && l.correct).length;
            const shots = s.kicks.filter((k) => k.side === i).length;
            return { team: teams[i], score: s.goals[i], detail: `${right} doğru, ${shots} şut` };
          })
          .sort((a, b) => (s.winner === b.team.id ? 1 : s.winner === a.team.id ? -1 : b.score - a.score))}
        scoreLabel="gol"
        winnerId={s.winner}
        log={s.log}
        deck={deck}
        onRestart={onRestart}
        setupHref={`/kurulum?oyun=${config.gameId}`}
        seenScope={memoryScope(config.subjectId, config.grade, config.section)}
      />
    );
  }

  const expanded = s.phase === "kick" || s.phase === "result" || s.phase === "finished";
  const winnerSide = s.winner === null ? null : s.winner === "draw" ? "draw" : s.winner === teams[0].id ? 0 : 1;
  const sceneInput: SceneInput = { phase: s.phase, shooter: s.shooter, kickStart: s.kickStart, kicks: s.kicks, locked: s.duel.locked, winner: winnerSide };
  const sceneTeams = teams.map((t) => ({ base: TEAM_STYLES[t.color].base, deep: TEAM_STYLES[t.color].deep, emblem: TEAM_STYLES[t.color].emblem })) as [ArtTeam, ArtTeam];
  const winnerTeam = typeof winnerSide === "number" ? teams[winnerSide] : null;
  const shooter = s.shooter !== null ? teams[s.shooter] : null;
  const showKickResult = lastKick && kickDone >= s.kicks.length && (s.phase === "result" || s.phase === "finished");
  const explanation = q && (
    <p className="min-w-0 flex-1 basis-72 text-lg leading-snug text-cream-dim sm:text-xl">
      <span className="font-semibold text-zumrut">
        <Check className="mr-1 inline size-5" strokeWidth={3} />
        {q.options[q.correctIndex]}.
      </span>{" "}
      {q.explanation}
    </p>
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        className={`relative mx-3 min-h-[12rem] shrink-0 overflow-hidden rounded-xl bg-ink-950 shadow-[var(--surface-light)] sm:mx-6 ${
          expanded ? "h-[calc(100%-15rem)] sm:h-[calc(100%-9rem)]" : "h-[34%] sm:h-[42%]"
        } ${armed ? "cursor-grab" : ""}`}
        style={{ transition: `height var(--dur-scene) var(--ease-out)` }}
      >
        <PenaltyScene input={sceneInput} teams={sceneTeams} reducedMotion={reducedMotion} onKick={kick} onContact={onContact} onKickDone={onKickDone} onFinale={onFinale} />
        <Scoreboard teams={teams} goals={shownGoals} kicks={s.kicks.slice(0, contacted)} label={s.suddenDeath ? "SERİ PENALTI" : `Soru ${s.asked}/${settings.questions}`} compact={!expanded} />
        <AnimatePresence>
          {s.phase === "finished" && finaleDone && (
            <motion.div
              key="winner"
              className="pointer-events-none absolute inset-x-3 top-[24%] flex justify-center"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={spring.celebrate}
            >
              <p
                className="flex items-center gap-3 rounded-2xl bg-ink-950/80 px-5 py-3 text-center text-2xl font-bold sm:gap-4 sm:px-8 sm:text-5xl"
                style={{ color: winnerTeam ? TEAM_STYLES[winnerTeam.color].base : "var(--color-cream)" }}
              >
                {winnerTeam && <TeamEmblem color={winnerTeam.color} className="size-8 shrink-0 sm:size-14" />}
                {winnerTeam ? `${winnerTeam.name} kazandı!` : "Berabere!"}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <AnimatePresence mode="wait" initial={false}>
          {(s.phase === "question" || s.phase === "reveal") && q && (
            <motion.div
              key={`q-${s.asked}`}
              className="flex min-h-full flex-col sm:h-full"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ duration: dur.base, ease }}
            >
              <DuelQuestion
                question={q}
                teams={teams}
                duel={s.duel}
                orders={[optionOrder(q.id, s.seed, 0, q.options.length), optionOrder(q.id, s.seed, 1, q.options.length)]}
                revealed={s.phase === "reveal"}
                disabled={paused}
                onAnswer={(side, option) => dispatch({ type: "answer", side, option, now: clock() })}
                meta={
                  <div className="flex flex-wrap items-center gap-3 text-lg text-ink-300">
                    <span className="tabular font-semibold text-cream">{s.suddenDeath ? "Seri penaltı: ilk golü atan kazanır" : `Soru ${s.asked}/${settings.questions}`}</span>
                    {findUnit(q.unit) && <span className="truncate">{findUnit(q.unit)!.title}</span>}
                    {s.phase === "question" && <span className="hidden text-base lg:inline">İlk bilen takım penaltıyı çeker; yanlış cevap veren bekler.</span>}
                  </div>
                }
                timer={
                  settings.seconds > 0 &&
                  s.phase === "question" && (
                    <button
                      type="button"
                      onClick={() => dispatch({ type: paused ? "resume" : "pause", now: clock() })}
                      className="group relative shrink-0 rounded-full"
                      aria-label={paused ? "Süreyi devam ettir" : "Süreyi duraklat"}
                    >
                      <TimerRing remainingMs={remaining} totalMs={settings.seconds * 1000} paused={paused} className="size-20 text-base sm:size-24" />
                      <span className="absolute -bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-ink-800 px-2.5 py-0.5 text-xs font-semibold text-ink-300">
                        {paused ? <Play className="size-3 fill-current" /> : <Pause className="size-3 fill-current" />}
                        {paused ? "Devam" : "Duraklat"}
                      </span>
                    </button>
                  )
                }
              />
              {s.phase === "reveal" && (
                <div className="flex flex-wrap items-center gap-3 px-3 pb-3 sm:flex-nowrap sm:gap-5 sm:px-8">
                  <p className="flex shrink-0 items-center gap-2 text-xl font-bold text-mercan">
                    <X className="size-6" strokeWidth={3} /> {s.outcome === "timeout" ? "Süre doldu!" : "İki takım da bilemedi."}
                  </p>
                  <p className="min-w-0 flex-1 basis-72 text-lg leading-snug text-cream-dim">{q.explanation}</p>
                  <ReportButton onClick={() => setReporting(true)} />
                  <AutoAdvance key={`miss-${s.asked}`} duration={AFTER_MISS_MS} onDone={next} />
                </div>
              )}
            </motion.div>
          )}

          {s.phase === "kick" && shooter && (
            <motion.section
              key={`kick-${s.asked}`}
              className="flex min-h-full flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap sm:gap-6 sm:px-8"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ duration: dur.base, ease }}
            >
              <TurnBadge team={shooter} label="Penaltıda" />
              <div className="min-w-[14rem] flex-1">
                <p className="flex items-center gap-2 text-lg font-bold sm:text-2xl">
                  {armed && <Hand className="size-7 shrink-0 text-kehribar" />}
                  {armed ? "Kalede topu göndermek istediğin yere sürükle ve bırak!" : "Oyuncu topun başına geçiyor…"}
                </p>
                <p className="mt-0.5 hidden text-base text-ink-300 sm:block sm:text-lg">Kaleci sola, ortaya ya da sağa atlar. Köşeyi tutturursa kurtarır; direğe ya da dışarıya giden şut gol olmaz.</p>
              </div>
            </motion.section>
          )}

          {(s.phase === "result" || (s.phase === "finished" && lastKick)) && (
            <motion.section
              key={`result-${s.kicks.length}`}
              className="flex min-h-full flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap sm:gap-6 sm:px-8"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ duration: dur.base, ease }}
            >
              {showKickResult && lastKick ? (
                <>
                  <ResultBadge kick={lastKick} team={teams[lastKick.side]} />
                  {explanation}
                  {s.phase === "result" && (
                    <>
                      <ReportButton onClick={() => setReporting(true)} />
                      <AutoAdvance key={`kick-${s.kicks.length}`} duration={AFTER_KICK_MS} onDone={next} />
                    </>
                  )}
                  {s.phase === "finished" && finaleDone && (
                    <Button variant="primary" size="xl" icon={<ArrowRight className="size-7" />} iconAfter onClick={() => setShowResults(true)} autoFocus>
                      Sonuçlar
                    </Button>
                  )}
                </>
              ) : (
                <>
                  {lastKick && <TurnBadge team={teams[lastKick.side]} label="Şut çekti" />}
                  <p className="text-2xl font-bold text-ink-300">Top kaleye gidiyor…</p>
                </>
              )}
            </motion.section>
          )}

          {s.phase === "finished" && !lastKick && (
            <motion.section
              key="end"
              className="flex min-h-full flex-wrap items-center justify-center gap-4 px-4 py-3 sm:gap-6 sm:px-8"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: dur.base, ease }}
            >
              <p className="text-xl text-ink-300 sm:text-2xl">Sorular bitti, kimse gol atamadı.</p>
              {finaleDone && (
                <Button variant="primary" size="xl" icon={<ArrowRight className="size-7" />} iconAfter onClick={() => setShowResults(true)} autoFocus>
                  Sonuçlar
                </Button>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>{reporting && q && <ReportDialog questionId={q.id} prompt={q.prompt} onClose={() => setReporting(false)} />}</AnimatePresence>
    </div>
  );
}

function ReportButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="quiet" size="lg" className="!px-4" icon={<Flag className="size-5" />} onClick={onClick} aria-label="Bu soruda hata bildir">
      <span className="hidden xl:inline">Hata bildir</span>
    </Button>
  );
}

/** Yayın tarzı skor tabelası: takımlar, goller, şut geçmişi. */
function Scoreboard({ teams, goals, kicks, label, compact }: { teams: [Team, Team]; goals: [number, number]; kicks: Kick[]; label: string; compact: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-3">
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex items-stretch overflow-hidden rounded-xl bg-ink-950/90 shadow-[var(--surface-light)]">
          {([0, 1] as const).map((side) => {
            const style = TEAM_STYLES[teams[side].color];
            const name = (
              <span className={`hidden truncate font-bold sm:inline ${compact ? "max-w-[12rem] text-lg" : "max-w-[18rem] text-2xl"}`} style={{ color: style.base }}>
                {teams[side].name}
              </span>
            );
            const score = (
              <motion.span
                key={goals[side]}
                className={`tabular grid place-items-center px-4 font-bold text-ink-950 ${compact ? "min-w-12 text-3xl" : "min-w-16 text-5xl"}`}
                style={{ background: style.base }}
                initial={{ scale: 1.6 }}
                animate={{ scale: 1 }}
                transition={spring.celebrate}
              >
                {goals[side]}
              </motion.span>
            );
            return (
              <div key={side} className={`flex items-center gap-3 ${side === 1 ? "flex-row-reverse" : ""}`}>
                <span className={`flex items-center gap-2 ${compact ? "px-3 py-1.5" : "px-4 py-2"} ${side === 1 ? "flex-row-reverse" : ""}`}>
                  <TeamEmblem color={teams[side].color} className={compact ? "size-6" : "size-8"} />
                  {name}
                </span>
                {score}
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 rounded-lg bg-ink-950/80 px-3 py-1">
          <KickDots kicks={kicks.filter((k) => k.side === 0)} team={teams[0]} />
          <span className="text-xs font-bold tracking-widest text-ink-300">{label}</span>
          <KickDots kicks={kicks.filter((k) => k.side === 1)} team={teams[1]} />
        </div>
      </div>
    </div>
  );
}

function KickDots({ kicks, team }: { kicks: Kick[]; team: Team }) {
  const last = kicks.slice(-6);
  return (
    <span className="flex min-w-6 items-center gap-1" aria-label={`${team.name}: ${kicks.filter((k) => k.result === "gol").length} gol`}>
      {last.map((k, i) =>
        k.result === "gol" ? (
          <span key={i} className="size-3.5 rounded-full" style={{ background: TEAM_STYLES[team.color].base }} />
        ) : (
          <X key={i} className="size-4 text-ink-400" strokeWidth={3.5} />
        ),
      )}
    </span>
  );
}

function TurnBadge({ team, label }: { team: Team; label: string }) {
  const style = TEAM_STYLES[team.color];
  return (
    <div className="flex shrink-0 items-center gap-3 rounded-lg py-2 pr-5 pl-3" style={{ background: style.soft }}>
      <TeamEmblem color={team.color} className="size-9" />
      <div className="leading-tight">
        <p className="text-sm font-semibold text-ink-300">{label}</p>
        <p className="text-2xl font-bold" style={{ color: style.base }}>
          {team.name}
        </p>
      </div>
    </div>
  );
}

function ResultBadge({ kick, team }: { kick: Kick; team: Team }) {
  const goal = kick.result === "gol";
  const save = kick.result === "kurtardi";
  const text = RESULT_TEXT[kick.result];
  return (
    <motion.div
      className="flex shrink-0 items-center gap-3 rounded-xl py-2 pr-6 pl-4"
      style={{
        background: goal ? TEAM_STYLES[team.color].base : save ? "var(--color-kehribar)" : "var(--color-ink-700)",
        color: goal || save ? "var(--color-ink-950)" : "var(--color-cream)",
      }}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={spring.celebrate}
    >
      <span className="leading-tight">
        <span className="block text-3xl font-bold sm:text-4xl">{text.title}</span>
        <span className="block text-base font-semibold opacity-80">{text.detail}</span>
      </span>
    </motion.div>
  );
}
