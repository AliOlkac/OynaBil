"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, Crosshair, Flag, Flame, Pause, Play, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
import { kuleYikmaca } from "../registry";
import { TEAM_STYLES } from "../teams";
import type { GameProps, Team } from "../types";
import {
  AIM_LOCK_MS,
  ammoFor,
  BANDS,
  createSiege,
  damageFor,
  dealt,
  siegeReducer,
  totalQuestions,
  TOWER_HP,
  turnSide,
  windFor,
  ZONE_LABEL,
  type SiegeAction,
  type SiegeSettings,
  type SiegeState,
} from "./logic";
import type { ArtTeam } from "./scene/art";
import { yOf } from "./scene/geometry";
import { SiegeScene, type RulerSpec, type SceneInput } from "./scene/SiegeScene";

const LETTERS = ["A", "B", "C", "D"];

/** Yeniden yüklenen oyunda soru süresi kendiliğinden akmaz; öğretmen "Devam" der. */
function hydrate(s: SiegeState): SiegeState {
  // Soru çalmanın olduğu eski sürümden kalmış bir oyun açıklama ekranından sürer.
  if ((s.phase as string) === "steal") return { ...s, phase: "reveal", outcome: "wrong" };
  if (s.phase === "question" && s.deadline !== null) return { ...s, deadline: null, remaining: Math.max(1000, s.deadline - Date.now()) };
  return s;
}

