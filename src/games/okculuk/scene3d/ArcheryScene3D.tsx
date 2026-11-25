"use client";

import { useEffect, useRef, useState } from "react";
import { initialTier, rememberTier } from "../../shared/stage3d/support";
import type { ShotResult } from "../logic";
import type { ArcherySceneInput, SceneTeam } from "../scene/types";
import { ReplayChip } from "../scene/Overlays";

/**
 * Okçuluk sahnesinin üç boyutlu sürümü. three.js ve sahne motoru ayrı bir parçadır; bu bileşen
 * ekrana gelince indirilir. Çizim sahnesiyle (ArcheryScene) aynı girdiyi alır ve aynı olayları bildirir.
 */

type Props = {
  input: ArcherySceneInput;
  teams: [SceneTeam, SceneTeam];
  reducedMotion: boolean;
  onContact: (index: number) => void;
  onShotDone: (index: number) => void;
  onFinale: () => void;
  onBanner: (result: ShotResult | null, side: 0 | 1, points: number) => void;
  onGiveUp: (reason: "slow" | "error") => void;
  forced: boolean;
};

export function ArcheryScene3D(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef(props);
  useEffect(() => {
    live.current = props;
  });
  const teamsRef = useRef(props.teams);
  const [ready, setReady] = useState(false);
  const [replay, setReplay] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let engine: { dispose: () => void } | null = null;
    void (async () => {
      try {
        const [{ createArcheryEngine }, { fontsReady }] = await Promise.all([import("./engine"), import("../../shared/stage3d/kit")]);
        await fontsReady();
        if (disposed) return;
        engine = createArcheryEngine({
          canvas,
          tier: initialTier(),
          teams: teamsRef.current,
          getInput: () => live.current.input,
          isReducedMotion: () => live.current.reducedMotion,
          handlers: () => live.current,
          ui: { banner: (r, side, points) => live.current.onBanner(r, side, points), replay: setReplay },
          onTier: rememberTier,
          onGiveUp: (reason) => {
            if (reason === "slow" && live.current.forced) return false;
            live.current.onGiveUp(reason === "slow" ? "slow" : "error");
            return true;
          },
        });
        setReady(true);
      } catch (error) {
        console.error("3D sahne açılamadı", error);
        if (!disposed) live.current.onGiveUp("error");
      }
    })();
    return () => {
      disposed = true;
      engine?.dispose();
    };
  }, []);

  return (
    <div className="absolute inset-0 bg-ink-950">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
      {!ready && <p className="absolute inset-0 grid place-items-center text-lg font-semibold text-ink-400">Atış alanı hazırlanıyor…</p>}
      <ReplayChip on={replay} />
    </div>
  );
}
