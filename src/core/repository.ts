"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { loadBuiltIn, SUBJECTS } from "@/content";
import { useHidden } from "@/lib/reports";
import { readJson, writeJson } from "@/lib/storage";
import { questionSchema, type Grade, type Question, type Subject, type Unit } from "./model";

/**
 * Soru havuzu = uygulamayla gelen sorular + öğretmenin bu cihazda eklediği sorular − gizlenenler.
 *
 * Uygulamayla gelen sorular ders ve sınıf bazında, gerektiğinde yüklenir. Öğretmen soruları
 * bugün tarayıcıda tutuluyor; hesaplar geldiğinde bu dosyadaki okuma/yazma fonksiyonları bir
 * API'ye bağlanır, oyunlar ve ekranlar değişmez.
 */

// ---- uygulamayla gelen sorular: sınıf bazında önbellek ----
const poolCache = new Map<string, Question[]>();
const pending = new Map<string, Promise<Question[]>>();
const poolListeners = new Set<() => void>();
const poolKey = (subjectId: string, grade: Grade) => `${subjectId}-${grade}`;

export function loadPool(subjectId: string, grade: Grade): Promise<Question[]> {
  const key = poolKey(subjectId, grade);
  const cached = poolCache.get(key);
  if (cached) return Promise.resolve(cached);
  let job = pending.get(key);
  if (!job) {
    job = loadBuiltIn(subjectId, grade).then((questions) => {
      poolCache.set(key, questions);
      poolListeners.forEach((l) => l());
      return questions;
    });
    pending.set(key, job);
  }
  return job;
}

function subscribePools(listener: () => void) {
  poolListeners.add(listener);
  return () => poolListeners.delete(listener);
}

/**
 * Bir sınıfın oynanabilir havuzu. Yüklenirken null döner.
 * `includeHidden`: soru bankası gizlenenleri de gösterir; oyunlar göstermez.
 */
export function useGradePool(subjectId: string, grade: Grade, { includeHidden = false } = {}): Question[] | null {
  const key = poolKey(subjectId, grade);
  const builtIn = useSyncExternalStore(
    subscribePools,
    () => poolCache.get(key) ?? null,
    () => null,
  );
  useEffect(() => {
    void loadPool(subjectId, grade);
  }, [subjectId, grade]);
  const custom = useCustomQuestions();
  const hidden = useHidden();
  return useMemo(() => {
    if (!builtIn) return null;
    const mine = custom.filter((q) => {
      const unit = findUnit(q.unit);
      return unit?.subject.id === subjectId && unit.grade === grade;
    });
    const all = mine.length ? [...builtIn, ...mine] : builtIn;
    if (includeHidden || hidden.length === 0) return all;
    const hide = new Set(hidden);
    return all.filter((q) => !hide.has(q.id));
  }, [builtIn, custom, hidden, includeHidden, subjectId, grade]);
}

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
