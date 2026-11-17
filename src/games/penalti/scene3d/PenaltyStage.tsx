"use client";

import { useEffect, useRef, useState } from "react";
import { setStage3dPref, shouldUse3d, useStage3d } from "../../shared/stage3d/support";
import type { ArtTeam } from "../scene/art";
import { PenaltyScene, type SceneInput } from "../scene/PenaltyScene";
import { PenaltyScene3D } from "./PenaltyScene3D";

/**
 * Penaltı sahnesini seçer: tahta üç boyutlu çizebiliyorsa 3D sahne, çizemiyorsa (ya da öğretmen
 * kapattıysa) çizim sahnesi. İkisi aynı girdiyi alır, aynı olayları bildirir.
 */

type Props = {
  input: SceneInput;
  teams: [ArtTeam, ArtTeam];
  reducedMotion: boolean;
  onKick: (x: number, y: number) => void;
  onContact: (index: number) => void;
  onKickDone: (index: number) => void;
  onFinale: () => void;
};

/** Tahta 3D'yi oynatamayınca çıkan bilgi notunun ekranda kalma süresi. */
const NOTICE_MS = 9000;

/** Oyun tanıtım ekranındayken 3D motorun parçasını indirir; "Başla" denince stadyum beklemeden açılır. */
export function preloadPenaltyStage() {
  if (shouldUse3d()) void import("./engine").catch(() => {});
}

export function PenaltyStage(props: Props) {
  const { enabled, pref } = useStage3d();
  const [notice, setNotice] = useState(false);
  const noticeTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  // Sahne oyunun ortasında değişirse (düğme ya da yavaş tahta) süren şutun gösterisi yarıda kalır;
  // oyun takılmasın diye o şut bitmiş sayılır.
  const first = useRef(true);
  const { input, onKickDone } = props;
  const kicks = input.kicks.length;
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (kicks > 0) onKickDone(kicks - 1);
    // Yalnızca sahne değiştiğinde çalışır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  if (enabled) {
    return (
      <PenaltyScene3D
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
      <PenaltyScene {...props} />
      {notice && (
        <p role="status" className="pointer-events-none absolute inset-x-3 bottom-3 mx-auto w-fit max-w-full rounded-lg bg-ink-950/90 px-4 py-2 text-center text-sm text-cream-dim sm:text-base">
          Bu tahta 3D sahneyi akıcı oynatamadı; oyun çizim sahnesiyle sürüyor. Üstteki 3D düğmesiyle yeniden deneyebilirsiniz.
        </p>
      )}
    </>
  );
}
