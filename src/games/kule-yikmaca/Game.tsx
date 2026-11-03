"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, Crosshair, Flag, Flame, Pause, Play, X } from "lucide-react";
import { AutoAdvance } from "@/components/game/AutoAdvance";
import { DuelQuestion } from "@/components/game/DuelQuestion";
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
import { optionOrder } from "../shared/duel";
import { TEAM_STYLES } from "../teams";
import type { GameProps, Team } from "../types";
import {
  AIM_LOCK_MS,
  ammoFor,
  BANDS,
  createSiege,
  damageFor,
  dealt,
  roundOf,
  shotsPerTeam,
  siegeReducer,
  totalQuestions,
  TOWER_HP,
  windFor,
  ZONE_LABEL,
  type SiegeAction,
  type SiegeSettings,
  type SiegeState,
} from "./logic";
import type { ArtTeam } from "./scene/art";
import { yOf } from "./scene/geometry";
import { SiegeScene, type RulerSpec, type SceneInput } from "./scene/SiegeScene";

/** İsabetten sonra sıradaki soruya kendiliğinden geçiş; açıklama okunur. */
const AFTER_SHOT_MS = 5_000;
/** İki takım da bilemediğinde açıklama daha uzun kalır. */
const AFTER_MISS_MS = 7_000;

/**
 * Yeniden yüklenen oyunda soru süresi kendiliğinden akmaz; öğretmen "Devam" der.
 * Sıralı turların olduğu eski sürümden kalmış bir kayıt yeni oyunla değiştirilir.
 */
function hydrate(s: SiegeState, fresh: () => SiegeState): SiegeState {
  if (!s.duel || !Array.isArray(s.misfireAt)) return fresh();
  if (s.phase === "question" && s.deadline !== null) return { ...s, deadline: null, remaining: Math.max(1000, s.deadline - Date.now()) };
  return s;
}

export default function KuleYikmaca({ config, deck, onRestart }: GameProps) {
  const settings = config.settings as unknown as SiegeSettings;
  const teams = config.teams.slice(0, 2) as [Team, Team];
  const reducer = useMemo(() => siegeReducer(deck), [deck]);
  const fresh = () => createSiege(teams, settings, config.seed);
  const [s, dispatch] = usePersistentReducer<SiegeState, SiegeAction>(config.sessionId, reducer, fresh, (saved) => hydrate(saved, fresh));
  const reducedMotion = Boolean(useReducedMotion());

  // Sahne isabet anını bildirene kadar hasar çubuklara yansımaz.
  const [impacted, setImpacted] = useState(s.shots.length);
  const [finaleDone, setFinaleDone] = useState(false);
  const [showResults, setShowResults] = useState(() => s.phase === "finished");
  const [reporting, setReporting] = useState(false);

  const q = deck[s.current];
  const aiming = s.phase === "aim" && s.aimStart !== null;
  const ticking = (s.phase === "question" && s.deadline !== null) || aiming;
  const now = useNow(ticking, aiming ? 100 : 200);
  const paused = s.phase === "question" && s.deadline === null && s.remaining !== null;
  const remaining = s.deadline !== null ? Math.max(0, s.deadline - now) : (s.remaining ?? settings.seconds * 1000);
  const armed = aiming && now - s.aimStart! >= AIM_LOCK_MS;
  const lastShot = s.shots[s.shots.length - 1];
  const impactShown = impacted >= s.shots.length;
  const wind = windFor(s.seed, roundOf(s));
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
    else if (s.outcome === "timeout") sfx.wrong();
  }, [s.outcome]);

  // Bir takım yanlış cevap verince (öteki hâlâ cevaplayabilir) kısa bir uyarı sesi.
  const lockedCount = s.duel.locked.filter(Boolean).length;
  const lastLocked = useRef(lockedCount);
  useEffect(() => {
    if (lockedCount > lastLocked.current) sfx.wrong();
    lastLocked.current = lockedCount;
  }, [lockedCount]);

  const fire = useCallback(() => {
    if (!aiming) return;
    dispatch({ type: "fire", now: clock() });
  }, [aiming, dispatch]);

  const next = useCallback(() => {
    sfx.tap();
    dispatch({ type: "next", now: clock() });
  }, [dispatch]);

  // Klavye: boşluk/Enter ateş ya da hemen sonraki soru, P duraklat.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.metaKey || e.ctrlKey) return;
      const key = e.key.toLowerCase();
      if (key === " " || key === "enter") {
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
        questionInfo={`${settings.questions} soru${settings.seconds ? `, soru başına ${settings.seconds} saniye` : ""}. İki takıma aynı soru sorulur; ilk bilen takım mancınıkla karşı kuleye atış yapar.`}
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
    locked: s.duel.locked,
    shooter: s.shooter,
    aimStart: s.aimStart,
    wind,
    ammo,
    shots: s.shots,
    hp: s.hp,
    misfireAt: s.misfireAt,
    winner: winnerSide,
    endReason: s.endReason,
  };
  const shooter = s.shooter ?? 0;
  const ruler: RulerSpec = {
    target: (1 - shooter) as 0 | 1,
    values: BANDS.map((b) => ({
      from: yOf(Math.max(0, b.from)),
      to: yOf(Math.min(1, b.to)),
      damage: damageFor(b.zone, ammo, shotsPerTeam(s)),
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
                    <span className="tabular font-semibold text-cream">
                      Soru {s.asked}/{totalQuestions(s)}
                    </span>
                    {findUnit(q.unit) && <span className="truncate">{findUnit(q.unit)!.title}</span>}
                    {ammo === "ates" && (
                      <span className="flex items-center gap-1.5 rounded-md bg-ates px-2.5 py-0.5 text-sm font-bold text-ink-950">
                        <Flame className="size-4 fill-current" /> Zor soru: bilen ateşli gülle atar
                      </span>
                    )}
                    {s.phase === "question" && <span className="hidden text-base lg:inline">İlk bilen takım atar; yanlış cevap veren bekler.</span>}
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
                  <Button variant="quiet" size="lg" className="!px-4" icon={<Flag className="size-5" />} onClick={() => setReporting(true)} aria-label="Bu soruda hata bildir">
                    <span className="hidden xl:inline">Hata bildir</span>
                  </Button>
                  <AutoAdvance key={`miss-${s.asked}`} duration={AFTER_MISS_MS} onDone={next} label={s.asked >= totalQuestions(s) ? "Sonuç" : "Sıradaki soru"} />
                </div>
              )}
            </motion.div>
          )}

          {s.phase === "aim" && (
            <motion.section
              key={`aim-${s.asked}`}
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
                      <AutoAdvance key={`shot-${s.shots.length}`} duration={AFTER_SHOT_MS} onDone={next} label={s.asked >= totalQuestions(s) ? "Sonuç" : "Sıradaki soru"} />
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
                    ? `Sorular bitti. ${winnerTeam.name} kulesi daha sağlam kaldı, şeref atışıyla karşı kuleyi yıktı!`
                    : `Sorular bitti. ${winnerTeam.name} şeref atışını yapıyor!`
                  : "Sorular bitti, iki kule de aynı sağlamlıkta."}
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
