"use client";

import { useEffect, useRef, useState } from "react";
import { setStage3dPref, shouldUse3d, useStage3d } from "../../shared/stage3d/support";
import { TugScene, type SceneInput, type SceneTeam } from "../scene/TugScene";
import { TugScene3D } from "./TugScene3D";

/**
 * Halat Çekme sahnesini seçer: tahta üç boyutlu çizebiliyorsa 3D sahne, çizemiyorsa (ya da öğretmen
 * kapattıysa) çizim sahnesi. İkisi aynı girdiyi alır; sahne oyunun ortasında değişse de oyun sürer.
 */

type Props = { input: SceneInput; teams: [SceneTeam, SceneTeam]; reducedMotion: boolean };

/** Tahta 3D'yi oynatamayınca çıkan bilgi notunun ekranda kalma süresi. */
const NOTICE_MS = 9000;

/** Oyun tanıtım ekranındayken 3D motorun parçasını indirir. */
export function preloadTugStage() {
  if (shouldUse3d()) void import("./engine").catch(() => {});
}

export function TugStage(props: Props) {
  const { enabled, pref } = useStage3d();
  const [notice, setNotice] = useState(false);
  const noticeTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  if (enabled) {
    return (
      <TugScene3D
        {...props}
        forced={pref === "acik"}
        onGiveUp={() => {
          // Tahta 3D'yi oynatamadı: çizim sahnesine geçilir ve tercih bu tahtada hatırlanır.
          setStage3dPref("kapali");
          setNotice(true);
          window.clearTimeout(noticeTimer.current);
          noticeTimer.current = window.setTimeout(() => setNotice(false), NOTICE_MS);
        }}
      />
    );
  }
  return (
    <>
      <TugScene {...props} />
      {notice && (
        <p role="status" className="pointer-events-none absolute inset-x-3 bottom-3 mx-auto w-fit max-w-full rounded-lg bg-ink-950/90 px-4 py-2 text-center text-sm text-cream-dim sm:text-base">
          Bu tahta 3D sahneyi akıcı oynatamadı; oyun çizim sahnesiyle sürüyor. Üstteki 3D düğmesiyle yeniden deneyebilirsiniz.
        </p>
      )}
    </>
  );
}
