"use client";

import { motion } from "motion/react";
import { BookOpen, Brush, Building2, Check, Eye, Hand, Heart, Infinity as InfinityIcon, Orbit, Sparkles, Utensils, Users, X } from "lucide-react";
import type { ReactNode } from "react";
import { Girih } from "@/components/ui/Girih";
import { ease, spring } from "@/lib/motion";
import { Illustration } from "./illustrations";
import type { ICONS, Visual } from "./model";

/**
 * Ders sahnelerinin görselleri. Hepsi 16:9 sahnenin içine çizilir ve `em` ile ölçeklenir: sahnenin
 * yazı boyutu kutunun genişliğinden gelir, böylece tahtada da telefonda da aynı oranda görünür.
 * `shown` anlatımın ilerleyişidir (0..1): listeler ve kartlar anlatıcı onlara geldikçe açılır.
 */

const ICON: Record<(typeof ICONS)[number], ReactNode> = {
  resim: <Brush />,
  bina: <Building2 />,
  evren: <Orbit />,
  yildiz: <Sparkles />,
  sonsuz: <InfinityIcon />,
  el: <Hand />,
  bir: <span className="font-bold">1</span>,
  goz: <Eye />,
  sofra: <Utensils />,
  kalp: <Heart />,
  eller: <Users />,
  kitap: <BookOpen />,
};

/** Öğenin açılma eşiği: anlatım boyunca eşit aralıklarla, sonuncusu anlatım bitmeden. */
const revealAt = (i: number, n: number) => (n <= 1 ? 0 : (i / n) * 0.85);

function Enter({ children, delay = 0, quiet, className = "" }: { children: ReactNode; delay?: number; quiet: boolean; className?: string }) {
  return (
    <motion.div className={className} initial={quiet ? { opacity: 0 } : { opacity: 0, y: "0.6em" }} animate={{ opacity: 1, y: 0 }} transition={quiet ? { duration: 0.2 } : { ...spring.enter, delay }}>
      {children}
    </motion.div>
  );
}

export type TestState = { picked: number | null; revealed: boolean; onPick: (i: number) => void; countdown: number | null };

