"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, Flag, Pause, Play, X } from "lucide-react";
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
import { memoryScope, useRememberAsked } from "@/lib/memory";
import { dur, ease, spring } from "@/lib/motion";
import { sfx } from "@/lib/sound";
import { okculuk } from "../registry";
import { optionOrder } from "../shared/duel";
import { BOT_SIDE, useBotAction, useSolo } from "../shared/solo";
import { botShot } from "./bot";
import { archeryAudio } from "./audio";
import { TEAM_STYLES } from "../teams";
import type { GameProps, Team } from "../types";
import { AimScope } from "./AimScope";
import { AIM_LOCK_MS, archeryReducer, createArchery, OVERTIME_WIN, type ArcheryAction, type ArcherySettings, type ArcheryState, type Shot } from "./logic";
import type { ArcherySceneInput, SceneTeam } from "./scene/types";
import { ArcheryStage, preloadArcheryStage } from "./scene3d/ArcheryStage";
import { difficultyOf } from "../shared/difficulty";
import { useStage3d } from "../shared/stage3d/support";
import { RESULT_TEXT } from "./timeline";

/** Atış bittikten sonra sıradaki soruya kendiliğinden geçiş; açıklama okunur. */
const AFTER_SHOT_MS = 5_000;
/** İki takım da bilemediğinde açıklama daha uzun kalır. */
const AFTER_MISS_MS = 7_000;

/** Yeniden yüklenen oyunda soru süresi kendiliğinden akmaz; öğretmen "Devam" der. */
function hydrate(s: ArcheryState): ArcheryState {
  if (s.phase === "question" && s.deadline !== null) return { ...s, deadline: null, remaining: Math.max(1000, s.deadline - Date.now()) };
  return s;
}

