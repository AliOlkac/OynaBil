"use client";

import { Pause, Play, SkipForward } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNow } from "@/lib/hooks";

/**
 * Devam düğmesinin yerine geçen otomatik geçiş: süre dolunca `onDone` bir kez çağrılır.
 * Öğretmen konuyu anlatmak isterse "Bekle" ile durdurur, "Geç" ile hemen geçer.
 */
export function AutoAdvance({ duration, onDone, label = "Sıradaki soru" }: { duration: number; onDone: () => void; label?: string }) {
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [spent, setSpent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [done, setDone] = useState(false);
  const now = useNow(!paused && !done, 100);
  const elapsed = paused ? spent : spent + Math.max(0, now - startedAt);
  const left = Math.max(0, duration - elapsed);
  // Üst bileşen her karede yeni bir işlev verebilir; zamanlayıcı bundan etkilenmesin.
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });

  // Süre bir zamanlayıcıyla beklenir; duraklatınca iptal olur, devamda kalan süre için yeniden kurulur.
  useEffect(() => {
    if (done || paused) return;
    const id = window.setTimeout(() => {
      setDone(true);
      doneRef.current();
    }, Math.max(0, duration - spent));
    return () => window.clearTimeout(id);
  }, [done, paused, spent, duration]);

  const toggle = () => {
    if (paused) {
      setStartedAt(Date.now());
      setPaused(false);
    } else {
      setSpent(spent + Date.now() - startedAt);
      setPaused(true);
    }
  };

  return (
    <div className="flex shrink-0 items-center gap-2">
      <div className="hidden w-40 flex-col gap-1 sm:flex">
        <span className="text-sm font-semibold text-ink-300">
          {label} <span className="tabular">{paused ? "bekliyor" : `${Math.ceil(left / 1000)} sn`}</span>
        </span>
        <div className="h-2 overflow-hidden rounded-full bg-ink-800" aria-hidden>
          <div className="h-full origin-left rounded-full bg-kehribar transition-transform duration-100 ease-linear" style={{ transform: `scaleX(${left / duration})` }} />
        </div>
      </div>
      <button
        type="button"
        onClick={toggle}
        className="grid size-12 place-items-center rounded-lg bg-ink-800 text-cream hover:bg-ink-700"
        aria-label={paused ? "Devam et" : "Bekle"}
        title={paused ? "Devam et" : "Bekle: konuyu anlatın"}
      >
        {paused ? <Play className="size-6 fill-current" /> : <Pause className="size-6 fill-current" />}
      </button>
      <button
        type="button"
        onClick={() => {
          if (done) return;
          setDone(true);
          doneRef.current();
        }}
        className="grid size-12 place-items-center rounded-lg bg-ink-800 text-cream hover:bg-ink-700"
        aria-label="Hemen geç"
        title="Hemen geç"
      >
        <SkipForward className="size-6 fill-current" />
      </button>
    </div>
  );
}