export default function KuleYikmaca({ config, deck, onRestart }: GameProps) {
  const settings = config.settings as unknown as SiegeSettings;
  const teams = config.teams.slice(0, 2) as [Team, Team];
  const reducer = useMemo(() => siegeReducer(deck), [deck]);
  const [s, dispatch] = usePersistentReducer<SiegeState, SiegeAction>(config.sessionId, reducer, () => createSiege(teams, settings, config.seed), hydrate);
  const reducedMotion = Boolean(useReducedMotion());

  // Sahne isabet anını bildirene kadar hasar çubuklara yansımaz.
  const [impacted, setImpacted] = useState(s.shots.length);
  const [finaleDone, setFinaleDone] = useState(false);
  const [showResults, setShowResults] = useState(() => s.phase === "finished");
  const [reporting, setReporting] = useState(false);

  const q = deck[s.current];
  const side = turnSide(s);
  const team = teams[side];
  const aiming = s.phase === "aim" && s.aimStart !== null;
  const ticking = (s.phase === "question" && s.deadline !== null) || aiming;
  const now = useNow(ticking, aiming ? 100 : 200);
  const paused = s.phase === "question" && s.deadline === null && s.remaining !== null;
  const remaining = s.deadline !== null ? Math.max(0, s.deadline - now) : (s.remaining ?? settings.seconds * 1000);
  const armed = aiming && now - s.aimStart! >= AIM_LOCK_MS;
  const lastShot = s.shots[s.shots.length - 1];
  const impactShown = impacted >= s.shots.length;
  const wind = windFor(s.seed, s.turn);
  const ammo = ammoFor(q);

  const shownHp = [...s.hp] as [number, number];
  for (let i = impacted; i < s.shots.length; i++) {
    const shot = s.shots[i];
    const target = 1 - shot.side;
    shownHp[target] = Math.min(TOWER_HP, shownHp[target] + shot.damage);
  }

  useEffect(() => {
    if (s.phase === "question" && s.deadline !== null && now >= s.deadline) dispatch({ type: "timeout", now: clock() });
  }, [s.phase, s.deadline, now, dispatch]);

  // Cevap sesleri
  const lastOutcome = useRef(s.outcome);
  useEffect(() => {
    if (s.outcome === lastOutcome.current) return;
    lastOutcome.current = s.outcome;
    if (s.outcome === "correct") sfx.correct();
    else if (s.outcome === "wrong" || s.outcome === "timeout") sfx.wrong();
  }, [s.outcome]);

  const fire = useCallback(() => {
    if (!aiming) return;
    dispatch({ type: "fire", now: clock() });
  }, [aiming, dispatch]);

  const next = useCallback(() => {
    sfx.tap();
    dispatch({ type: "next", now: clock() });
  }, [dispatch]);

  const pick = (option: number) => {
    if (s.phase === "question" && !paused) dispatch({ type: "answer", option, now: clock() });
  };

  // Klavye: A-D cevap, boşluk/Enter ateş ya da sonraki, P duraklat.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.metaKey || e.ctrlKey) return;
      const key = e.key.toLowerCase();
      const letter = ["a", "b", "c", "d"].indexOf(key);
      const digit = ["1", "2", "3", "4"].indexOf(key);
      const index = letter !== -1 ? letter : digit;
      if (index !== -1 && s.phase === "question") pick(index);
      else if (key === " " || key === "enter") {
        if (s.phase === "aim") {
          e.preventDefault();
          fire();
        } else if ((s.phase === "shot" && impactShown) || s.phase === "reveal") {
          e.preventDefault();
          next();
        }
      } else if (key === "p" && s.phase === "question") dispatch({ type: paused ? "resume" : "pause", now: clock() });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onImpact = useCallback((index: number) => setImpacted((n) => Math.max(n, index + 1)), []);
  const onFinale = useCallback(() => setFinaleDone(true), []);

  if (s.phase === "ready") {
    return (
      <GameIntro
        game={kuleYikmaca}
        teams={teams}
        questionInfo={`Her takıma ${settings.rounds} soru${settings.seconds ? `, soru başına ${settings.seconds} saniye` : ""}. Bilen takım mancınıkla karşı kuleye atış yapar.`}
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
            const answers = s.log.filter((l) => l.teamId === teams[i].id);
            const right = answers.filter((l) => l.correct).length;
            const hits = s.shots.filter((x) => x.side === i && x.damage > 0).length;
            return { team: teams[i], score: dealt(s, i), detail: `${right} doğru, ${hits} isabet` };
          })
          .sort((a, b) => (s.winner === b.team.id ? 1 : s.winner === a.team.id ? -1 : b.score - a.score))}
        scoreLabel="hasar"
        winnerId={s.winner}
        log={s.log}
        deck={deck}
        onRestart={onRestart}
        setupHref={`/kurulum?oyun=${config.gameId}`}
        seenScope={memoryScope(config.subjectId, config.grade, config.section)}
      />
    );
  }

  const expanded = s.phase === "aim" || s.phase === "shot" || s.phase === "finished";
  const winnerSide = s.winner === null ? null : s.winner === "draw" ? "draw" : s.winner === teams[0].id ? 0 : 1;
  const sceneInput: SceneInput = {
    phase: s.phase,
    turn: side,
    shooter: s.shooter,
    aimStart: s.aimStart,
    wind,
    ammo,
    shots: s.shots,
    hp: s.hp,
    misfireAt: s.misfireAt,
    misfireSide: side,
    winner: winnerSide,
    endReason: s.endReason,
  };
  const shooter = s.shooter ?? side;
  const ruler: RulerSpec = {
    target: (1 - shooter) as 0 | 1,
    values: BANDS.map((b) => ({
      from: yOf(Math.max(0, b.from)),
      to: yOf(Math.min(1, b.to)),
      damage: damageFor(b.zone, ammo, settings.rounds),
      crit: b.zone === "pencere",
    })),
  };
  const sceneTeams = teams.map((t) => ({ base: TEAM_STYLES[t.color].base, deep: TEAM_STYLES[t.color].deep, emblem: TEAM_STYLES[t.color].emblem })) as [ArtTeam, ArtTeam];
  const winnerTeam = typeof winnerSide === "number" ? teams[winnerSide] : null;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        className={`relative mx-3 min-h-[12rem] shrink-0 overflow-hidden rounded-xl bg-ink-950 shadow-[var(--surface-light)] sm:mx-6 ${
          expanded ? "h-[calc(100%-15rem)] sm:h-[calc(100%-9rem)]" : "h-[34%] sm:h-[44%]"
        } ${aiming ? "cursor-crosshair" : ""}`}
        style={{ transition: `height var(--dur-scene) var(--ease-out)` }}
        onPointerDown={(e) => {
          if (!aiming || e.button !== 0) return;
          e.preventDefault();
          fire();
        }}
      >
        <SiegeScene input={sceneInput} teams={sceneTeams} ruler={ruler} reducedMotion={reducedMotion} onImpact={onImpact} onFinale={onFinale} />
        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-3 sm:inset-x-4">
          <TowerBar team={teams[0]} hp={shownHp[0]} align="left" compact={!expanded} />
          <WindBadge wind={wind} compact={!expanded} />
          <TowerBar team={teams[1]} hp={shownHp[1]} align="right" compact={!expanded} />
        </div>
        <AnimatePresence>
          {s.phase === "finished" && finaleDone && (
            <motion.div
              key="winner"
              className="pointer-events-none absolute inset-x-3 top-[16%] flex justify-center"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={spring.celebrate}
            >
              <p
                className="flex items-center gap-3 rounded-2xl bg-ink-950/80 px-5 py-3 text-center text-2xl font-bold sm:gap-4 sm:px-8 sm:text-5xl"
                style={{ color: winnerTeam ? TEAM_STYLES[winnerTeam.color].base : "var(--color-cream)" }}
              >
                {winnerTeam && <TeamEmblem color={winnerTeam.color} className="size-8 shrink-0 sm:size-14" />}
                {winnerTeam ? `${winnerTeam.name} kazandı!` : "Berabere! İki kule de ayakta."}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <AnimatePresence mode="wait" initial={false}>
          {(s.phase === "question" || s.phase === "reveal") && q && (
            <motion.section
              key={`q-${s.turn}`}
              className="flex min-h-full flex-col px-4 pt-4 pb-4 sm:h-full sm:min-h-0 sm:px-8"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ duration: dur.base, ease }}
            >
              <div className="flex items-start gap-6">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3 text-lg text-ink-300">
                    <span className="tabular font-semibold text-cream">
                      Soru {Math.min(s.asked + (s.phase === "question" ? 1 : 0), totalQuestions(s))}/{totalQuestions(s)}
                    </span>
                    {findUnit(q.unit) && <span className="truncate">{findUnit(q.unit)!.title}</span>}
                    {ammo === "ates" && (
                      <span className="flex items-center gap-1.5 rounded-md bg-ates px-2.5 py-0.5 text-sm font-bold text-ink-950">
                        <Flame className="size-4 fill-current" /> Zor soru: bilen ateşli gülle atar
                      </span>
                    )}
                  </div>
                  <h2 className={`mt-2 leading-tight font-bold text-balance ${q.prompt.length > 90 ? "text-2xl sm:text-3xl" : "text-2xl sm:text-4xl"}`}>{q.prompt}</h2>
                </div>
                {settings.seconds > 0 && s.phase === "question" && (
                  <button
                    type="button"
                    onClick={() => dispatch({ type: paused ? "resume" : "pause", now: clock() })}
                    className="group relative shrink-0 rounded-full"
                    aria-label={paused ? "Süreyi devam ettir" : "Süreyi duraklat"}
                  >
                    <TimerRing remainingMs={remaining} totalMs={settings.seconds * 1000} paused={paused} className="size-24 text-base" />
                    <span className="absolute -bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-ink-800 px-2.5 py-0.5 text-xs font-semibold text-ink-300">
                      {paused ? <Play className="size-3 fill-current" /> : <Pause className="size-3 fill-current" />}
                      {paused ? "Devam" : "Duraklat"}
                    </span>
                  </button>
                )}
              </div>

              <div
                className={`mt-4 grid auto-rows-[minmax(3.5rem,auto)] grid-cols-1 gap-3 sm:min-h-0 sm:flex-1 sm:grid-cols-2 ${q.options.length > 2 ? "sm:grid-rows-2" : "sm:grid-rows-1"}`}
              >
                {q.options.map((option, i) => {
                  const revealing = s.phase === "reveal";
                  const tone = revealing ? (i === q.correctIndex ? "correct" : s.picked === i ? "wrong" : "dim") : "idle";
                  return <Tile key={`${q.id}-${i}`} index={i} text={option} tone={tone} disabled={revealing || paused} accent={TEAM_STYLES[team.color].base} onPick={() => pick(i)} />;
                })}
              </div>

              <div className="mt-3 flex min-h-[4.5rem] flex-wrap items-center gap-4">
                {s.phase === "question" && (
                  <>
                    <TurnBadge team={team} label="Sıra" />
                    <p className="text-lg text-ink-300 sm:text-xl">Bilirse mancınık kurulur, atış hakkı kazanır.</p>
                  </>
                )}
                {s.phase === "reveal" && (
                  <>
                    <p className="flex items-center gap-2 text-xl font-bold text-mercan">
                      <X className="size-6" strokeWidth={3} /> {s.outcome === "timeout" ? "Süre doldu!" : "Yanlış!"} Mancınık tutukluk yaptı.
                    </p>
                    <p className="min-w-0 flex-1 basis-72 text-lg leading-snug text-cream-dim">{q.explanation}</p>
                    <Button variant="quiet" size="lg" className="!px-4" icon={<Flag className="size-5" />} onClick={() => setReporting(true)} aria-label="Bu soruda hata bildir">
                      <span className="hidden xl:inline">Hata bildir</span>
                    </Button>
                    <Button variant="primary" size="xl" icon={<ArrowRight className="size-7" />} iconAfter onClick={next} autoFocus>
                      {s.asked >= totalQuestions(s) ? "Sonuç" : "Sonraki"}
                    </Button>
                  </>
                )}
              </div>
            </motion.section>
          )}

          {s.phase === "aim" && (
            <motion.section
              key={`aim-${s.turn}`}
              className="flex min-h-full flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap sm:gap-6 sm:px-8"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ duration: dur.base, ease }}
            >
              <TurnBadge team={teams[shooter]} label="Atışta" />
              <div className="min-w-[14rem] flex-1">
                <p className="text-lg font-bold sm:text-2xl">{armed ? "Nişangâh pencereye gelince ATEŞ!" : "Mancınık kuruluyor, taş yükleniyor…"}</p>
                <p className="mt-0.5 hidden text-base text-ink-300 sm:block sm:text-lg">
                  {windHint(wind, shooter)}
                  {ammo === "ates" && <span className="ml-2 font-semibold text-ates">Ateşli gülle: hasar 1,5 kat.</span>}
                </p>
              </div>
              <button
                type="button"
                disabled={!armed}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  e.preventDefault();
                  fire();
                }}
                className="pressable flex h-20 w-full shrink-0 items-center justify-center gap-4 rounded-xl px-10 text-4xl font-bold text-ink-950 transition-opacity disabled:opacity-40 sm:h-24 sm:w-auto sm:text-5xl"
                style={{ background: TEAM_STYLES[teams[shooter].color].base, "--edge": TEAM_STYLES[teams[shooter].color].deep } as CSSProperties}
              >
                <Crosshair className="size-11" strokeWidth={2.6} /> ATEŞ!
              </button>
            </motion.section>
          )}

          {(s.phase === "shot" || (s.phase === "finished" && lastShot && s.endReason === "collapse")) && lastShot && (
            <motion.section
              key={`shot-${s.shots.length}`}
              className="flex min-h-full flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap sm:gap-6 sm:px-8"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ duration: dur.base, ease }}
            >
              {!impactShown ? (
                <>
                  <TurnBadge team={teams[lastShot.side]} label="Atış yaptı" />
                  <p className="text-2xl font-bold text-ink-300">Taş havada…</p>
                </>
              ) : (
                <>
                  <ShotBadge damage={lastShot.damage} zone={lastShot.zone} ammo={lastShot.ammo} team={teams[lastShot.side]} />
                  {q && (
                    <p className="min-w-0 flex-1 basis-72 text-lg leading-snug text-cream-dim sm:text-xl">
                      <span className="font-semibold text-zumrut">
                        <Check className="mr-1 inline size-5" strokeWidth={3} />
                        {q.options[q.correctIndex]}.
                      </span>{" "}
                      {q.explanation}
                    </p>
                  )}
                  {s.phase === "shot" && (
                    <>
                      <Button variant="quiet" size="lg" className="!px-4" icon={<Flag className="size-5" />} onClick={() => setReporting(true)} aria-label="Bu soruda hata bildir">
                        <span className="hidden xl:inline">Hata bildir</span>
                      </Button>
                      <Button variant="primary" size="xl" icon={<ArrowRight className="size-7" />} iconAfter onClick={next} autoFocus>
                        {s.asked >= totalQuestions(s) ? "Sonuç" : "Sonraki"}
                      </Button>
                    </>
                  )}
                  {s.phase === "finished" && finaleDone && (
                    <Button variant="primary" size="xl" icon={<ArrowRight className="size-7" />} iconAfter onClick={() => setShowResults(true)} autoFocus>
                      Sonuçlar
                    </Button>
                  )}
                </>
              )}
            </motion.section>
          )}

          {s.phase === "finished" && s.endReason !== "collapse" && (
            <motion.section
              key="end"
              className="flex min-h-full flex-wrap items-center justify-center gap-4 px-4 py-3 sm:gap-6 sm:px-8"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: dur.base, ease }}
            >
              <p className="text-xl text-ink-300 sm:text-2xl">
                {winnerTeam
                  ? finaleDone
                    ? `Turlar bitti. ${winnerTeam.name} kulesi daha sağlam kaldı, şeref atışıyla karşı kuleyi yıktı!`
                    : `Turlar bitti. ${winnerTeam.name} şeref atışını yapıyor!`
                  : "Turlar bitti, iki kule de aynı sağlamlıkta."}
              </p>
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

