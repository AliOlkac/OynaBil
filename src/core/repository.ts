"use client";

import { useSyncExternalStore } from "react";
import { BUILT_IN_QUESTIONS, SUBJECTS } from "@/content";
import { readJson, writeJson } from "@/lib/storage";
import { questionSchema, type Grade, type Question, type Subject, type Unit } from "./model";

/**
 * Soru havuzu = uygulamayla gelen sorular + öğretmenin bu cihazda eklediği sorular.
 *
 * Bugün öğretmen soruları tarayıcıda tutuluyor. Hesaplar geldiğinde bu dosyadaki
 * okuma/yazma fonksiyonları bir API'ye bağlanır; oyunlar ve ekranlar değişmez.
 */

const CUSTOM_KEY = "oynabil.ogretmen-sorulari.v1";
const listeners = new Set<() => void>();
let customCache: Question[] | null = null;

function loadCustom(): Question[] {
  if (customCache) return customCache;
  const raw = readJson<unknown[]>(CUSTOM_KEY, []);
  customCache = raw.flatMap((item) => {
    const parsed = questionSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
  return customCache;
}

function saveCustom(next: Question[]) {
  customCache = next;
  writeJson(CUSTOM_KEY, next);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === CUSTOM_KEY) {
      customCache = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const EMPTY: Question[] = [];

export function useCustomQuestions(): Question[] {
  return useSyncExternalStore(subscribe, loadCustom, () => EMPTY);
}

export function useQuestionPool(): Question[] {
  const custom = useCustomQuestions();
  return custom.length ? [...BUILT_IN_QUESTIONS, ...custom] : BUILT_IN_QUESTIONS;
}

export function isCustomQuestion(id: string): boolean {
  return id.includes("-ogr-");
}

export function newCustomQuestionId(unitId: string): string {
  const stamp = Date.now().toString(36);
  const salt = Math.floor(Math.random() * 1296).toString(36).padStart(2, "0");
  return `${unitId}-ogr-${stamp}${salt}`;
}

export function upsertCustomQuestion(q: Question): void {
  const parsed = questionSchema.parse(q);
  const list = loadCustom();
  const index = list.findIndex((x) => x.id === parsed.id);
  saveCustom(index === -1 ? [...list, parsed] : list.map((x, i) => (i === index ? parsed : x)));
}

export function deleteCustomQuestion(id: string): void {
  saveCustom(loadCustom().filter((q) => q.id !== id));
}

/** JSON dosyasından toplu içe aktarma. Geçersiz kayıtlar atlanır ve sayılır. */
export function importCustomQuestions(items: unknown[]): { added: number; skipped: number } {
  const valid: Question[] = [];
  let skipped = 0;
  for (const item of items) {
    const parsed = questionSchema.safeParse(item);
    if (parsed.success && findUnit(parsed.data.unit)) valid.push(parsed.data);
    else skipped++;
  }
  const byId = new Map(loadCustom().map((q) => [q.id, q]));
  for (const q of valid) byId.set(q.id, q);
  saveCustom([...byId.values()]);
  return { added: valid.length, skipped };
}

export function getSubject(id: string): Subject | undefined {
  return SUBJECTS.find((s) => s.id === id);
}

export function findUnit(unitId: string): (Unit & { subject: Subject }) | undefined {
  for (const subject of SUBJECTS) {
    const unit = subject.units.find((u) => u.id === unitId);
    if (unit) return { ...unit, subject };
  }
  return undefined;
}

export function unitsFor(subject: Subject, grade: Grade): Unit[] {
  return subject.units.filter((u) => u.grade === grade).sort((a, b) => a.order - b.order);
}
