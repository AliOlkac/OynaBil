"use client";

import { useEffect, useRef, useState } from "react";
import { setStage3dPref, shouldUse3d, useStage3d } from "../../shared/stage3d/support";
import type { ShotResult } from "../logic";
import { BasketScene } from "../scene/BasketScene";
import { ResultBanner, type Banner } from "../scene/Overlays";
import type { BasketSceneInput, SceneTeam } from "../scene/types";
import { BasketScene3D } from "./BasketScene3D";

/**
 * Basketbol sahnesini seçer: tahta üç boyutlu çizebiliyorsa 3D salon, çizemiyorsa (ya da öğretmen
 * kapattıysa) çizim sahnesi. İkisi aynı girdiyi alır, aynı olayları bildirir.
 */

type Props = {
  input: BasketSceneInput;
  teams: [SceneTeam, SceneTeam];
  reducedMotion: boolean;
  onContact: (index: number) => void;
  onShotDone: (index: number) => void;
  onFinale: () => void;
};

const NOTICE_MS = 9000;
const BANNER_MS = 2600;

/** Oyun tanıtım ekranındayken 3D motorun parçasını indirir. */
export function preloadBasketStage() {
  if (shouldUse3d()) void import("./engine").catch(() => {});
}

export function BasketStage(props: Props) {
  const { enabled, pref } = useStage3d();
  const [notice, setNotice] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);
  const timers = useRef({ notice: 0, banner: 0, id: 0 });
  useEffect(() => {
    const t = timers.current;
    return () => {
      window.clearTimeout(t.notice);
      window.clearTimeout(t.banner);
    };
  }, []);
  const onBanner = (result: ShotResult | null, side: 0 | 1, points: number) => {
    const t = timers.current;
    window.clearTimeout(t.banner);
    setBanner(result ? { result, side, points, id: ++t.id } : null);
    if (result) t.banner = window.setTimeout(() => setBanner(null), BANNER_MS);
  };

  // Sahne oyunun ortasında değişirse süren atışın gösterisi yarıda kalır; oyun takılmasın diye atış bitmiş sayılır.
  const first = useRef(true);
  const { input, onShotDone } = props;
  const shots = input.shots.length;
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (shots > 0) onShotDone(shots - 1);
    // Yalnızca sahne değiştiğinde çalışır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return (
    <>
      {enabled ? (
        <BasketScene3D
          {...props}
          onBanner={onBanner}
          forced={pref === "acik"}
          onGiveUp={() => {
            setStage3dPref("kapali");
            setNotice(true);
            window.clearTimeout(timers.current.notice);
            timers.current.notice = window.setTimeout(() => setNotice(false), NOTICE_MS);
          }}
        />
      ) : (
        <BasketScene {...props} onBanner={onBanner} />
      )}
      <ResultBanner banner={banner} teams={props.teams} />
      {notice && !enabled && (
        <p role="status" className="pointer-events-none absolute inset-x-3 bottom-3 mx-auto w-fit max-w-full rounded-lg bg-ink-950/90 px-4 py-2 text-center text-sm text-cream-dim sm:text-base">
          Bu tahta 3D sahneyi akıcı oynatamadı; oyun çizim sahnesiyle sürüyor. Üstteki 3D düğmesiyle yeniden deneyebilirsiniz.
        </p>
      )}
    </>
  );
}
