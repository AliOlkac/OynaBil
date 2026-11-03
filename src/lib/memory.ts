"use client";

import { createLocalStore } from "./store";

/**
 * Sorulanlar hafızası: hangi soru hangi şubeye en son ne zaman soruldu.
 * Yeni bir oyunda daha önce sorulmamış sorular önce gelir; böylece büyük bir havuz
 * haftalarca tekrarsız kullanılır. Kapsam ders + sınıf + şubedir (ör. "din-kulturu-8-C").
 */

type Memory = Record<string, Record<string, number>>;

const store = createLocalStore<Memory>("oynabil.sorulanlar.v1", {});
const EMPTY: Readonly<Record<string, number>> = {};

export function memoryScope(subjectId: string, grade: number, section?: string): string {
  return `${subjectId}-${grade}${section ? `-${section}` : ""}`;
}

export function getSeen(scope: string): Readonly<Record<string, number>> {
  return store.get()[scope] ?? EMPTY;
}

export function useSeen(scope: string): Readonly<Record<string, number>> {
  return store.use()[scope] ?? EMPTY;
}

export function markSeen(scope: string, questionIds: readonly string[], at: number) {
  if (questionIds.length === 0) return;
  store.update((all) => {
    const current = { ...(all[scope] ?? {}) };
    for (const id of questionIds) current[id] = at;
    return { ...all, [scope]: current };
  });
}

export function forgetSeen(scope: string) {
  store.update((all) => {
    const rest = { ...all };
    delete rest[scope];
    return rest;
  });
}
