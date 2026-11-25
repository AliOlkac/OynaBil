"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, Flag, Flame, Pause, Play, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
import { basketbol } from "../registry";
import { difficultyOf } from "../shared/difficulty";
import { optionOrder } from "../shared/duel";
import { basketAudio } from "./audio";
import { TEAM_STYLES } from "../teams";
import type { GameProps, Team } from "../types";
import { AIM_LOCK_MS, basketReducer, createBasket, METER_LOCK_MS, onFire, RESULT_MADE, type BasketAction, type BasketSettings, type BasketState, type Range, type Shot } from "./logic";
import { PowerMeter } from "./PowerMeter";
import type { BasketSceneInput, SceneTeam } from "./scene/types";
import { BasketStage, preloadBasketStage } from "./scene3d/BasketStage";
import { RESULT_TEXT } from "./timeline";

/** Atış bittikten sonra sıradaki soruya kendiliğinden geçiş; açıklama okunur. */
const AFTER_SHOT_MS = 5_000;
/** İki takım da bilemediğinde açıklama daha uzun kalır. */
const AFTER_MISS_MS = 7_000;

/** Yeniden yüklenen oyunda soru süresi kendiliğinden akmaz; öğretmen "Devam" der. */
function hydrate(s: BasketState): BasketState {
  if (s.phase === "question" && s.deadline !== null) return { ...s, deadline: null, remaining: Math.max(1000, s.deadline - Date.now()) };
  return s;
}

