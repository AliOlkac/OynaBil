"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { loadGameState, saveGameState } from "./session";

/**
 * Oyun reducer'ını çalıştırır ve her değişiklikte durumu saklar.
 * `hydrate`, yeniden yüklenen bir durumu güvenli hâle getirir (ör. süreyi duraklatır).
 */
export function usePersistentReducer<S, A>(
  sessionId: string,
  reducer: (state: S, action: A) => S,
  init: () => S,
  hydrate: (saved: S) => S = (s) => s,
): [S, (action: A) => void] {
  const [state, setState] = useState<S>(() => {
    const saved = loadGameState<S>(sessionId);
    return saved ? hydrate(saved) : init();
  });

  useEffect(() => {
    saveGameState(sessionId, state);
  }, [sessionId, state]);

  const dispatch = useCallback((action: A) => setState((s) => reducer(s, action)), [reducer]);
  return [state, dispatch];
}

/** Olay işleyicilerinde kullanılan saat. Oyun eylemleri zamanı dışarıdan alır ki reducer saf kalsın. */
export const clock = () => Date.now();

/** Belirli aralıklarla yenilenen "şimdi". Sayaçlar ve geri sayımlar için. */
export function useNow(active: boolean, interval = 100): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(id);
  }, [active, interval]);
  return now;
}

const subscribeNothing = () => () => {};

/** Sunucuda false, tarayıcıda true. localStorage'a bağlı ekranlar için. */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
}

export function useFullscreen(): [boolean, () => void] {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const sync = () => setOn(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const toggle = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);
  return [on, toggle];
}