function windHint(wind: number, shooter: 0 | 1) {
  if (wind === 0) return "Rüzgâr yok: taş nişan aldığınız yere gider.";
  const tail = wind * (shooter === 0 ? 1 : -1) > 0;
  const power = ["", "hafif", "orta", "sert"][Math.abs(wind)];
  return tail ? `Arkadan ${power} rüzgâr: taş nişandan daha yükseğe çarpar.` : `Önden ${power} rüzgâr: taş nişandan daha alçağa çarpar.`;
}

function TowerBar({ team, hp, align, compact }: { team: Team; hp: number; align: "left" | "right"; compact: boolean }) {
  const style = TEAM_STYLES[team.color];
  const right = align === "right";
  const pct = Math.max(0, Math.min(100, hp));
  return (
    <motion.div
      key={hp}
      className={`flex w-[min(34%,26rem)] flex-col rounded-xl bg-ink-950/85 px-3 ${compact ? "gap-1 py-1.5" : "gap-1.5 py-2"} ${right ? "items-end" : ""}`}
      initial={{ x: 0 }}
      animate={{ x: hp < TOWER_HP ? [0, -7, 7, -4, 0] : 0 }}
      transition={{ duration: dur.slow }}
    >
      <div className={`flex w-full items-center gap-2 ${right ? "flex-row-reverse" : ""}`}>
        <TeamEmblem color={team.color} className={`${compact ? "size-6" : "size-7"} shrink-0`} />
        <span className={`hidden min-w-0 truncate font-bold sm:inline ${compact ? "text-lg" : "text-xl"}`} style={{ color: style.base }}>
          {team.name}
        </span>
        <span className={`tabular font-bold ${compact ? "text-xl" : "text-2xl"} ${right ? "mr-auto" : "ml-auto"}`}>{pct}</span>
      </div>
      <div
        className={`relative w-full overflow-hidden rounded-full bg-ink-800 ${compact ? "h-2.5" : "h-4"}`}
        role="meter"
        aria-label={`${team.name} kulesinin sağlamlığı`}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <motion.div
          className={`absolute inset-y-0 rounded-full bg-cream ${right ? "right-0" : "left-0"}`}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: dur.scene, ease, delay: 0.45 }}
        />
        <motion.div
          className={`absolute inset-y-0 rounded-full ${right ? "right-0" : "left-0"}`}
          style={{ background: pct > 30 ? style.base : "var(--color-mercan)" }}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={spring.impact}
        />
      </div>
    </motion.div>
  );
}

