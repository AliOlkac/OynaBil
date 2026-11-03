"use client";

import { useSyncExternalStore } from "react";
import { readJson, writeJson } from "./storage";

/**
 * Tarayıcı belleğinde tutulan, değişince ekranları güncelleyen küçük bir kayıt.
 * Aynı tahtada açık başka sekmeler de `storage` olayıyla güncellenir.
 */
export function createLocalStore<T>(key: string, fallback: T) {
  const listeners = new Set<() => void>();
  let cache: T | undefined;

  const get = (): T => {
    if (cache === undefined) cache = readJson<T>(key, fallback);
    return cache;
  };
  const set = (next: T) => {
    cache = next;
    writeJson(key, next);
    listeners.forEach((l) => l());
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      cache = undefined;
      listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  };
  const use = (): T => useSyncExternalStore(subscribe, get, () => fallback);

  return { get, set, update: (fn: (current: T) => T) => set(fn(get())), subscribe, use };
}
