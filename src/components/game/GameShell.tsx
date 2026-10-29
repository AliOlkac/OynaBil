"use client";

import { AnimatePresence, motion } from "motion/react";
import { Maximize, Minimize, Volume2, VolumeX, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { useFullscreen } from "@/lib/hooks";
import { isSoundOn, setSoundOn } from "@/lib/sound";
import { dur, spring } from "@/lib/motion";

/** Oyun ekranlarının ortak çerçevesi: üst çubuk, çıkış onayı, ses ve tam ekran. */
export function GameShell({
  title,
  context,
  onExit,
  children,
}: {
  title: string;
  context: string;
  onExit: () => void;
  children: ReactNode;
}) {
  const [fullscreen, toggleFullscreen] = useFullscreen();
  const [sound, setSound] = useState(isSoundOn);
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="board relative flex h-dvh flex-col overflow-hidden bg-ink-900">
      <header className="relative z-20 flex h-14 shrink-0 items-center gap-4 px-5">
        <Logo className="text-lg" />
        <span className="hidden h-5 w-px bg-ink-700 sm:block" aria-hidden />
        <p className="hidden truncate text-base font-semibold sm:block">{title}</p>
        <p className="hidden truncate text-sm text-ink-400 md:block">{context}</p>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="quiet"
            aria-label={sound ? "Sesi kapat" : "Sesi aç"}
            className="!px-3"
            onClick={() => {
              setSoundOn(!sound);
              setSound(!sound);
            }}
            icon={sound ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
          />
          <Button
            variant="quiet"
            aria-label={fullscreen ? "Tam ekrandan çık" : "Tam ekran"}
            className="!px-3"
            onClick={toggleFullscreen}
            icon={fullscreen ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
          />
          <Button variant="quiet" aria-label="Oyundan çık" className="!px-3" onClick={() => setConfirming(true)} icon={<X className="size-6" />} />
        </div>
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col">{children}</main>

      <AnimatePresence>
        {confirming && (
          <motion.div
            className="absolute inset-0 z-50 grid place-items-center bg-ink-950/80 p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: dur.fast }}
            onClick={() => setConfirming(false)}
          >
            <motion.div
              role="dialog"
              aria-modal
              aria-labelledby="exit-title"
              className="w-full max-w-lg rounded-xl bg-ink-800 p-8 shadow-[var(--surface-light),var(--surface-drop)]"
              initial={{ y: 16, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 8, scale: 0.98 }}
              transition={spring.ui}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="exit-title" className="text-2xl font-bold">
                Oyundan çıkılsın mı?
              </h2>
              <p className="mt-2 text-ink-300">Puanlar silinir. Aynı ayarlarla yeni bir oyun kurabilirsiniz.</p>
              <div className="mt-8 flex justify-end gap-3">
                <Button size="lg" onClick={() => setConfirming(false)} autoFocus>
                  Oyuna dön
                </Button>
                <Button size="lg" variant="danger" onClick={onExit}>
                  Çık
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
