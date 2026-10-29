"use client";

import confetti from "canvas-confetti";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { Check, Crown, Home, RotateCcw, Settings2, X } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { TeamEmblem } from "@/components/ui/TeamEmblem";
import type { PlayableQuestion } from "@/core/deck";
import { findUnit } from "@/core/repository";
import { TEAM_STYLES } from "@/games/teams";
import type { AnswerLog, Team } from "@/games/types";
import { cssColor } from "@/lib/color";
import { sfx } from "@/lib/sound";
import { dur, ease, spring } from "@/lib/motion";

export type Standing = { team: Team; score: number; detail: string };

/**
 * Oyun sonu: sıralama ve öğretmen için tekrar listesi.
 * Yarışma ölçer; bu ekran sınıfın hangi konuda zorlandığını gösterir ki ders oradan devam etsin.
 */
export function Results({
  standings,
  winnerId,
  log,
  deck,
  onRestart,
  setupHref,
  scoreLabel = "puan",
}: {
  standings: Standing[];
  scoreLabel?: string;
  winnerId: string | "draw" | null;
  log: AnswerLog[];
  deck: PlayableQuestion[];
  onRestart: () => void;
  setupHref: string;
}) {
  const reduceMotion = useReducedMotion();
  const winner = standings.find((s) => s.team.id === winnerId)?.team;

  useEffect(() => {
    sfx.win();
    if (reduceMotion || !winner) return;
    const colors = [TEAM_STYLES[winner.color].base, "var(--color-cream)", "var(--color-firuze)"].map(cssColor);
    const fire = (x: number) => confetti({ particleCount: 90, spread: 70, startVelocity: 48, origin: { x, y: 0.7 }, colors, disableForReducedMotion: true });
    fire(0.2);
    const id = window.setTimeout(() => fire(0.8), 220);
    return () => window.clearTimeout(id);
  }, [reduceMotion, winner]);

  const review = useMemo(() => {
    const byId = new Map(deck.map((q) => [q.id, q]));
    const units = new Map<string, { right: number; total: number }>();
    for (const entry of log) {
      const u = units.get(entry.unit) ?? { right: 0, total: 0 };
      u.total++;
      if (entry.correct) u.right++;
      units.set(entry.unit, u);
    }
    // Hiçbir takımın doğru bilemediği sorular: konuyu yeniden ele almak için en iyi başlangıç.
    const solved = new Set(log.filter((l) => l.correct).map((l) => l.questionId));
    const missedIds = [...new Set(log.filter((l) => !solved.has(l.questionId)).map((l) => l.questionId))];
    return {
      units: [...units.entries()]
        .map(([id, v]) => ({ id, title: findUnit(id)?.title ?? id, ...v }))
        .sort((a, b) => a.right / a.total - b.right / b.total),
      missed: missedIds.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])),
    };
  }, [deck, log]);

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 overflow-y-auto px-8 pt-2 pb-8 lg:grid-cols-[1.05fr_1fr] lg:overflow-hidden">
      <section className="flex min-h-0 flex-col">
        <motion.h1
          className="text-4xl leading-tight font-bold"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: dur.slow, ease }}
        >
          {winner ? (
            <>
              <span style={{ color: TEAM_STYLES[winner.color].base }}>{winner.name}</span> kazandı!
            </>
          ) : (
            "Berabere!"
          )}
        </motion.h1>

        <Podium standings={standings} winnerId={winnerId} scoreLabel={scoreLabel} />

        <div className="mt-auto flex flex-wrap gap-3 pt-8">
          <Button variant="primary" size="lg" icon={<RotateCcw className="size-6" />} onClick={onRestart}>
            Yeni sorularla tekrar oyna
          </Button>
          <ButtonLink href={setupHref} size="lg" icon={<Settings2 className="size-6" />}>
            Ayarları değiştir
          </ButtonLink>
          <ButtonLink href="/" variant="quiet" size="lg" icon={<Home className="size-6" />}>
            Ana sayfa
          </ButtonLink>
        </div>
      </section>

      <section className="flex min-h-0 flex-col rounded-xl bg-ink-850 p-6 shadow-[var(--surface-light)]">
        <h2 className="text-xl font-bold">Sınıfın durumu</h2>
        {review.units.length === 0 ? (
          <p className="mt-3 text-ink-300">Bu oyunda cevaplanan soru olmadı.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {review.units.map((u) => {
              const pct = Math.round((u.right / u.total) * 100);
              return (
                <li key={u.id}>
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="font-semibold">{u.title}</span>
                    <span className="tabular text-ink-300">
                      {u.right}/{u.total} doğru
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-ink-700" aria-hidden>
                    <div
                      className="h-full origin-left rounded-full"
                      style={{ width: `${pct}%`, background: pct >= 70 ? "var(--color-zumrut)" : pct >= 40 ? "var(--color-kehribar)" : "var(--color-mercan)" }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <h2 className="mt-7 text-xl font-bold">
          Kimsenin bilemediği sorular <span className="tabular text-ink-400">({review.missed.length})</span>
        </h2>
        {review.missed.length === 0 ? (
          <p className="mt-3 flex items-center gap-2 text-zumrut">
            <Check className="size-5" /> Sorulan her soruyu en az bir takım bildi.
          </p>
        ) : (
          <ul className="mt-3 flex min-h-0 flex-col gap-3 overflow-y-auto pr-2">
            {review.missed.map((q) => (
              <li key={q.id} className="rounded-lg bg-ink-800 p-4">
                <p className="font-semibold">{q.prompt}</p>
                <p className="mt-2 flex items-start gap-2 text-zumrut">
                  <Check className="mt-0.5 size-5 shrink-0" />
                  {q.options[q.correctIndex]}
                </p>
                <p className="mt-1 text-sm text-ink-300">{q.explanation}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Kürsü: sütunlar sırayla yükselir, puanlar sayarak artar, birincinin başında taç. */
function Podium({ standings, winnerId, scoreLabel }: { standings: Standing[]; winnerId: string | "draw" | null; scoreLabel: string }) {
  // Eşit puan aynı basamaktır; Halat Çekme'de ipi çeken takım eşit doğruda da birincidir.
  const ranks: number[] = [];
  standings.forEach((s, i) => {
    const tied = i > 0 && s.score === standings[i - 1].score && !(i === 1 && winnerId === standings[0].team.id);
    ranks.push(tied ? ranks[i - 1] : i + 1);
  });
  // Klasik kürsü dizilişi: ikinci, birinci, üçüncü, dördüncü.
  const order = standings.length === 1 ? [0] : [1, 0, 2, 3].filter((i) => i < standings.length);
  const heights = [100, 74, 54, 40];

  return (
    <div className="mt-6 flex min-h-0 flex-1 items-end justify-center gap-4 pb-2">
      {order.map((i) => {
        const s = standings[i];
        const rank = ranks[i];
        const style = TEAM_STYLES[s.team.color];
        const delay = 0.2 + (standings.length - rank) * 0.25;
        return (
          <div key={s.team.id} className="flex w-full max-w-[12rem] flex-col items-center justify-end">
            <motion.div
              className="flex flex-col items-center text-center"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring.enter, delay: delay + 0.35 }}
            >
              {rank === 1 && (
                <motion.span
                  initial={{ y: -40, opacity: 0, rotate: -20 }}
                  animate={{ y: 0, opacity: 1, rotate: 0 }}
                  transition={{ ...spring.celebrate, delay: delay + 0.6 }}
                >
                  <Crown className="size-12 fill-kehribar text-kehribar" />
                </motion.span>
              )}
              <TeamEmblem color={s.team.color} className="size-14" />
              <p className="mt-2 line-clamp-2 text-xl leading-tight font-bold">{s.team.name}</p>
              <p className="text-sm text-ink-300">{s.detail}</p>
            </motion.div>
            <motion.div
              className="mt-3 flex w-full shrink-0 origin-bottom flex-col items-center rounded-t-xl pt-3"
              // Sütun boyu ekrana göre: 1080p tahtada en uzunu 22rem, kısa tahtada ekran yüksekliğinin %40'ı.
              style={{ height: `calc(min(22rem, 40dvh) * ${(heights[rank - 1] ?? 30) / 100})`, background: style.base, boxShadow: `inset 0 -0.5rem 0 ${style.deep}` }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ ...spring.enter, delay }}
            >
              <CountUp value={s.score} delay={delay + 0.2} />
              <span className="text-sm font-semibold text-ink-950/70">{scoreLabel}</span>
              <span className="mt-auto pb-3 text-5xl font-bold text-ink-950/35">{rank}</span>
            </motion.div>
          </div>
        );
      })}
      <span className="sr-only">{podiumSummary(standings)}</span>
    </div>
  );
}

function podiumSummary(standings: Standing[]) {
  return standings.map((s, i) => `${i + 1}. ${s.team.name}: ${s.score}`).join(", ");
}

function CountUp({ value, delay }: { value: number; delay: number }) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => Math.round(v));
  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.9, delay, ease });
    return () => controls.stop();
  }, [mv, value, delay]);
  return <motion.span className="tabular text-4xl font-bold text-ink-950">{rounded}</motion.span>;
}

export function OutcomeIcon({ correct, className = "size-6" }: { correct: boolean; className?: string }) {
  return correct ? <Check className={className} strokeWidth={3} /> : <X className={className} strokeWidth={3} />;
}