function WindBadge({ wind, compact }: { wind: number; compact: boolean }) {
  const strength = Math.abs(wind);
  const toRight = wind >= 0;
  return (
    <div className={`flex shrink-0 flex-col items-center rounded-xl bg-ink-950/85 px-4 ${compact ? "py-1" : "py-1.5"}`} aria-label={wind === 0 ? "Rüzgâr yok" : `Rüzgâr ${toRight ? "sağa" : "sola"}, şiddet ${strength}`}>
      <span className="text-xs font-bold tracking-widest text-ink-300">RÜZGÂR</span>
      {wind === 0 ? (
        <span className={`font-bold text-cream ${compact ? "text-lg" : "text-xl"}`}>Sakin</span>
      ) : (
        <motion.span
          key={wind}
          className={`flex items-center gap-0.5 ${toRight ? "" : "flex-row-reverse"}`}
          initial={{ opacity: 0, x: toRight ? -10 : 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: dur.slow, ease }}
        >
          {[1, 2, 3].map((n) => (
            <svg key={n} viewBox="0 0 16 24" className={compact ? "h-6 w-4" : "h-7 w-5"} aria-hidden>
              <path
                d={toRight ? "M3 3 L13 12 L3 21" : "M13 3 L3 12 L13 21"}
                fill="none"
                stroke={n <= strength ? "var(--color-cream)" : "var(--color-ink-600)"}
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ))}
        </motion.span>
      )}
    </div>
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

const ZONE_TITLE: Record<keyof typeof ZONE_LABEL, string> = { kisa: "Iska", temel: "Temel", govde: "Gövde", pencere: "Pencere", burc: "Burç", kulah: "Külah", uzun: "Iska" };

function ShotBadge({ damage, zone, ammo, team }: { damage: number; zone: keyof typeof ZONE_LABEL; ammo: "tas" | "ates"; team: Team }) {
  const crit = zone === "pencere";
  const bg = crit ? "var(--color-kehribar)" : damage > 0 ? TEAM_STYLES[team.color].base : "var(--color-ink-700)";
  return (
    <motion.div
      className="flex shrink-0 items-center gap-4 rounded-xl py-2 pr-6 pl-4"
      style={{ background: bg, color: damage > 0 ? "var(--color-ink-950)" : "var(--color-cream)" }}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={spring.celebrate}
    >
      <span className="tabular text-5xl font-bold">{damage > 0 ? `−${damage}` : "0"}</span>
      <span className="leading-tight">
        <span className="block text-xl font-bold">{crit ? "KRİTİK!" : damage > 0 ? ZONE_TITLE[zone] : "Iska"}</span>
        <span className="block text-base font-semibold opacity-80">
          {ZONE_LABEL[zone]}
          {ammo === "ates" && damage > 0 ? ", ateşli gülle" : ""}
        </span>
      </span>
    </motion.div>
  );
}

function Tile({
  index,
  text,
  tone,
  disabled,
  accent,
  onPick,
}: {
  index: number;
  text: string;
  tone: "idle" | "correct" | "wrong" | "dim";
  disabled: boolean;
  accent: string;
  onPick: () => void;
}) {
  const colors = {
    idle: { bg: "var(--color-ink-800)", fg: "var(--color-cream)", edge: "var(--color-ink-950)" },
    correct: { bg: "var(--color-zumrut)", fg: "var(--color-ink-950)", edge: "var(--color-zumrut-deep)" },
    wrong: { bg: "var(--color-mercan)", fg: "var(--color-ink-950)", edge: "var(--color-mercan-deep)" },
    dim: { bg: "var(--color-ink-850)", fg: "var(--color-ink-400)", edge: "var(--color-ink-900)" },
  }[tone];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPick}
      className="pressable flex min-h-0 items-center gap-4 rounded-lg px-4 text-left disabled:cursor-default"
      style={{ background: colors.bg, color: colors.fg, "--edge": colors.edge } as CSSProperties}
    >
      <span
        className="grid size-11 shrink-0 place-items-center rounded-md text-xl font-bold"
        style={{ background: tone === "idle" ? "var(--color-ink-700)" : "rgb(7 18 40 / 0.18)", color: tone === "idle" ? accent : "inherit" }}
      >
        {tone === "correct" ? <Check className="size-7" strokeWidth={3} /> : tone === "wrong" ? <X className="size-7" strokeWidth={3} /> : LETTERS[index]}
      </span>
      <span className={`leading-tight font-semibold ${text.length > 40 ? "text-lg sm:text-xl" : "text-xl sm:text-2xl"}`}>{text}</span>
    </button>
  );
}
