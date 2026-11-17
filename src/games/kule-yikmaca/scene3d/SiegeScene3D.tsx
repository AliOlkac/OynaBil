"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { spring } from "@/lib/motion";
import { initialTier, rememberTier } from "../../shared/stage3d/support";
import type { ArtTeam } from "../scene/art";
import type { RulerSpec, SceneInput } from "../scene/SiegeScene";
import type { PopupSpec } from "./engine";

/**
 * Kule Yıkmaca sahnesinin üç boyutlu sürümü. three.js ve sahne motoru ayrı bir parçadır; bu bileşen
 * ekrana gelince indirilir. Çizim sahnesiyle (SiegeScene) aynı girdiyi alır ve aynı olayları bildirir.
 */

type Props = {
  input: SceneInput;
  teams: [ArtTeam, ArtTeam];
  ruler: RulerSpec;
  reducedMotion: boolean;
  onImpact: (index: number) => void;
  onFinale: () => void;
  /** Tahta 3D'yi çizemedi ya da akıcı oynatamadı. */
  onGiveUp: (reason: "slow" | "error") => void;
  /** Öğretmen 3D'yi kendisi açtıysa yavaşlıkta vazgeçilmez. */
  forced: boolean;
};

const TONE: Record<PopupSpec["tone"], string> = { crit: "var(--color-kehribar)", hit: "var(--color-cream)", miss: "var(--color-ink-300)" };

export function SiegeScene3D({ input, teams, ruler, reducedMotion, onImpact, onFinale, onGiveUp, forced }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const live = useRef({ input, ruler, reducedMotion, onImpact, onFinale, onGiveUp, forced });
  useEffect(() => {
    live.current = { input, ruler, reducedMotion, onImpact, onFinale, onGiveUp, forced };
  });
  // Takımlar oyun boyunca değişmez; motor ilk değerle kurulur.
  const teamsRef = useRef(teams);

  const [ready, setReady] = useState(false);
  const [popup, setPopup] = useState<PopupSpec | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let engine: { dispose: () => void } | null = null;
    void (async () => {
      try {
        const [{ createSiegeEngine }, { fontsReady }] = await Promise.all([import("./engine"), import("../../shared/stage3d/kit")]);
        await fontsReady();
        if (disposed) return;
        engine = createSiegeEngine({
          canvas,
          tier: initialTier(),
          teams: teamsRef.current,
          getInput: () => live.current.input,
          getRuler: () => live.current.ruler,
          isReducedMotion: () => live.current.reducedMotion,
          handlers: () => live.current,
          ui: {
            popup: setPopup,
            place: (x, y) => {
              if (popupRef.current) popupRef.current.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
            },
          },
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
      {!ready && <p className="absolute inset-0 grid place-items-center text-lg font-semibold text-ink-400">Kuleler kuruluyor…</p>}
      <div ref={popupRef} className="pointer-events-none absolute top-0 left-0">
        <AnimatePresence>
          {popup && (
            <motion.div
              key={popup.id}
              className="absolute w-max -translate-x-1/2 -translate-y-1/2 text-center font-bold"
              style={{ WebkitTextStroke: "0.16em var(--color-ink-950)", paintOrder: "stroke fill" }}
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={reducedMotion ? { duration: 0 } : spring.celebrate}
            >
              <p className="tabular text-5xl leading-none sm:text-7xl" style={{ color: TONE[popup.tone] }}>
                {popup.value}
              </p>
              <p className="mt-1 text-xl text-cream sm:text-3xl">{popup.label}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
