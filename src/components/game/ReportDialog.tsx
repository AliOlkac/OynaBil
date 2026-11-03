"use client";

import { motion } from "motion/react";
import { Flag } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { dur, spring } from "@/lib/motion";
import { addReport, REPORT_REASONS, type ReportReason } from "@/lib/reports";

/**
 * "Bu soruda hata var" penceresi. Oyunda açıklama ekranından, oyun sonundan ve soru bankasından açılır.
 * Bildirim bu tahtada saklanır; soru bankasında listelenir ve dışa aktarılır.
 */
export function ReportDialog({ questionId, prompt, onClose }: { questionId: string; prompt: string; onClose: (sent: boolean) => void }) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");

  const send = () => {
    if (!reason) return;
    addReport({ questionId, prompt, reason, note: note.trim() || undefined, at: Date.now() });
    onClose(true);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center bg-ink-950/80 p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: dur.fast }}
      onClick={() => onClose(false)}
    >
      <motion.div
        role="dialog"
        aria-modal
        aria-labelledby="report-title"
        className="w-full max-w-2xl rounded-xl bg-ink-800 p-8 shadow-[var(--surface-light),var(--surface-drop)]"
        initial={{ y: 16, scale: 0.98 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 8, scale: 0.98 }}
        transition={spring.ui}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="report-title" className="flex items-center gap-3 text-2xl font-bold">
          <Flag className="size-6 text-mercan" /> Bu soruda hata mı var?
        </h2>
        <p className="mt-2 line-clamp-2 text-ink-300">{prompt}</p>

        <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Hatanın türü">
          {(Object.keys(REPORT_REASONS) as ReportReason[]).map((key) => {
            const on = reason === key;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setReason(key)}
                className={`rounded-lg px-4 py-3 text-left text-lg font-semibold transition-colors duration-(--dur-base) ${
                  on ? "bg-mercan text-ink-950" : "bg-ink-900/70 text-cream hover:bg-ink-700"
                }`}
              >
                {REPORT_REASONS[key]}
              </button>
            );
          })}
        </div>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={300}
          placeholder="Kısa not (isteğe bağlı): doğrusu ne olmalı?"
          className="mt-4 w-full resize-none rounded-lg bg-ink-950/60 p-4 text-lg outline-none placeholder:text-ink-400 focus-visible:outline-2 focus-visible:outline-firuze"
        />

        <div className="mt-6 flex justify-end gap-3">
          <Button size="lg" variant="quiet" onClick={() => onClose(false)}>
            Vazgeç
          </Button>
          <Button size="lg" variant="danger" disabled={!reason} onClick={send} icon={<Flag className="size-5" />}>
            Bildir
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
