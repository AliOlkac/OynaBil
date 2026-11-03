"use client";

import { createLocalStore } from "./store";

/**
 * Hata bildirimleri ve gizlenen sorular.
 *
 * Öğretmen oyunda ya da soru bankasında şüpheli bir soruyu bir dokunuşla bildirir. Bildirimler bu
 * tahtada saklanır, soru bankasında listelenir ve dosya olarak dışa aktarılıp içerik ekibine gönderilir.
 * Gizlenen sorular oyunlara hiç gelmez. Sunucu geldiğinde bildirimler oraya gider.
 */

export const REPORT_REASONS = {
  "cevap-yanlis": "Doğru cevap yanlış işaretlenmiş",
  "birden-fazla": "Birden fazla doğru şık var",
  "bilgi-hatasi": "Bilgi hatası",
  yazim: "Yazım ya da anlatım hatası",
  mufredat: "Müfredata uygun değil",
  diger: "Diğer",
} as const;

export type ReportReason = keyof typeof REPORT_REASONS;

export type Report = {
  questionId: string;
  prompt: string;
  reason: ReportReason;
  note?: string;
  at: number;
};

const reports = createLocalStore<Report[]>("oynabil.hata-bildirimleri.v1", []);
const hidden = createLocalStore<string[]>("oynabil.gizlenen-sorular.v1", []);

export const useReports = reports.use;
export const useHidden = hidden.use;
export const getHidden = hidden.get;

export function addReport(report: Report) {
  reports.update((list) => [...list.filter((r) => r.questionId !== report.questionId), report]);
}

export function removeReport(questionId: string) {
  reports.update((list) => list.filter((r) => r.questionId !== questionId));
}

export function setHidden(questionId: string, hide: boolean) {
  hidden.update((list) => (hide ? [...new Set([...list, questionId])] : list.filter((id) => id !== questionId)));
}

export function exportReports(): string {
  return JSON.stringify({ uygulama: "OynaBil", tarih: new Date().toISOString(), bildirimler: reports.get(), gizlenenler: hidden.get() }, null, 2);
}
