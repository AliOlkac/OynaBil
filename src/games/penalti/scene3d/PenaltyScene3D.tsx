"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { spring } from "@/lib/motion";
import { initialTier, rememberTier } from "../../shared/stage3d/support";
import { GOAL_KIND_TEXT, goalKind, type KickResult } from "../logic";
import type { ArtTeam } from "../scene/art";
import type { SceneInput } from "../scene/PenaltyScene";

/**
 * Penaltı sahnesinin üç boyutlu sürümü. three.js ve sahne motoru ayrı bir parçadır; bu bileşen
 * ekrana gelince indirilir. Motor yüklenene kadar koyu bir zemin görünür.
 *
 * Çizim sahnesiyle (PenaltyScene) aynı girdiyi alır ve aynı olayları bildirir; oyun ekranı
 * hangisinin çalıştığını bilmez.
 */

type Props = {
  input: SceneInput;
  teams: [ArtTeam, ArtTeam];
  reducedMotion: boolean;
  onKick: (x: number, y: number) => void;
  onContact: (index: number) => void;
  onKickDone: (index: number) => void;
  onFinale: () => void;
  /** Tahta 3D'yi çizemedi ya da akıcı oynatamadı. `slow`: kare hızı yetmedi. */
  onGiveUp: (reason: "slow" | "error") => void;
  /** Öğretmen 3D'yi kendisi açtıysa yavaşlıkta vazgeçilmez. */
  forced: boolean;
};

const BANNER: Record<KickResult, string> = { gol: "GOL!", kurtardi: "KURTARDI!", direk: "DİREK!", aut: "AUT!" };
const BANNER_MS = 2600;

export function PenaltyScene3D({ input, teams, reducedMotion, onKick, onContact, onKickDone, onFinale, onGiveUp, forced }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({ input, reducedMotion, onKick, onContact, onKickDone, onFinale, onGiveUp, forced });
  useEffect(() => {
    live.current = { input, reducedMotion, onKick, onContact, onKickDone, onFinale, onGiveUp, forced };
  });
  // Takımlar oyun boyunca değişmez; motor ilk değerle kurulur.
  const teamsRef = useRef(teams);

  const [ready, setReady] = useState(false);
  const [banner, setBanner] = useState<{ result: KickResult; side: 0 | 1; id: number } | null>(null);
  const [replay, setReplay] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let engine: { dispose: () => void } | null = null;
    let bannerTimer = 0;
    let bannerId = 0;
    void (async () => {
      try {
        const { createPenaltyEngine, fontsReady } = await import("./engine");
        await fontsReady();
        if (disposed) return;
        engine = createPenaltyEngine({
          canvas,
          tier: initialTier(),
          teams: teamsRef.current,
          getInput: () => live.current.input,
          isReducedMotion: () => live.current.reducedMotion,
          handlers: () => live.current,
          ui: {
            banner: (result, side) => {
              window.clearTimeout(bannerTimer);
              setBanner(result ? { result, side, id: ++bannerId } : null);
              if (result) bannerTimer = window.setTimeout(() => setBanner(null), BANNER_MS);
            },
            replay: setReplay,
          },
          onTier: rememberTier,
          onGiveUp: (reason) => {
            // Öğretmen 3D'yi kendisi açtıysa yavaş da olsa sürer; çizim bağlamı kaybolduysa sürdürülemez.
            if (reason === "slow" && live.current.forced) return false;
            live.current.onGiveUp(reason === "slow" ? "slow" : "error");
            return true;
          },
        });
        setReady(true);
      } catch (error) {
        // Tahtanın neden 3D açamadığı konsoldan görülebilsin; oyun çizim sahnesiyle sürer.
        console.error("3D sahne açılamadı", error);
        if (!disposed) live.current.onGiveUp("error");
      }
    })();
    return () => {
      disposed = true;
      window.clearTimeout(bannerTimer);
      engine?.dispose();
    };
  }, []);

  const bannerColor = banner ? (banner.result === "gol" ? teams[banner.side].base : banner.result === "kurtardi" ? "var(--color-kehribar)" : "var(--color-cream)") : undefined;

  return (
    <div className="absolute inset-0 bg-ink-950">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ touchAction: "none" }} aria-hidden />
      {!ready && <p className="absolute inset-0 grid place-items-center text-lg font-semibold text-ink-400">Stadyum hazırlanıyor…</p>}
      <AnimatePresence>
        {replay && (
          <motion.p
            key="replay"
            className="pointer-events-none absolute top-3 left-3 flex items-center gap-2 rounded-lg bg-ink-950/85 px-3 py-1.5 text-sm font-bold tracking-widest text-cream sm:top-4 sm:left-4 sm:text-lg"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={spring.enter}
          >
            <span className="size-2.5 rounded-full bg-mercan sm:size-3" />
            TEKRAR
          </motion.p>
        )}
        {banner && (
          <motion.p
            key={banner.id}
            className="pointer-events-none absolute inset-x-0 bottom-[5%] text-center text-4xl font-bold tracking-wide sm:text-6xl"
            style={{ color: bannerColor, WebkitTextStroke: "0.14em var(--color-ink-950)", paintOrder: "stroke fill" }}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={spring.celebrate}
          >
            {(() => {
              const last = input.kicks[input.kicks.length - 1];
              const kind = last ? goalKind(last) : null;
              return kind ? GOAL_KIND_TEXT[kind] : BANNER[banner.result];
            })()}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
