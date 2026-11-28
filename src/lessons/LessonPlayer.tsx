"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Captions, CaptionsOff, Expand, Gamepad2, Pause, Play, RotateCcw, SkipBack, SkipForward, Target } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Girih } from "@/components/ui/Girih";
import { dur, ease, spring } from "@/lib/motion";
import { sfx } from "@/lib/sound";
import { audioTiming } from "./index";
import { audioName, readingMs, STAGES, type Lesson } from "./model";
import { SceneVisual } from "./visuals";

/**
 * Ders oynatıcısı: sahneler sırayla oynar, her sahnenin anlatımı kendi ses dosyasından çalar ve
 * altyazıda o an okunan kelime vurgulanır. "Kendini dene" sahnesinde oynatıcı durup cevap bekler,
 * sonra doğru cevabı anlatır. Ses dosyası yoksa (ya da açılamazsa) sahne okuma süresi kadar sürer.
 *
 * Klavye: boşluk oynat/duraklat, sağ/sol ok sonraki/önceki sahne, A altyazı, F tam ekran.
 */

const AFTER_SCENE_MS = 700;
const ANSWER_WAIT_S = 6;

type Part = "say" | "wait" | "reveal";
type Phase = "intro" | "playing" | "paused" | "done";

export function LessonPlayer({ lesson, unitTitle, subjectName, next }: { lesson: Lesson; unitTitle: string; subjectName: string; next: { id: string; title: string } | null }) {
  const quiet = Boolean(useReducedMotion());
  const [phase, setPhase] = useState<Phase>("intro");
  const [index, setIndex] = useState(0);
  const [part, setPart] = useState<Part>("say");
  /** Bölümün saati: hangi bölüme ait olduğu ve geçen süre (ms). Kare döngüsü günceller. */
  const [clockState, setClockState] = useState({ key: "", ms: 0 });
  const [captions, setCaptions] = useState(true);
  const [picked, setPicked] = useState<number | null>(null);
  const [media] = useState(() => new Playback());
  const stage = useRef<HTMLDivElement>(null);

  const scene = lesson.scenes[index];
  const visual = scene.visual;
  const isTest = visual.type === "test";
  const speech = part === "reveal" && scene.reveal ? scene.reveal : scene.say;
  const name = audioName(lesson, index, part === "reveal" ? "reveal" : "say");
  const key = `${index}:${part}`;
  const timing = audioTiming(name);
  const total = part === "wait" ? ANSWER_WAIT_S * 1000 : (timing?.ms ?? readingMs(speech));
  const t = clockState.key === key ? clockState.ms : 0;

  const advance = useCallback(() => {
    window.setTimeout(() => {
      setPart("say");
      setPicked(null);
      setIndex((i) => {
        if (i + 1 >= lesson.scenes.length) {
          setPhase("done");
          sfx.win();
          return i;
        }
        return i + 1;
      });
    }, AFTER_SCENE_MS);
  }, [lesson.scenes.length]);

  // ---- "Kendini dene": cevap ----
  const reveal = useCallback(
    (choice: number | null) => {
      if (visual.type !== "test") return;
      setPicked(choice);
      if (choice === visual.answer) sfx.correct();
      else if (choice !== null) sfx.wrong();
      setPart("reveal");
    },
    [visual],
  );

  // Oynarken bölümün sesi çalar ve kare döngüsü saati ilerletir. Duraklatınca ses durur, devam
  // edince kaldığı yerden sürer; sahne ya da bölüm değişince baştan başlar.
  useEffect(() => {
    if (phase !== "playing") return;
    const onEnd = () => {
      if (isTest && part === "say") setPart("wait");
      else advance();
    };
    media.start(key, part === "wait" ? null : `/ses/dersler/${lesson.id}/${name}.mp3`, total, onEnd);
    let raf = 0;
    let lastSecond = -1;
    const tick = () => {
      const ms = media.elapsed();
      setClockState({ key, ms });
      if (part === "wait") {
        const left = Math.ceil(ANSWER_WAIT_S - ms / 1000);
        if (left !== lastSecond && left > 0) sfx.tick();
        lastSecond = left;
        if (ms >= total) {
          reveal(null);
          return;
        }
      } else if (media.finishedByClock(total)) {
        onEnd();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      media.hold();
    };
  }, [phase, key, part, isTest, lesson.id, name, total, media, advance, reveal]);

  useEffect(() => () => media.stop(), [media]);

  // ---- denetimler ----
  const play = () => {
    if (phase === "intro" || phase === "done") {
      media.stop();
      setIndex(0);
      setPart("say");
      setPicked(null);
    }
    setPhase("playing");
  };
  const pause = () => {
    if (phase === "playing") setPhase("paused");
  };
  const go = (i: number) => {
    media.stop();
    setPicked(null);
    setPart("say");
    setIndex(Math.max(0, Math.min(lesson.scenes.length - 1, i)));
    if (phase !== "playing") setPhase("playing");
  };
  const fullscreen = () => {
    const el = stage.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.metaKey || e.ctrlKey) return;
      const k = e.key.toLowerCase();
      if (k === " ") {
        e.preventDefault();
        if (phase === "playing") pause();
        else play();
      } else if (k === "arrowright" && phase !== "intro") go(index + 1);
      else if (k === "arrowleft" && phase !== "intro") go(index - 1);
      else if (k === "a") setCaptions((c) => !c);
      else if (k === "f") fullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const countdown = part === "wait" ? Math.max(1, Math.ceil(ANSWER_WAIT_S - t / 1000)) : null;

  // ---- altyazı: okunan kelime vurgulanır ----
  const words = useMemo(() => speech.split(/\s+/), [speech]);
  const spoken = useMemo(() => {
    if (!timing) return Math.floor((t / Math.max(1, total)) * words.length);
    let n = 0;
    for (const [start] of timing.words) if (start <= t) n++;
    return Math.min(words.length, Math.round((n / Math.max(1, timing.words.length)) * words.length));
  }, [t, timing, total, words.length]);
  const shown = part === "say" ? Math.min(1, t / Math.max(1, total)) : 1;
  const stageInfo = STAGES[scene.stage];

  return (
    <div className="flex min-h-dvh flex-col bg-ink-950">
      <header className="flex h-16 shrink-0 items-center gap-3 px-3 sm:px-6">
        <ButtonLink href="/dersler" variant="quiet" size="lg" className="!px-3" icon={<ArrowLeft className="size-6" />} aria-label="Ders listesine dön" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink-300">
            {subjectName} · {unitTitle}
          </p>
          <h1 className="truncate text-xl font-bold sm:text-2xl">{lesson.title}</h1>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-3 px-2 pb-3 sm:px-6">
        {/* Sahne: 16:9, ekrana sığar; yazılar sahnenin genişliğiyle ölçeklenir. */}
        <div
          ref={stage}
          className="relative aspect-video w-full max-w-[min(100%,calc((100dvh-11rem)*16/9))] overflow-hidden rounded-xl bg-ink-900 shadow-[var(--surface-light)] [container-type:inline-size]"
          style={{ fontSize: "clamp(7px, 1.25cqw, 26px)" }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={phase === "intro" ? "intro" : phase === "done" ? "done" : `s${index}`}
              className="absolute inset-0"
              initial={{ opacity: 0, scale: quiet ? 1 : 1.03 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: quiet ? 0.15 : dur.slow, ease }}
            >
              {phase === "intro" ? (
                <Intro lesson={lesson} unitTitle={unitTitle} onStart={play} />
              ) : phase === "done" ? (
                <Done lesson={lesson} next={next} onReplay={play} />
              ) : (
                <SceneVisual visual={visual} shown={shown} quiet={quiet} test={{ picked, revealed: part === "reveal", countdown, onPick: (i) => part !== "reveal" && reveal(i) }} />
              )}
            </motion.div>
          </AnimatePresence>

          {(phase === "playing" || phase === "paused") && (
            <>
              <span className="absolute top-[3%] left-[2.5%] rounded-full px-[0.8em] py-[0.2em] text-[1.3em] font-bold text-ink-950" style={{ background: stageInfo.color }}>
                {stageInfo.label}
              </span>
              {captions && (
                <div className="pointer-events-none absolute inset-x-[4%] bottom-[3.5%] hidden justify-center sm:flex">
                  <p className="rounded-[0.5em] bg-ink-950/85 px-[0.8em] py-[0.35em] text-center text-[1.6em] leading-snug text-balance">
                    {words.map((w, i) => (
                      <span key={i} className={i < spoken ? "text-cream" : "text-ink-400"}>
                        {w}{" "}
                      </span>
                    ))}
                  </p>
                </div>
              )}
              <AnimatePresence>
                {phase === "paused" && (
                  <motion.button
                    type="button"
                    onClick={play}
                    className="absolute inset-0 grid place-items-center bg-ink-950/40"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    aria-label="Devam et"
                  >
                    <span className="grid size-[7em] place-items-center rounded-full bg-kehribar text-ink-950">
                      <Play className="size-[3em] fill-current" />
                    </span>
                  </motion.button>
                )}
              </AnimatePresence>
            </>
          )}
        </div>

        {/* Telefonda altyazı sahnenin altında durur: küçük sahnede içeriği kapatmasın. */}
        {captions && (phase === "playing" || phase === "paused") && (
          <p className="w-full rounded-lg bg-ink-850 px-3 py-2 text-center text-base leading-snug sm:hidden">
            {words.map((w, i) => (
              <span key={i} className={i < spoken ? "text-cream" : "text-ink-400"}>
                {w}{" "}
              </span>
            ))}
          </p>
        )}
        {/* Denetimler */}
        <div className="flex w-full max-w-[min(100%,calc((100dvh-11rem)*16/9))] items-center gap-2 sm:gap-3">
          <Button variant="quiet" size="lg" className="!px-3" icon={<SkipBack className="size-6" />} onClick={() => go(index - 1)} disabled={phase === "intro"} aria-label="Önceki sahne" />
          <Button
            variant="primary"
            size="lg"
            className="!px-4"
            icon={phase === "playing" ? <Pause className="size-6 fill-current" /> : <Play className="size-6 fill-current" />}
            onClick={phase === "playing" ? pause : play}
            aria-label={phase === "playing" ? "Duraklat" : "Oynat"}
          />
          <Button variant="quiet" size="lg" className="!px-3" icon={<SkipForward className="size-6" />} onClick={() => go(index + 1)} disabled={phase === "intro"} aria-label="Sonraki sahne" />
          <div className="flex h-10 min-w-0 flex-1 items-center gap-1" role="group" aria-label="Sahneler">
            {lesson.scenes.map((s, i) => {
              const fill = phase === "done" || i < index ? 1 : i === index && phase !== "intro" ? (part === "say" ? shown : 1) : 0;
              return (
                <button key={i} type="button" onClick={() => go(i)} className="group flex h-full flex-1 items-center" aria-label={`${i + 1}. sahne: ${STAGES[s.stage].label}`}>
                  <span className="relative h-2.5 w-full overflow-hidden rounded-full bg-ink-700 transition-[height] group-hover:h-3.5">
                    <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${fill * 100}%`, background: STAGES[s.stage].color }} />
                  </span>
                </button>
              );
            })}
          </div>
          <Button variant="quiet" size="lg" className="!px-3" icon={captions ? <Captions className="size-6" /> : <CaptionsOff className="size-6" />} onClick={() => setCaptions((c) => !c)} aria-label={captions ? "Altyazıyı kapat" : "Altyazıyı aç"} aria-pressed={captions} />
          <Button variant="quiet" size="lg" className="hidden !px-3 sm:inline-flex" icon={<Expand className="size-6" />} onClick={fullscreen} aria-label="Tam ekran" />
        </div>
      </main>
    </div>
  );
}

/**
 * Bölüm sesinin çalınması: React durumunun dışında tutulur. Ses dosyası yoksa ya da açılamazsa saat
 * okuma süresine göre ilerler (`finishedByClock`). Aynı bölüm yeniden başlatılırsa kaldığı yerden sürer.
 */
class Playback {
  private audio: HTMLAudioElement | null = null;
  private key = "";
  private fallback = false;
  private base = 0;
  private since = 0;
  private running = false;

  start(key: string, src: string | null, _total: number, onEnd: () => void) {
    const same = key === this.key;
    if (!same) {
      this.stop();
      this.key = key;
      this.base = 0;
      this.fallback = src === null;
      if (src) {
        const a = this.audio ?? (this.audio = new Audio());
        a.src = src;
      }
    }
    this.since = performance.now();
    this.running = true;
    const a = this.audio;
    if (a && !this.fallback) {
      a.onended = () => onEnd();
      a.onerror = () => this.useClock();
      a.play().catch(() => this.useClock());
    }
  }

  private useClock() {
    if (this.fallback) return;
    this.fallback = true;
    this.since = performance.now();
    this.base = (this.audio?.currentTime ?? 0) * 1000;
  }

  /** Bölümün başından beri geçen süre (ms). */
  elapsed(): number {
    if (!this.fallback && this.audio) return this.audio.currentTime * 1000;
    return this.base + (this.running ? performance.now() - this.since : 0);
  }

  /** Sessiz yedekte bölümün süresi doldu mu (sesli çalışta bitişi ses bildirir). */
  finishedByClock(total: number): boolean {
    return this.fallback && this.elapsed() >= total;
  }

  /** Duraklat: ses ve saat kaldığı yerde bekler. */
  hold() {
    if (this.running) this.base = this.elapsed();
    this.running = false;
    if (this.audio) {
      this.audio.onended = null;
      this.audio.pause();
    }
  }

  stop() {
    this.hold();
    this.key = "";
    this.base = 0;
  }
}

function Intro({ lesson, unitTitle, onStart }: { lesson: Lesson; unitTitle: string; onStart: () => void }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-ink-900">
      <Girih className="text-kehribar opacity-[0.1]" scale={1.4} />
      <div className="relative flex max-w-[80%] flex-col items-center text-center">
        <p className="text-[1.3em] font-semibold tracking-[0.18em] text-firuze uppercase">{unitTitle}</p>
        <h2 className="mt-[0.3em] text-[3.4em] leading-tight font-bold text-balance">{lesson.title}</h2>
        <p className="mt-[0.8em] flex items-start gap-[0.5em] rounded-[0.6em] bg-ink-800 px-[1em] py-[0.6em] text-left text-[1.45em] leading-snug text-cream-dim">
          <Target className="mt-[0.15em] size-[1.2em] shrink-0 text-kehribar" />
          <span>
            <b className="text-cream">Bu derste: </b>
            {lesson.goal}
          </span>
        </p>
        <motion.button
          type="button"
          onClick={onStart}
          className="pressable mt-[1.4em] flex items-center gap-[0.5em] rounded-[0.7em] bg-kehribar px-[1.4em] py-[0.6em] text-[2em] font-bold text-ink-950"
          style={{ "--edge": "var(--color-kehribar-deep)" } as React.CSSProperties}
          whileHover={{ scale: 1.03 }}
          transition={spring.ui}
          autoFocus
        >
          <Play className="size-[1em] fill-current" /> Dersi başlat
        </motion.button>
      </div>
    </div>
  );
}

function Done({ lesson, next, onReplay }: { lesson: Lesson; next: { id: string; title: string } | null; onReplay: () => void }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-ink-900">
      <Girih className="text-zumrut opacity-[0.1]" scale={1.4} />
      <div className="relative flex flex-col items-center text-center">
        <motion.p className="text-[4em] font-bold text-kehribar" initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={spring.celebrate}>
          Tebrikler!
        </motion.p>
        <p className="mt-[0.3em] text-[1.8em] text-cream-dim">“{lesson.title}” dersini bitirdin.</p>
        <div className="mt-[1.2em] flex flex-wrap justify-center gap-[0.6em] text-[1.4em]">
          <button type="button" onClick={onReplay} className="pressable flex items-center gap-[0.4em] rounded-[0.6em] bg-ink-700 px-[0.9em] py-[0.5em] font-bold">
            <RotateCcw className="size-[1em]" /> Tekrar izle
          </button>
          {next && (
            <Link href={`/dersler/${next.id}`} className="pressable flex items-center gap-[0.4em] rounded-[0.6em] bg-kehribar px-[0.9em] py-[0.5em] font-bold text-ink-950" style={{ "--edge": "var(--color-kehribar-deep)" } as React.CSSProperties}>
              Sonraki ders: {next.title} <ArrowRight className="size-[1em]" />
            </Link>
          )}
          <Link href="/kurulum" className="pressable flex items-center gap-[0.4em] rounded-[0.6em] bg-firuze px-[0.9em] py-[0.5em] font-bold text-ink-950" style={{ "--edge": "var(--color-firuze-deep)" } as React.CSSProperties}>
            <Gamepad2 className="size-[1em]" /> Bu konuyla oyun kur
          </Link>
        </div>
      </div>
    </div>
  );
}