export default function Basketbol({ config, deck, onRestart }: GameProps) {
  const settings = config.settings as unknown as BasketSettings;
  const teams = config.teams.slice(0, 2) as [Team, Team];
  const reducer = useMemo(() => basketReducer(deck), [deck]);
  const [s, dispatch] = usePersistentReducer<BasketState, BasketAction>(config.sessionId, reducer, () => createBasket(teams, settings), hydrate);
  const reducedMotion = Boolean(useReducedMotion());

  // Skor, top fileden geçtiği anda; sonuç kartı ve otomatik geçiş atışın gösterisi bitince gelir.
  const [contacted, setContacted] = useState(s.shots.length);
  const [shotDone, setShotDone] = useState(s.shots.length);
  const [finaleDone, setFinaleDone] = useState(false);
  const [showResults, setShowResults] = useState(() => s.phase === "finished");
  const [reporting, setReporting] = useState(false);

  const q = deck[s.current];
  const aiming = s.phase === "aim" && s.aimStart !== null;
  const ticking = (s.phase === "question" && s.deadline !== null) || aiming;
  const now = useNow(ticking, aiming ? 100 : 200);
  const paused = s.phase === "question" && s.deadline === null && s.remaining !== null;
  const remaining = s.deadline !== null ? Math.max(0, s.deadline - now) : (s.remaining ?? settings.seconds * 1000);
  const canPick = aiming && s.range === null && now - s.aimStart! >= AIM_LOCK_MS;
  const canShoot = aiming && s.meterStart !== null && now - s.meterStart >= METER_LOCK_MS;
  const lastShot: Shot | undefined = s.shots[s.shots.length - 1];
  const fire = s.shooter !== null && onFire(s.shots, s.shooter);

  const shownScore = [...s.score] as [number, number];
  for (let i = contacted; i < s.shots.length; i++) shownScore[s.shots[i].side] -= s.shots[i].points;

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

  useEffect(() => {
    basketAudio.preload();
    preloadBasketStage();
    return () => basketAudio.stop();
  }, []);

  // Salon uğultusu soru sırasında alçak, atış anında yüksek; spiker atış hakkını, ateşli eli ve boş geçen soruyu duyurur.
  const lastPhase = useRef(s.phase);
  const lastOvertime = useRef(s.overtime);
  useEffect(() => {
    const playing = s.phase !== "ready" && !(s.phase === "finished" && showResults);
    basketAudio.ambience(!playing ? null : s.phase === "aim" || s.phase === "result" ? "tense" : "quiet");
    if (s.phase !== lastPhase.current) {
      if (s.phase === "aim" && s.shooter !== null && onFire(s.shots, s.shooter)) basketAudio.say("ates", 0.5);
      else if (s.phase === "aim" && s.shots.length % 2 === 0) basketAudio.say("hazir", 0.55);
      else if (s.phase === "reveal") basketAudio.say("pas", 0.4);
      else if (s.phase === "question" && s.overtime && !lastOvertime.current) basketAudio.say("uzatma", 0.2);
      lastPhase.current = s.phase;
      lastOvertime.current = s.overtime;
    }
  }, [s.phase, s.overtime, s.shooter, s.shots, showResults]);

  const pick = useCallback((range: Range) => dispatch({ type: "range", range, now: clock() }), [dispatch]);
  const shoot = useCallback(() => dispatch({ type: "shoot", now: clock() }), [dispatch]);
  const next = useCallback(() => dispatch({ type: "next", now: clock() }), [dispatch]);
  const onContact = useCallback((index: number) => setContacted((n) => Math.max(n, index + 1)), []);
  const onShotDone = useCallback((index: number) => {
    setContacted((n) => Math.max(n, index + 1));
    setShotDone((n) => Math.max(n, index + 1));
  }, []);
  const onFinale = useCallback(() => setFinaleDone(true), []);

  // Klavye: 2 ya da 3 mesafeyi seçer, boşluk/Enter atar ya da hemen sonraki soruya geçer, P duraklatır.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.metaKey || e.ctrlKey) return;
      const key = e.key.toLowerCase();
      if (s.phase === "aim" && (key === "2" || key === "3")) {
        e.preventDefault();
        pick(Number(key) as Range);
      } else if ((key === " " || key === "enter") && s.phase === "aim") {
        e.preventDefault();
        shoot();
      } else if ((key === " " || key === "enter") && ((s.phase === "result" && shotDone >= s.shots.length) || s.phase === "reveal")) {
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
        game={basketbol}
        teams={teams}
        questionInfo={`${settings.questions} soru${settings.seconds ? `, soru başına ${settings.seconds} saniye` : ""}. İki takıma aynı soru sorulur; ilk bilen takım potaya atış yapar.`}
        onStart={() => {
          sfx.go();
          basketAudio.say("baslangic", 0.3);
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
            const own = s.shots.filter((k) => k.side === i);
            const made = own.filter((k) => RESULT_MADE[k.result]).length;
            return { team: teams[i], score: s.score[i], detail: `${right} doğru, ${own.length} atışta ${made} basket` };
          })
          .sort((a, b) => (s.winner === b.team.id ? 1 : s.winner === a.team.id ? -1 : b.score - a.score))}
        scoreLabel="sayı"
        winnerId={s.winner}
        log={s.log}
        deck={deck}
        onRestart={onRestart}
        setupHref={`/kurulum?oyun=${config.gameId}`}
        seenScope={memoryScope(config.subjectId, config.grade, config.section)}
      />
    );
  }

  const expanded = s.phase === "aim" || s.phase === "result" || s.phase === "finished";
  const winnerSide = s.winner === null ? null : s.winner === "draw" ? "draw" : s.winner === teams[0].id ? 0 : 1;
  const sceneInput: BasketSceneInput = { phase: s.phase, shooter: s.shooter, range: s.range, shots: s.shots, winner: winnerSide };
  const sceneTeams = teams.map((t) => ({ base: TEAM_STYLES[t.color].base, deep: TEAM_STYLES[t.color].deep })) as [SceneTeam, SceneTeam];
  const winnerTeam = typeof winnerSide === "number" ? teams[winnerSide] : null;
  const shooter = s.shooter !== null ? teams[s.shooter] : null;
  const showShotResult = lastShot && shotDone >= s.shots.length && (s.phase === "result" || s.phase === "finished");
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
        } ${canShoot ? "cursor-pointer" : ""}`}
        style={{ transition: `height var(--dur-scene) var(--ease-out)` }}
        onPointerDown={(e) => {
          // Sahneye dokunmak da atar: tahtada büyük hedef.
          if (!canShoot || e.button !== 0) return;
          e.preventDefault();
          shoot();
        }}
      >
        <BasketStage input={sceneInput} teams={sceneTeams} reducedMotion={reducedMotion} onContact={onContact} onShotDone={onShotDone} onFinale={onFinale} />
        <Scoreboard teams={teams} score={shownScore} shots={s.shots.slice(0, contacted)} label={s.overtime ? "UZATMA" : `Soru ${s.asked}/${settings.questions}`} compact={!expanded} />
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
                orders={[optionOrder(q.id, config.seed, 0, q.options.length), optionOrder(q.id, config.seed, 1, q.options.length)]}
                revealed={s.phase === "reveal"}
                disabled={paused}
                onAnswer={(side, option) => dispatch({ type: "answer", side, option, now: clock() })}
                meta={
                  <div className="flex flex-wrap items-center gap-3 text-lg text-ink-300">
                    <span className="tabular font-semibold text-cream">{s.overtime ? "Uzatma: ilk basketi atan kazanır" : `Soru ${s.asked}/${settings.questions}`}</span>
                    {findUnit(q.unit) && <span className="truncate">{findUnit(q.unit)!.title}</span>}
                    {s.phase === "question" && <span className="hidden text-base lg:inline">İlk bilen takım potaya atar; yanlış cevap veren bekler.</span>}
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

          {s.phase === "aim" && shooter && (
            <motion.section
              key={`aim-${s.asked}`}
              className="flex min-h-full flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap sm:gap-6 sm:px-8"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ duration: dur.base, ease }}
            >
              <TurnBadge team={shooter} label={fire ? "Ateşli el" : "Atışta"} fire={fire} />
              {s.range === null ? (
                <>
                  <p className="min-w-[12rem] flex-1 text-lg font-bold sm:text-2xl">Nereden atacaksın?</p>
                  {([2, 3] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      disabled={!canPick}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        e.preventDefault();
                        pick(r);
                      }}
                      className="pressable flex h-20 flex-1 shrink-0 flex-col items-center justify-center rounded-xl px-6 text-ink-950 transition-opacity disabled:opacity-40 sm:h-24 sm:flex-none"
                      style={{ background: r === 3 ? "var(--color-kehribar)" : TEAM_STYLES[shooter.color].base, "--edge": r === 3 ? "var(--color-kehribar-deep)" : TEAM_STYLES[shooter.color].deep } as CSSProperties}
                    >
                      <span className="text-3xl font-bold sm:text-4xl">{r} sayı</span>
                      <span className="text-sm font-semibold opacity-80 sm:text-base">{r === 2 ? "Yakından, kolay" : "Üçlük çizgisinden, zor"}</span>
                    </button>
                  ))}
                </>
              ) : (
                <>
                  <div className="min-w-[14rem] flex-1">
                    <p className="mb-2 text-lg font-bold sm:text-xl">İğne yeşile gelince AT!</p>
                    <PowerMeter range={s.range} meterStart={s.meterStart!} fire={fire} reducedMotion={reducedMotion} difficulty={difficultyOf(settings)} />
                  </div>
                  <button
                    type="button"
                    disabled={!canShoot}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      e.preventDefault();
                      shoot();
                    }}
                    className="pressable flex h-20 w-full shrink-0 items-center justify-center gap-3 rounded-xl px-10 text-4xl font-bold text-ink-950 transition-opacity disabled:opacity-40 sm:h-24 sm:w-auto sm:text-5xl"
                    style={{ background: TEAM_STYLES[shooter.color].base, "--edge": TEAM_STYLES[shooter.color].deep } as CSSProperties}
                  >
                    AT!
                  </button>
                </>
              )}
            </motion.section>
          )}

          {(s.phase === "result" || (s.phase === "finished" && lastShot)) && (
            <motion.section
              key={`result-${s.shots.length}`}
              className="flex min-h-full flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap sm:gap-6 sm:px-8"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ duration: dur.base, ease }}
            >
              {showShotResult && lastShot ? (
                <>
                  <ResultBadge shot={lastShot} team={teams[lastShot.side]} />
                  {explanation}
                  {s.phase === "result" && (
                    <>
                      <ReportButton onClick={() => setReporting(true)} />
                      <AutoAdvance key={`shot-${s.shots.length}`} duration={AFTER_SHOT_MS} onDone={next} />
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
                  {lastShot && <TurnBadge team={teams[lastShot.side]} label="Attı" fire={lastShot.onFire} />}
                  <p className="text-2xl font-bold text-ink-300">Top potaya gidiyor…</p>
                </>
              )}
            </motion.section>
          )}

          {s.phase === "finished" && !lastShot && (
            <motion.section
              key="end"
              className="flex min-h-full flex-wrap items-center justify-center gap-4 px-4 py-3 sm:gap-6 sm:px-8"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: dur.base, ease }}
            >
              <p className="text-xl text-ink-300 sm:text-2xl">Sorular bitti, kimse atış yapamadı.</p>
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

/** Yayın tarzı skor tabelası: takımlar, sayılar, atış geçmişi. */
function Scoreboard({ teams, score, shots, label, compact }: { teams: [Team, Team]; score: [number, number]; shots: Shot[]; label: string; compact: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-3">
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex items-stretch overflow-hidden rounded-xl bg-ink-950/90 shadow-[var(--surface-light)]">
          {([0, 1] as const).map((side) => {
            const style = TEAM_STYLES[teams[side].color];
            return (
              <div key={side} className={`flex items-center gap-3 ${side === 1 ? "flex-row-reverse" : ""}`}>
                <span className={`flex items-center gap-2 ${compact ? "px-3 py-1.5" : "px-4 py-2"} ${side === 1 ? "flex-row-reverse" : ""}`}>
                  <TeamEmblem color={teams[side].color} className={compact ? "size-6" : "size-8"} />
                  <span className={`hidden truncate font-bold sm:inline ${compact ? "max-w-[12rem] text-lg" : "max-w-[18rem] text-2xl"}`} style={{ color: style.base }}>
                    {teams[side].name}
                  </span>
                  {onFire(shots, side) && <Flame className="size-5 fill-current text-ates" aria-label="Ateşli el" />}
                </span>
                <motion.span
                  key={score[side]}
                  className={`tabular grid place-items-center px-4 font-bold text-ink-950 ${compact ? "min-w-12 text-3xl" : "min-w-16 text-5xl"}`}
                  style={{ background: style.base }}
                  initial={{ scale: 1.6 }}
                  animate={{ scale: 1 }}
                  transition={spring.celebrate}
                >
                  {score[side]}
                </motion.span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 rounded-lg bg-ink-950/80 px-3 py-1">
          <ShotDots shots={shots.filter((k) => k.side === 0)} team={teams[0]} />
          <span className="text-xs font-bold tracking-widest text-ink-300">{label}</span>
          <ShotDots shots={shots.filter((k) => k.side === 1)} team={teams[1]} />
        </div>
      </div>
    </div>
  );
}

function ShotDots({ shots, team }: { shots: Shot[]; team: Team }) {
  const last = shots.slice(-6);
  return (
    <span className="flex min-w-6 items-center gap-1" aria-label={`${team.name}: ${shots.filter((k) => k.points > 0).length} basket`}>
      {last.map((k, i) =>
        k.points > 0 ? (
          <span key={i} className="tabular grid size-4 place-items-center rounded-full text-[0.6rem] font-bold text-ink-950" style={{ background: TEAM_STYLES[team.color].base }}>
            {k.points}
          </span>
        ) : (
          <X key={i} className="size-4 text-ink-400" strokeWidth={3.5} />
        ),
      )}
    </span>
  );
}

function TurnBadge({ team, label, fire }: { team: Team; label: string; fire?: boolean }) {
  const style = TEAM_STYLES[team.color];
  return (
    <div className="flex shrink-0 items-center gap-3 rounded-lg py-2 pr-5 pl-3" style={{ background: style.soft }}>
      <TeamEmblem color={team.color} className="size-9" />
      <div className="leading-tight">
        <p className="flex items-center gap-1 text-sm font-semibold text-ink-300">
          {fire && <Flame className="size-4 fill-current text-ates" />}
          {label}
        </p>
        <p className="text-2xl font-bold" style={{ color: style.base }}>
          {team.name}
        </p>
      </div>
    </div>
  );
}

function ResultBadge({ shot, team }: { shot: Shot; team: Team }) {
  const made = shot.points > 0;
  const text = RESULT_TEXT[shot.result];
  return (
    <motion.div
      className="flex shrink-0 items-center gap-3 rounded-xl py-2 pr-6 pl-4"
      style={{ background: made ? TEAM_STYLES[team.color].base : "var(--color-ink-700)", color: made ? "var(--color-ink-950)" : "var(--color-cream)" }}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={spring.celebrate}
    >
      {made && <span className="tabular text-5xl font-bold">+{shot.points}</span>}
      <span className="leading-tight">
        <span className="block text-3xl font-bold sm:text-4xl">{made && shot.range === 3 ? "Üçlük!" : text.title}</span>
        <span className="block text-base font-semibold opacity-80">{text.detail}</span>
      </span>
    </motion.div>
  );
}
