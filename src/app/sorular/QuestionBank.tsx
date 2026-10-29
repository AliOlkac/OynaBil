"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Check, Download, Pencil, Plus, Search, Trash2, Upload, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { Segmented } from "@/components/ui/Segmented";
import { SUBJECTS } from "@/content";
import { DIFFICULTY_LABELS, QUESTION_TYPE_LABELS, type Grade, type Question } from "@/core/model";
import {
  deleteCustomQuestion,
  importCustomQuestions,
  isCustomQuestion,
  unitsFor,
  useCustomQuestions,
  useQuestionPool,
} from "@/core/repository";
import { QuestionEditor } from "./QuestionEditor";

const subject = SUBJECTS[0];

export function QuestionBank() {
  const pool = useQuestionPool();
  const custom = useCustomQuestions();
  const [grade, setGrade] = useState<Grade>(subject.grades[0]);
  const [unitId, setUnitId] = useState<string | "all">("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Question | "new" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const units = unitsFor(subject, grade);
  const unitIds = new Set(units.map((u) => u.id));
  const needle = query.trim().toLocaleLowerCase("tr");
  const list = useMemo(
    () =>
      pool.filter((q) => {
        if (!unitIds.has(q.unit)) return false;
        if (unitId !== "all" && q.unit !== unitId) return false;
        if (!needle) return true;
        const hay = [q.prompt, q.explanation, ...(q.type === "multiple-choice" ? q.choices : [])].join(" ").toLocaleLowerCase("tr");
        return hay.includes(needle);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pool, grade, unitId, needle],
  );

  const exportCustom = () => {
    const blob = new Blob([JSON.stringify(custom, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `oynabil-sorularim-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFile = async (file: File) => {
    try {
      const data: unknown = JSON.parse(await file.text());
      const items = Array.isArray(data) ? data : [];
      const { added, skipped } = importCustomQuestions(items);
      setNotice(`${added} soru eklendi${skipped ? `, ${skipped} kayıt geçersiz olduğu için atlandı` : ""}.`);
    } catch {
      setNotice("Dosya okunamadı. OynaBil'den dışa aktarılmış bir JSON dosyası seçin.");
    }
  };

  return (
    <div className="min-h-dvh bg-ink-900">
      <header className="sticky top-0 z-20 flex h-16 items-center gap-4 bg-ink-900/95 px-8">
        <Link href="/" aria-label="Ana sayfa" className="flex items-center gap-3 rounded-md">
          <ArrowLeft className="size-5 text-ink-400" />
          <Logo className="text-xl" />
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="quiet" icon={<Upload className="size-5" />} onClick={() => fileInput.current?.click()}>
            İçe aktar
          </Button>
          <Button variant="quiet" icon={<Download className="size-5" />} onClick={exportCustom} disabled={custom.length === 0}>
            Sorularımı dışa aktar
          </Button>
          <Button variant="primary" icon={<Plus className="size-5" />} onClick={() => setEditing("new")}>
            Soru ekle
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importFile(f);
              e.target.value = "";
            }}
          />
        </div>
      </header>

      <main className="mx-auto max-w-[80rem] px-8 pb-16">
        <h1 className="mt-4 text-4xl font-bold">Soru bankası</h1>
        <p className="mt-2 max-w-[48rem] text-lg text-ink-300">
          Bütün oyunlar bu havuzdan beslenir. Eklediğiniz sorular bu cihazda saklanır ve oyunlarda hemen kullanılır; başka bir
          tahtaya taşımak için dışa aktarıp orada içe aktarın.
        </p>
        <p className="mt-2 text-sm text-ink-400">{subject.curriculumNote}</p>

        <AnimatePresence>
          {notice && (
            <motion.p
              className="mt-4 flex items-center gap-3 rounded-lg bg-ink-800 px-4 py-3"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <Check className="size-5 text-zumrut" />
              <span className="flex-1">{notice}</span>
              <button type="button" aria-label="Kapat" onClick={() => setNotice(null)} className="rounded-md p-1 text-ink-400 hover:text-cream">
                <X className="size-5" />
              </button>
            </motion.p>
          )}
        </AnimatePresence>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <div className="w-[28rem] max-w-full">
            <Segmented
              label="Sınıf"
              value={grade}
              options={subject.grades.map((g) => ({ value: g, label: `${g}. sınıf` }))}
              onChange={(g) => {
                setGrade(g);
                setUnitId("all");
              }}
            />
          </div>
          <label className="flex h-[3.25rem] min-w-[16rem] flex-1 items-center gap-3 rounded-lg bg-ink-950/60 px-4 focus-within:outline focus-within:outline-2 focus-within:outline-firuze">
            <Search className="size-5 text-ink-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Soru, şık ya da açıklamada ara"
              className="h-full flex-1 bg-transparent outline-none placeholder:text-ink-400"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Üniteler">
          <UnitChip label="Tüm üniteler" count={pool.filter((q) => unitIds.has(q.unit)).length} active={unitId === "all"} onClick={() => setUnitId("all")} />
          {units.map((u) => (
            <UnitChip
              key={u.id}
              label={`${u.order}. ${u.title}`}
              count={pool.filter((q) => q.unit === u.id).length}
              active={unitId === u.id}
              onClick={() => setUnitId(u.id)}
            />
          ))}
        </div>

        <p className="mt-6 text-ink-400">
          <span className="tabular">{list.length}</span> soru
        </p>
        <ul className="mt-3 flex flex-col gap-3">
          {list.map((q) => (
            <QuestionRow
              key={q.id}
              q={q}
              unitTitle={units.find((u) => u.id === q.unit)?.title ?? ""}
              onEdit={isCustomQuestion(q.id) ? () => setEditing(q) : undefined}
              onDelete={isCustomQuestion(q.id) ? () => deleteCustomQuestion(q.id) : undefined}
            />
          ))}
        </ul>
        {list.length === 0 && <p className="mt-6 text-lg text-ink-300">Bu filtrelerle soru bulunamadı.</p>}
      </main>

      <AnimatePresence>
        {editing && (
          <QuestionEditor
            key={editing === "new" ? "new" : editing.id}
            subject={subject}
            initialGrade={grade}
            initialUnit={unitId === "all" ? units[0].id : unitId}
            question={editing === "new" ? null : editing}
            onClose={(saved) => {
              setEditing(null);
              if (saved) setNotice("Soru kaydedildi. Oyunlarda hemen kullanılabilir.");
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function UnitChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex h-11 items-center gap-2 rounded-full px-4 font-semibold transition-colors duration-(--dur-base) ${
        active ? "bg-firuze text-ink-950" : "bg-ink-800 text-ink-300 hover:text-cream"
      }`}
    >
      {label}
      <span className={`tabular text-sm ${active ? "text-ink-950/70" : "text-ink-400"}`}>{count}</span>
    </button>
  );
}

function QuestionRow({ q, unitTitle, onEdit, onDelete }: { q: Question; unitTitle: string; onEdit?: () => void; onDelete?: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const options = q.type === "multiple-choice" ? q.choices.map((c, i) => ({ text: c, correct: i === q.answer })) : [
    { text: "Doğru", correct: q.answer },
    { text: "Yanlış", correct: !q.answer },
  ];
  return (
    <li className="rounded-xl bg-ink-850 p-5 shadow-[var(--surface-light)]">
      <div className="flex flex-wrap items-center gap-2 text-sm text-ink-400">
        <span>{unitTitle}</span>
        <Tag>{QUESTION_TYPE_LABELS[q.type]}</Tag>
        <Tag>{DIFFICULTY_LABELS[q.difficulty]}</Tag>
        {onEdit && <Tag accent>Sizin sorunuz</Tag>}
        {onEdit && (
          <div className="ml-auto flex gap-1">
            <Button variant="quiet" className="!h-9 !px-3" icon={<Pencil className="size-4" />} onClick={onEdit}>
              Düzenle
            </Button>
            {confirm ? (
              <Button variant="danger" className="!h-9 !px-3" onClick={onDelete}>
                Silinsin mi? Evet
              </Button>
            ) : (
              <Button variant="quiet" className="!h-9 !px-3" icon={<Trash2 className="size-4" />} onClick={() => setConfirm(true)}>
                Sil
              </Button>
            )}
          </div>
        )}
      </div>
      <p className="mt-2 text-xl font-semibold">{q.prompt}</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {options.map((o) => (
          <li
            key={o.text}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 ${o.correct ? "bg-zumrut/15 text-zumrut" : "bg-ink-800 text-ink-300"}`}
          >
            {o.correct && <Check className="size-4" strokeWidth={3} />}
            {o.text}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-ink-300">{q.explanation}</p>
    </li>
  );
}

function Tag({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return <span className={`rounded-full px-2.5 py-0.5 ${accent ? "bg-kehribar/15 text-kehribar" : "bg-ink-800"}`}>{children}</span>;
}