export default function Okculuk({ config, deck, onRestart, solo }: GameProps) {
  const settings = config.settings as unknown as ArcherySettings;
  const teams = config.teams.slice(0, 2) as [Team, Team];
  const reducer = useMemo(() => archeryReducer(deck), [deck]);
  const [s, dispatch] = usePersistentReducer<ArcheryState, ArcheryAction>(config.sessionId, reducer, () => createArchery(teams, settings), hydrate);
  const reducedMotion = Boolean(useReducedMotion());
  // Nişangâh okçunun üstüne binmesin: 3D sahnede okçu sağda (dürbün solda), çizim sahnesinde okçu solda (dürbün sağda).
  const { enabled: scene3d } = useStage3d();

  // Skor, ok hedefe saplandığı anda; sonuç kartı ve otomatik geçiş atışın gösterisi bitince gelir.
  const [contacted, setContacted] = useState(s.shots.length);
  const [shotDone, setShotDone] = useState(s.shots.length);
  const [finaleDone, setFinaleDone] = useState(false);
  const [showResults, setShowResults] = useState(() => s.phase === "finished");
  const [reporting, setReporting] = useState(false);

  const q = deck[s.current];
  // Soru ekrana gelir gelmez hafızaya yazılır: oyun yarıda kalsa da bir sonraki destede sona bırakılır.
  useRememberAsked(memoryScope(config.subjectId, config.grade, config.section), [s.phase !== "ready" ? q?.id : undefined]);
  const aiming = s.phase === "aim" && s.aimStart !== null;
  const ticking = (s.phase === "question" && s.deadline !== null) || aiming;
  const now = useNow(ticking, aiming ? 100 : 200);
  const paused = s.phase === "question" && s.deadline === null && s.remaining !== null;
  // Tek oyunculu modda sağdaki takımı bilgisayar oynar.
  const botTurn = Boolean(solo) && s.shooter === BOT_SIDE;
  useSolo(solo, {
    seed: config.seed,
    ready: s.phase === "ready",
    start: () => {
      archeryAudio.say("baslangic", 0.3);
      dispatch({ type: "start", now: clock() });
    },
    done: s.phase === "finished" && showResults,
    result: () => ({ winner: s.winner === null || s.winner === "draw" ? "draw" : s.winner === teams[0].id ? 0 : 1, score: s.score, log: s.log, deck }),
    asking: s.phase === "question" && !paused && s.duel.winner === null && !s.duel.locked[BOT_SIDE],
    questionKey: String(s.asked),
    question: q,
    answer: (option) => dispatch({ type: "answer", side: BOT_SIDE, option, now: clock() }),
  });
  const remaining = s.deadline !== null ? Math.max(0, s.deadline - now) : (s.remaining ?? settings.seconds * 1000);
  const canShoot = !botTurn && aiming && now - s.aimStart! >= AIM_LOCK_MS;
  // Yay parmakla gerilir: basılı tutunca gerilir ve nişangâh gezinir, bırakınca ok çıkar.
  const draw = useRef<{ id: number | null; drawAt: number } | null>(null);
  const [drawAt, setDrawAt] = useState<number | null>(null);
  const drawSource = useCallback(() => draw.current?.drawAt ?? null, []);
  const startDraw = (id: number | null) => {
    const at = clock();
    draw.current = { id, drawAt: at };
    setDrawAt(at);
  };
  const release = (now = clock()) => {
    const d = draw.current;
    draw.current = null;
    setDrawAt(null);
    if (!d || !canShoot) return;
    dispatch({ type: "shoot", drawAt: d.drawAt, now });
  };
  const botPlan = botTurn && s.phase === "aim" && s.aimStart !== null ? botShot(config.seed, String(s.asked), solo!.bot.skill, s.aimStart, s.wind, difficultyOf(settings)) : null;
  useBotAction(botPlan !== null, `yay:${s.asked}`, { at: botPlan?.drawAt ?? 0 }, () => {
    if (!botPlan) return;
    draw.current = { id: null, drawAt: botPlan.drawAt };
    setDrawAt(botPlan.drawAt);
  });
  useBotAction(botPlan !== null, `ok:${s.asked}`, { at: botPlan?.at ?? 0 }, () => {
    if (!botPlan) return;
    draw.current = null;
    setDrawAt(null);
    dispatch({ type: "shoot", drawAt: botPlan.drawAt, now: botPlan.at });
  });
  const lastShot: Shot | undefined = s.shots[s.shots.length - 1];

  const shownScore = [...s.score] as [number, number];
  for (let i = contacted; i < s.shots.length; i++) shownScore[s.shots[i].side] -= s.shots[i].scored;

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
    archeryAudio.preload();
    preloadArcheryStage();
    return () => archeryAudio.stop();
  }, []);

  // Alan uğultusu soru sırasında alçak, nişan alınırken daha da alçak; spiker atış hakkını, sert rüzgârı ve boş geçen soruyu duyurur.
  const lastPhase = useRef(s.phase);
  const lastOvertime = useRef(s.overtime);
  useEffect(() => {
    const playing = s.phase !== "ready" && !(s.phase === "finished" && showResults);
    archeryAudio.ambience(!playing ? null : s.phase === "aim" ? "tense" : "quiet");
    if (s.phase !== lastPhase.current) {
      if (s.phase === "aim" && Math.abs(s.wind) === 3) archeryAudio.say("ruzgar", 0.5);
      else if (s.phase === "aim" && s.shots.length % 2 === 0) archeryAudio.say("hazir", 0.55);
      else if (s.phase === "reveal") archeryAudio.say("pas", 0.4);
      else if (s.phase === "question" && s.overtime && !lastOvertime.current) archeryAudio.say("uzatma", 0.2);
      lastPhase.current = s.phase;
      lastOvertime.current = s.overtime;
    }
  }, [s.phase, s.overtime, s.wind, s.shots, showResults]);

  const next = useCallback(() => dispatch({ type: "next", now: clock() }), [dispatch]);
  const onContact = useCallback((index: number) => setContacted((n) => Math.max(n, index + 1)), []);
  const onShotDone = useCallback((index: number) => {
    setContacted((n) => Math.max(n, index + 1));
    setShotDone((n) => Math.max(n, index + 1));
  }, []);
  const onFinale = useCallback(() => setFinaleDone(true), []);

  // Klavye: boşluk/Enter oku bırakır ya da hemen sonraki soruya geçer, P duraklatır.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.metaKey || e.ctrlKey) return;
      const key = e.key.toLowerCase();
      if ((key === " " || key === "enter") && s.phase === "aim") {
        if (botTurn) return;
        e.preventDefault();
        // Boşluğu basılı tutmak yayı gerer, bırakmak oku atar.
        if (!e.repeat && canShoot && !draw.current) startDraw(null);
      } else if ((key === " " || key === "enter") && ((s.phase === "result" && shotDone >= s.shots.length) || s.phase === "reveal")) {
        e.preventDefault();
        next();
      } else if (key === "p" && s.phase === "question") dispatch({ type: paused ? "resume" : "pause", now: clock() });
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if ((key === " " || key === "enter") && draw.current && draw.current.id === null && !botTurn) release();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  });

  if (s.phase === "ready") {
    if (solo) return null;
    return (
      <GameIntro
        game={okculuk}
        teams={teams}
        questionInfo={`${settings.questions} soru${settings.seconds ? `, soru başına ${settings.seconds} saniye` : ""}. İki takıma aynı soru sorulur; ilk bilen takım hedefe ok atar.`}
        onStart={() => {
          sfx.go();
          archeryAudio.say("baslangic", 0.3);
          dispatch({ type: "start", now: clock() });
        }}
      />
    );
  }

  if (s.phase === "finished" && showResults) {
    if (solo) return null;
    return (
      <Results
        standings={([0, 1] as const)
          .map((i) => {
            const right = s.log.filter((l) => l.teamId === teams[i].id && l.correct).length;
            const own = s.shots.filter((k) => k.side === i);
            const tens = own.filter((k) => k.points === 10).length;
            return { team: teams[i], score: s.score[i], detail: `${right} doğru, ${own.length} ok${tens ? `, ${tens} kez tam on ikiden` : ""}` };
          })
          .sort((a, b) => (s.winner === b.team.id ? 1 : s.winner === a.team.id ? -1 : b.score - a.score))}
        scoreLabel="puan"
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
  const sceneInput: ArcherySceneInput = { phase: s.phase, shooter: s.shooter, aimStart: s.aimStart, drawAt: s.phase === "aim" ? drawAt : null, wind: s.wind, shots: s.shots, winner: winnerSide };
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
        } ${canShoot ? "cursor-crosshair touch-none" : ""}`}
        style={{ transition: `height var(--dur-scene) var(--ease-out)` }}
        onPointerDown={(e) => {
          // Sahnenin her yerinde basılı tutmak yayı gerer: tahtada büyük hedef.
          if (!canShoot || e.button !== 0 || draw.current) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          startDraw(e.pointerId);
        }}
        onPointerUp={(e) => {
          if (draw.current?.id !== e.pointerId) return;
          release();
        }}
        onPointerCancel={() => {
          draw.current = null;
          setDrawAt(null);
        }}
      >
        <ArcheryStage input={sceneInput} teams={sceneTeams} reducedMotion={reducedMotion} onContact={onContact} onShotDone={onShotDone} onFinale={onFinale} />
        <Scoreboard teams={teams} score={shownScore} shots={s.shots.slice(0, contacted)} label={s.overtime ? "UZATMA" : `Soru ${s.asked}/${settings.questions}`} compact={!expanded} />
        {(s.phase === "aim" || (s.phase === "result" && lastShot && contacted >= s.shots.length)) && (s.shooter !== null || lastShot) && (
          <div className={`pointer-events-none absolute bottom-3 aspect-[5/6] h-[58%] max-h-[30rem] min-h-[10rem] sm:bottom-5 ${scene3d ? "left-3 sm:left-5" : "right-3 sm:right-5"}`}>
            <AimScope
              active={s.phase === "aim"}
              draw={drawSource}
              wind={s.phase === "aim" ? s.wind : lastShot!.wind}
              hit={s.phase === "result" && lastShot ? lastShot.hit : null}
              color={TEAM_STYLES[teams[s.phase === "aim" ? s.shooter! : lastShot!.side].color].base}
              difficulty={difficultyOf(settings)}
            />
          </div>
        )}
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
                only={solo ? 0 : undefined}
                disabled={paused}
                onAnswer={(side, option) => dispatch({ type: "answer", side, option, now: clock() })}
                meta={
                  <div className="flex flex-wrap items-center gap-3 text-lg text-ink-300">
                    <span className="tabular font-semibold text-cream">{s.overtime ? `Uzatma: ${OVERTIME_WIN} ve üstünü vuran kazanır` : `Soru ${s.asked}/${settings.questions}`}</span>
                    {findUnit(q.unit) && <span className="truncate">{findUnit(q.unit)!.title}</span>}
                    {s.phase === "question" && <span className="hidden text-base lg:inline">İlk bilen takım ok atar; yanlış cevap veren bekler.</span>}
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
              <TurnBadge team={shooter} label="Yayı gerdi" />
              <div className="min-w-[12rem] flex-1">
                <p className="text-lg font-bold sm:text-2xl">{botTurn ? "Rakip yayını geriyor…" : drawAt !== null ? "Nişangâh ortaya gelince bırak!" : "Basılı tut: yay gerilsin!"}</p>
                <p className="text-base text-ink-300 sm:text-lg">
                  {s.wind === 0 ? "Hava sakin: nişangâh tam ortadayken bırak." : `Rüzgâr oku ${s.wind < 0 ? "sola" : "sağa"} iter; nişangâh ortanın biraz ${s.wind < 0 ? "sağındayken" : "solundayken"} bırak.`} Erken bırakılan ok düşer, uzun tutulan yay titrer.
                </p>
              </div>
              <button
                type="button"
                disabled={!canShoot}
                onPointerDown={(e) => {
                  if (e.button !== 0 || draw.current) return;
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  startDraw(e.pointerId);
                }}
                onPointerUp={(e) => {
                  if (draw.current?.id !== e.pointerId) return;
                  release();
                }}
                onPointerCancel={() => {
                  draw.current = null;
                  setDrawAt(null);
                }}
                className="pressable flex h-20 w-full shrink-0 touch-none select-none items-center justify-center gap-3 rounded-xl px-8 text-3xl font-bold text-ink-950 transition-opacity disabled:opacity-40 sm:h-24 sm:w-auto sm:text-4xl"
                style={{ display: botTurn ? "none" : undefined, background: TEAM_STYLES[shooter.color].base, "--edge": TEAM_STYLES[shooter.color].deep } as CSSProperties}
              >
                {drawAt !== null ? "BIRAK!" : "BASILI TUT"}
              </button>
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
                  <ResultBadge shot={lastShot} team={teams[lastShot.side]} overtimeShort={lastShot.scored < lastShot.points} />
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
                  {lastShot && contacted >= s.shots.length ? (
                    <ResultBadge shot={lastShot} team={teams[lastShot.side]} overtimeShort={lastShot.scored < lastShot.points} />
                  ) : (
                    <>
                      {lastShot && <TurnBadge team={teams[lastShot.side]} label="Oku bıraktı" />}
                      <p className="text-2xl font-bold text-ink-300">Ok hedefe gidiyor…</p>
                    </>
                  )}
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
              <p className="text-xl text-ink-300 sm:text-2xl">Sorular bitti, kimse ok atamadı.</p>
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

/** Yayın tarzı skor tabelası: takımlar, puanlar, ok geçmişi. */
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
    <span className="flex min-w-6 items-center gap-1" aria-label={`${team.name}: ${shots.map((k) => k.points).join(", ") || "ok yok"}`}>
      {last.map((k, i) =>
        k.points > 0 ? (
          <span key={i} className="tabular grid size-5 place-items-center rounded-full text-[0.65rem] font-bold text-ink-950" style={{ background: k.points >= 9 ? "var(--color-kehribar)" : TEAM_STYLES[team.color].base }}>
            {k.points}
          </span>
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

function ResultBadge({ shot, team, overtimeShort }: { shot: Shot; team: Team; overtimeShort: boolean }) {
  const scored = shot.points > 0 && !overtimeShort;
  const text = RESULT_TEXT[shot.result];
  return (
    <motion.div
      className="flex shrink-0 items-center gap-3 rounded-xl py-2 pr-6 pl-4"
      style={{ background: scored ? (shot.points >= 9 ? "var(--color-kehribar)" : TEAM_STYLES[team.color].base) : "var(--color-ink-700)", color: scored ? "var(--color-ink-950)" : "var(--color-cream)" }}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={spring.celebrate}
    >
      <span className="tabular text-5xl font-bold">{scored ? `+${shot.points}` : shot.points}</span>
      <span className="leading-tight">
        <span className="block text-3xl font-bold sm:text-4xl">{text.title}</span>
        <span className="block text-base font-semibold opacity-80">{overtimeShort ? `Uzatmada ${OVERTIME_WIN} gerekir, eşitlik sürüyor` : text.detail}</span>
      </span>
    </motion.div>
  );
}
