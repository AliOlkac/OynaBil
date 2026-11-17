"use client";

import { useEffect, useRef, useState } from "react";
import { initialTier, rememberTier } from "../../shared/stage3d/support";
import type { SceneInput, SceneTeam } from "../scene/TugScene";

/**
 * Halat Çekme sahnesinin üç boyutlu sürümü. three.js ve sahne motoru ayrı bir parçadır; bu bileşen
 * ekrana gelince indirilir. Çizim sahnesiyle (TugScene) aynı girdiyi alır.
 */

type Props = {
  input: SceneInput;
  teams: [SceneTeam, SceneTeam];
  reducedMotion: boolean;
  /** Tahta 3D'yi çizemedi ya da akıcı oynatamadı. */
  onGiveUp: (reason: "slow" | "error") => void;
  /** Öğretmen 3D'yi kendisi açtıysa yavaşlıkta vazgeçilmez. */
  forced: boolean;
};

export function TugScene3D({ input, teams, reducedMotion, onGiveUp, forced }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({ input, reducedMotion, onGiveUp, forced });
  useEffect(() => {
    live.current = { input, reducedMotion, onGiveUp, forced };
  });
  // Takımlar oyun boyunca değişmez; motor ilk değerle kurulur.
  const teamsRef = useRef(teams);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let engine: { dispose: () => void } | null = null;
    void (async () => {
      try {
        const { createTugEngine } = await import("./engine");
        if (disposed) return;
        engine = createTugEngine({
          canvas,
          tier: initialTier(),
          teams: teamsRef.current,
          getInput: () => live.current.input,
          isReducedMotion: () => live.current.reducedMotion,
          onTier: rememberTier,
          onGiveUp: (reason) => {
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
      engine?.dispose();
    };
  }, []);

  return (
    <div className="absolute inset-0 bg-ink-950">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
      {!ready && <p className="absolute inset-0 grid place-items-center text-lg font-semibold text-ink-400">Saha hazırlanıyor…</p>}
    </div>
  );
}