export function SceneVisual({ visual, shown, quiet, test }: { visual: Visual; shown: number; quiet: boolean; test: TestState }) {
  switch (visual.type) {
    case "kapak":
      return (
        <div className="absolute inset-0 grid place-items-center pt-[9%] pb-[14%] max-sm:pb-[5%] bg-ink-900">
          <Girih className="text-kehribar opacity-[0.12]" scale={1.6} />
          <motion.svg
            viewBox="-100 -100 200 200"
            className="absolute size-[28em] text-kehribar opacity-15"
            animate={quiet ? undefined : { rotate: 360 }}
            transition={{ duration: 80, repeat: Infinity, ease: "linear" }}
            aria-hidden
          >
            {[0, 45].map((r) => (
              <rect key={r} x={-70} y={-70} width={140} height={140} fill="none" stroke="currentColor" strokeWidth={3} transform={`rotate(${r})`} />
            ))}
            <circle r={52} fill="none" stroke="currentColor" strokeWidth={2} />
          </motion.svg>
          <div className="relative px-[2em] text-center">
            <Enter quiet={quiet}>
              <p className="text-[1.1em] font-semibold tracking-[0.2em] text-firuze uppercase">{visual.subtitle}</p>
            </Enter>
            <Enter quiet={quiet} delay={0.15}>
              <h2 className="mt-[0.3em] text-[3.6em] leading-[1.05] font-bold text-balance">{visual.title}</h2>
            </Enter>
          </div>
        </div>
      );

    case "sahne":
      return (
        <div className="absolute inset-0">
          <Illustration scene={visual.scene} className="absolute inset-0 h-full w-full" />
          <div className="absolute inset-x-0 top-[6%] flex justify-center px-[1em]">
            <Enter quiet={quiet} delay={0.3}>
              <p className="rounded-[0.6em] bg-ink-950/75 px-[0.9em] py-[0.35em] text-center text-[2em] font-bold text-balance">{visual.caption}</p>
            </Enter>
          </div>
        </div>
      );

    case "kavram": {
      const warn = visual.tone === "uyari";
      return (
        <div className="absolute inset-0 grid place-items-center pt-[9%] pb-[14%] max-sm:pb-[5%] bg-ink-900">
          <Girih className="text-cream opacity-[0.05]" scale={1.2} />
          <div className="relative flex max-w-[80%] flex-col items-center text-center">
            <Enter quiet={quiet}>
              <p className={`text-[4.4em] leading-none font-bold ${warn ? "text-mercan" : "text-kehribar"}`}>{visual.term}</p>
            </Enter>
            <Enter quiet={quiet} delay={0.35}>
              <div className={`mt-[0.6em] h-[0.18em] w-[5em] rounded-full ${warn ? "bg-mercan" : "bg-firuze"}`} />
            </Enter>
            <Enter quiet={quiet} delay={0.55}>
              <p className="mt-[0.7em] text-[2.3em] leading-snug font-semibold text-balance">{visual.meaning}</p>
            </Enter>
            {visual.note && shown > 0.45 && (
              <Enter quiet={quiet}>
                <p className="mt-[0.8em] rounded-[0.5em] bg-ink-800 px-[0.9em] py-[0.4em] text-[1.5em] text-cream-dim">{visual.note}</p>
              </Enter>
            )}
          </div>
        </div>
      );
    }

    case "liste":
      return (
        <div className="absolute inset-0 flex flex-col justify-center bg-ink-900 pt-[9%] pb-[14%] max-sm:pb-[5%] px-[8%]">
          <Girih className="text-cream opacity-[0.04]" scale={1.2} />
          <Enter quiet={quiet}>
            <h3 className="relative text-[2.6em] font-bold text-kehribar">{visual.title}</h3>
          </Enter>
          <ul className="relative mt-[0.8em] flex flex-col gap-[0.55em]">
            {visual.items.map((it, i) =>
              shown >= revealAt(i, visual.items.length) ? (
                <Enter key={i} quiet={quiet}>
                  <li className="flex items-center gap-[0.7em] rounded-[0.6em] bg-ink-800 px-[0.8em] py-[0.5em] shadow-[var(--surface-light)]">
                    <span className="grid size-[2.2em] shrink-0 place-items-center rounded-full bg-firuze text-[1.1em] text-ink-950 [&>svg]:size-[1.1em]">{ICON[it.icon]}</span>
                    <span className="text-[1.9em] leading-snug font-semibold">{it.text}</span>
                  </li>
                </Enter>
              ) : (
                <li key={i} className="invisible rounded-[0.6em] px-[0.8em] py-[0.5em] text-[1.9em]" aria-hidden>
                  {it.text}
                </li>
              ),
            )}
          </ul>
        </div>
      );

    case "kartlar": {
      const n = visual.cards.length;
      return (
        <div className="absolute inset-0 flex flex-col justify-center bg-ink-900 pt-[9%] pb-[14%] max-sm:pb-[5%] px-[6%]">
          <Girih className="text-kehribar opacity-[0.06]" scale={1.2} />
          <Enter quiet={quiet}>
            <h3 className="relative text-center text-[2.4em] font-bold text-kehribar">{visual.title}</h3>
          </Enter>
          <div className={`relative mt-[0.9em] grid gap-[0.8em] ${n <= 4 ? "grid-cols-2" : "grid-cols-3"}`}>
            {visual.cards.map((c, i) => {
              const on = shown >= revealAt(i, n);
              return (
                <motion.div
                  key={i}
                  className="rounded-[0.7em] bg-ink-800 px-[0.9em] py-[0.7em] text-center shadow-[var(--surface-light)]"
                  initial={false}
                  animate={{ opacity: on ? 1 : 0.18, scale: on || quiet ? 1 : 0.94 }}
                  transition={quiet ? { duration: 0.2 } : spring.enter}
                >
                  <p className="text-[2em] leading-tight font-bold text-firuze [overflow-wrap:anywhere]">{c.term}</p>
                  <p className="mt-[0.2em] text-[1.45em] leading-snug text-cream-dim">{on ? c.text : " "}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      );
    }

    case "ayet":
      return (
        <div className="absolute inset-0 grid place-items-center pt-[9%] pb-[14%] max-sm:pb-[5%] bg-ink-950">
          <Girih className="text-kehribar opacity-[0.1]" scale={1} />
          <div className="relative w-[78%] rounded-[1.2em] border-[0.25em] border-kehribar/70 bg-ink-900/95 px-[2em] py-[1.4em] text-center shadow-[var(--surface-light)]">
            <span className="absolute -top-[0.9em] left-1/2 -translate-x-1/2 rounded-full bg-kehribar px-[0.9em] py-[0.15em] text-[1.2em] font-bold text-ink-950">{visual.label}</span>
            {visual.lines.map((line, i) =>
              shown >= revealAt(i, visual.lines.length) ? (
                <motion.p
                  key={i}
                  className="text-[2.3em] leading-snug font-semibold text-balance"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: quiet ? 0.2 : 0.8, ease }}
                >
                  {line}
                </motion.p>
              ) : (
                <p key={i} className="invisible text-[2.3em] leading-snug" aria-hidden>
                  {line}
                </p>
              ),
            )}
            <p className="mt-[0.8em] text-[1.3em] text-ink-300">({visual.source})</p>
          </div>
        </div>
      );

    case "test": {
      const { picked, revealed, onPick, countdown } = test;
      return (
        <div className="absolute inset-0 flex flex-col justify-center bg-ink-900 pt-[9%] pb-[14%] max-sm:pb-[5%] px-[6%]">
          <Girih className="text-mercan opacity-[0.05]" scale={1.2} />
          <Enter quiet={quiet}>
            <p className="relative text-center text-[2.3em] leading-snug font-bold text-balance">{visual.question}</p>
          </Enter>
          <div className="relative mt-[1em] grid grid-cols-2 gap-[0.7em]">
            {visual.options.map((o, i) => {
              const right = revealed && i === visual.answer;
              const wrong = revealed && picked === i && i !== visual.answer;
              return (
                <motion.button
                  key={i}
                  type="button"
                  disabled={revealed}
                  onClick={() => onPick(i)}
                  className={`pressable flex items-center gap-[0.6em] rounded-[0.7em] px-[0.8em] py-[0.6em] text-left text-[1.9em] font-bold transition-colors ${
                    right ? "bg-zumrut text-ink-950" : wrong ? "bg-mercan text-ink-950" : picked === i ? "bg-kobalt text-ink-950" : "bg-ink-800 text-cream"
                  }`}
                  style={{ "--edge": right ? "var(--color-zumrut-deep)" : wrong ? "var(--color-mercan-deep)" : "var(--color-ink-950)" } as React.CSSProperties}
                  animate={right && !quiet ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                  transition={spring.celebrate}
                >
                  <span className="grid size-[1.5em] shrink-0 place-items-center rounded-full bg-ink-950/25 text-[0.8em]">{right ? <Check className="size-[1em]" strokeWidth={3} /> : wrong ? <X className="size-[1em]" strokeWidth={3} /> : "ABCD"[i]}</span>
                  {o}
                </motion.button>
              );
            })}
          </div>
          <p className="relative mt-[0.9em] h-[1.4em] text-center text-[1.4em] font-semibold text-ink-300">
            {!revealed && countdown !== null ? `Cevabını seç… ${countdown}` : ""}
          </p>
        </div>
      );
    }

    case "ozet":
      return (
        <div className="absolute inset-0 flex flex-col justify-center bg-ink-900 pt-[9%] pb-[14%] max-sm:pb-[5%] px-[8%]">
          <Girih className="text-kehribar opacity-[0.07]" scale={1.2} />
          <Enter quiet={quiet}>
            <h3 className="relative text-[2.6em] font-bold text-kehribar">Neler öğrendik?</h3>
          </Enter>
          <ul className="relative mt-[0.8em] flex flex-col gap-[0.5em]">
            {visual.items.map((it, i) =>
              shown >= revealAt(i, visual.items.length) ? (
                <Enter key={i} quiet={quiet}>
                  <li className="flex items-center gap-[0.7em]">
                    <span className="grid size-[1.9em] shrink-0 place-items-center rounded-full bg-zumrut text-ink-950">
                      <Check className="size-[1.1em]" strokeWidth={3} />
                    </span>
                    <span className="text-[1.9em] leading-snug font-semibold">{it}</span>
                  </li>
                </Enter>
              ) : (
                <li key={i} className="invisible text-[1.9em]" aria-hidden>
                  {it}
                </li>
              ),
            )}
          </ul>
        </div>
      );
  }
}
