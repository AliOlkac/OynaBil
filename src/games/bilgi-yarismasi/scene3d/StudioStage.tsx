"use client";

import { useEffect, useRef } from "react";
import { initialTier, rememberTier, setStage3dPref, shouldUse3d, useStage3d } from "../../shared/stage3d/support";
import type { StudioInput, StudioTeam } from "./engine";

/**
 * Bilgi Yarışması'nın stüdyo şeridi. Yalnızca tahta üç boyutlu çizebiliyorsa görünür; çizemiyorsa
 * (ya da öğretmen kapattıysa) şerit hiç yer kaplamaz ve oyun yalnızca soru ekranıyla oynanır.
 */

type Props = { input: StudioInput; teams: StudioTeam[]; reducedMotion: boolean; className?: string };

/** Oyun tanıtım ekranındayken 3D motorun parçasını indirir. */
export function preloadStudioStage() {
  if (shouldUse3d()) void import("./engine").catch(() => {});
}

export function StudioStage({ input, teams, reducedMotion, className = "" }: Props) {
  const { enabled, pref } = useStage3d();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({ input, reducedMotion, forced: pref === "acik" });
  useEffect(() => {
    live.current = { input, reducedMotion, forced: pref === "acik" };
  });
  // Takımlar oyun boyunca değişmez; motor ilk değerle kurulur.
  const teamsRef = useRef(teams);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!enabled || !canvas) return;
    let disposed = false;
    let engine: { dispose: () => void } | null = null;
    void (async () => {
      try {
        const [{ createStudioEngine }, { fontsReady }] = await Promise.all([import("./engine"), import("../../shared/stage3d/kit")]);
        await fontsReady();
        if (disposed) return;
        engine = createStudioEngine({
          canvas,
          tier: initialTier(),
          teams: teamsRef.current,
          getInput: () => live.current.input,
          isReducedMotion: () => live.current.reducedMotion,
          onTier: rememberTier,
          onGiveUp: (reason) => {
            if (reason === "slow" && live.current.forced) return false;
            // Tahta 3D'yi oynatamadı: şerit kapanır ve tercih bu tahtada hatırlanır.
            setStage3dPref("kapali");
            return true;
          },
        });
      } catch (error) {
        console.error("3D sahne açılamadı", error);
        if (!disposed) setStage3dPref("kapali");
      }
    })();
    return () => {
      disposed = true;
      engine?.dispose();
    };
  }, [enabled]);

  if (!enabled) return null;
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-xl bg-ink-950 shadow-[var(--surface-light)] ${className}`}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
    </div>
  );
}
