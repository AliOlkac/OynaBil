"use client";

import { useEffect, useRef, useState } from "react";
import { setStage3dPref, shouldUse3d, useStage3d } from "../../shared/stage3d/support";
import type { ArtTeam } from "../scene/art";
import { SiegeScene, type RulerSpec, type SceneInput } from "../scene/SiegeScene";
import { SiegeScene3D } from "./SiegeScene3D";

/**
 * Kule Yıkmaca sahnesini seçer: tahta üç boyutlu çizebiliyorsa 3D sahne, çizemiyorsa (ya da öğretmen
 * kapattıysa) çizim sahnesi. İkisi aynı girdiyi alır, aynı olayları bildirir.
 */

type Props = {
  input: SceneInput;
  teams: [ArtTeam, ArtTeam];
  ruler: RulerSpec;
  reducedMotion: boolean;
  onImpact: (index: number) => void;
  onFinale: () => void;
};

/** Tahta 3D'yi oynatamayınca çıkan bilgi notunun ekranda kalma süresi. */
const NOTICE_MS = 9000;

/** Oyun tanıtım ekranındayken 3D motorun parçasını indirir; "Başla" denince kuleler beklemeden açılır. */
export function preloadSiegeStage() {
  if (shouldUse3d()) void import("./engine").catch(() => {});
}

export function SiegeStage(props: Props) {
  const { enabled, pref } = useStage3d();
  const [notice, setNotice] = useState(false);
  const noticeTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  // Sahne oyunun ortasında değişirse (düğme ya da yavaş tahta) havadaki taşın gösterisi yarıda kalır;
  // oyun takılmasın diye o atış isabet etmiş sayılır. Yeni sahne kuleyi son hâliyle kurar.
  const first = useRef(true);
  const { input, onImpact } = props;
  const shots = input.shots.length;
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (shots > 0) onImpact(shots - 1);
    // Yalnızca sahne değiştiğinde çalışır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  if (enabled) {
    return (
      <SiegeScene3D
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
      <SiegeScene {...props} />
      {notice && (
        <p role="status" className="pointer-events-none absolute inset-x-3 bottom-3 mx-auto w-fit max-w-full rounded-lg bg-ink-950/90 px-4 py-2 text-center text-sm text-cream-dim sm:text-base">
          Bu tahta 3D sahneyi akıcı oynatamadı; oyun çizim sahnesiyle sürüyor. Üstteki 3D düğmesiyle yeniden deneyebilirsiniz.
        </p>
      )}
    </>
  );
}
