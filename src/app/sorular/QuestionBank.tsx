"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Check, Download, Eye, EyeOff, Flag, Pencil, Plus, Search, Trash2, Upload, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ReportDialog } from "@/components/game/ReportDialog";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { Segmented } from "@/components/ui/Segmented";
import { SUBJECTS } from "@/content";
import { DIFFICULTY_LABELS, QUESTION_TYPE_LABELS, type Grade, type Question } from "@/core/model";
import { deleteCustomQuestion, importCustomQuestions, isCustomQuestion, unitsFor, useCustomQuestions, useGradePool } from "@/core/repository";
import { exportReports, removeReport, REPORT_REASONS, setHidden, useHidden, useReports, type Report } from "@/lib/reports";
import { QuestionEditor } from "./QuestionEditor";

const subject = SUBJECTS[0];
const PAGE = 60;

type Filter = "all" | "reported" | "hidden" | "passage" | "cards";

function download(name: string, text: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function QuestionBank() {
  const [grade, setGrade] = useState<Grade>(subject.grades[0]);
  const loaded = useGradePool(subject.id, grade, { includeHidden: true });
  const pool = useMemo(() => loaded ?? [], [loaded]);
  const custom = useCustomQuestions();
  const reports = useReports();
  const hiddenIds = useHidden();
  const [unitId, setUnitId] = useState<string | "all">("all");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [editing, setEditing] = useState<Question | "new" | null>(null);
  const [reporting, setReporting] = useState<Question | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const units = unitsFor(subject, grade);
  const reportById = useMemo(() => new Map(reports.map((r) => [r.questionId, r])), [reports]);
  const hidden = useMemo(() => new Set(hiddenIds), [hiddenIds]);
  const needle = query.trim().toLocaleLowerCase("tr");

  const inUnit = useMemo(() => pool.filter((q) => unitId === "all" || q.unit === unitId), [pool, unitId]);
  const counts = {
    all: inUnit.length,
    reported: inUnit.filter((q) => reportById.has(q.id)).length,
    hidden: inUnit.filter((q) => hidden.has(q.id)).length,
    passage: inUnit.filter((q) => q.type === "passage").length,
    cards: inUnit.filter((q) => q.group).length,
  };
  const list = useMemo(
    () =>
      inUnit.filter((q) => {
        if (filter === "reported" && !reportById.has(q.id)) return false;
        if (filter === "hidden" && !hidden.has(q.id)) return false;
        if (filter === "passage" && q.type !== "passage") return false;
        if (filter === "cards" && !q.group) return false;
        if (!needle) return true;
        const hay = [q.prompt, q.explanation, ...(q.type === "true-false" ? [] : q.choices), ...(q.type === "passage" ? [q.context] : [])]
          .join(" ")
          .toLocaleLowerCase("tr");
        return hay.includes(needle);
      }),
    [inUnit, filter, reportById, hidden, needle],
  );

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

  const stamp = new Date().toISOString().slice(0, 10);

  return (
    <div className="min-h-dvh bg-ink-900">
      <header className="sticky top-0 z-20 flex h-16 items-center gap-4 bg-ink-900/95 px-4 sm:px-8">
        <Link href="/" aria-label="Ana sayfa" className="flex items-center gap-3 rounded-md">
          <ArrowLeft className="size-5 text-ink-400" />
          <Logo className="text-xl" />
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="quiet" icon={<Upload className="size-5" />} onClick={() => fileInput.current?.click()}>
            <span className="hidden md:inline">İçe aktar</span>
          </Button>
          <Button
            variant="quiet"
            icon={<Download className="size-5" />}
            onClick={() => download(`oynabil-sorularim-${stamp}.json`, JSON.stringify(custom, null, 2))}
            disabled={custom.length === 0}
          >
            <span className="hidden md:inline">Sorularımı dışa aktar</span>
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

      <main className="mx-auto max-w-[80rem] px-4 pb-16 sm:px-8">
        <h1 className="mt-4 text-4xl font-bold">Soru bankası</h1>
        <p className="mt-2 max-w-[52rem] text-lg text-ink-300">
          Bütün oyunlar bu havuzdan beslenir. Bilgi kartlarından üretilen sorular, elle yazılan sorular, LGS tarzı paragraf soruları ve sizin
          eklediğiniz sorular burada. Hatalı bir soruyu bildirebilir ya da oyunlarda çıkmaması için gizleyebilirsiniz.
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

        {(reports.length > 0 || hiddenIds.length > 0) && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-mercan/10 px-4 py-3">
            <Flag className="size-5 shrink-0 text-mercan" />
            <p className="min-w-0 flex-1">
              Bu tahtada <span className="tabular font-semibold">{reports.length}</span> hata bildirimi ve{" "}
              <span className="tabular font-semibold">{hiddenIds.length}</span> gizlenen soru var. Düzeltilmeleri için dosyayı içerik ekibine
              gönderin.
            </p>
            <Button icon={<Download className="size-5" />} onClick={() => download(`oynabil-bildirimler-${stamp}.json`, exportReports())}>
              Bildirimleri dışa aktar
            </Button>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <div className="w-[28rem] max-w-full">
            <Segmented
              label="Sınıf"
              value={grade}
              options={subject.grades.map((g) => ({ value: g, label: `${g}. sınıf` }))}
              onChange={(g) => {
                setGrade(g);
                setUnitId("all");
                setLimit(PAGE);
              }}
            />
          </div>
          <label className="flex h-[3.25rem] min-w-[16rem] flex-1 items-center gap-3 rounded-lg bg-ink-950/60 px-4 focus-within:outline focus-within:outline-2 focus-within:outline-firuze">
            <Search className="size-5 text-ink-400" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(PAGE);
              }}
              placeholder="Soru, şık ya da açıklamada ara"
              className="h-full flex-1 bg-transparent outline-none placeholder:text-ink-400"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Üniteler">
          <Chip label="Tüm üniteler" count={pool.length} active={unitId === "all"} onClick={() => setUnitId("all")} />
          {units.map((u) => (
            <Chip
              key={u.id}
              label={`${u.order}. ${u.title}`}
              count={pool.filter((q) => q.unit === u.id).length}
              active={unitId === u.id}
              onClick={() => {
                setUnitId(u.id);
                setLimit(PAGE);
              }}
            />
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Süzgeç">
          {(
            [
              ["all", "Hepsi"],
              ["cards", "Bilgi kartından"],
              ["passage", "Paragraf (LGS)"],
              ["reported", "Bildirilenler"],
              ["hidden", "Gizlenenler"],
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <Chip
              key={key}
              label={label}
              count={counts[key]}
              active={filter === key}
              tone={key === "reported" || key === "hidden" ? "warn" : "plain"}
              onClick={() => {
                setFilter(key);
                setLimit(PAGE);
              }}
            />
          ))}
        </div>

        <p className="mt-6 text-ink-400">{loaded ? <><span className="tabular">{list.length}</span> soru</> : "Sorular yükleniyor…"}</p>
        <ul className="mt-3 flex flex-col gap-3">
          {list.slice(0, limit).map((q) => (
            <QuestionRow
              key={q.id}
              q={q}
              unitTitle={units.find((u) => u.id === q.unit)?.title ?? ""}
              report={reportById.get(q.id)}
              hidden={hidden.has(q.id)}
              onReport={() => setReporting(q)}
              onEdit={isCustomQuestion(q.id) ? () => setEditing(q) : undefined}
              onDelete={isCustomQuestion(q.id) ? () => deleteCustomQuestion(q.id) : undefined}
            />
          ))}
        </ul>
        {list.length > limit && (
          <div className="mt-6 flex justify-center">
            <Button size="lg" onClick={() => setLimit((l) => l + PAGE)}>
              Daha fazla göster ({list.length - limit})
            </Button>
          </div>
        )}
        {loaded && list.length === 0 && <p className="mt-6 text-lg text-ink-300">Bu filtrelerle soru bulunamadı.</p>}
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
        {reporting && (
          <ReportDialog
            key={reporting.id}
            questionId={reporting.id}
            prompt={reporting.prompt}
            onClose={(sent) => {
              setReporting(null);
              if (sent) setNotice("Bildirim kaydedildi. Soruyu oyunlarda çıkmaması için gizleyebilirsiniz.");
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Chip({
  label,
  count,
  active,
  onClick,
  tone = "plain",
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  tone?: "plain" | "warn";
}) {
  const on = tone === "warn" ? "bg-mercan text-ink-950" : "bg-firuze text-ink-950";
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex h-11 items-center gap-2 rounded-full px-4 font-semibold transition-colors duration-(--dur-base) ${
        active ? on : "bg-ink-800 text-ink-300 hover:text-cream"
      }`}
    >
      {label}
      <span className={`tabular text-sm ${active ? "text-ink-950/70" : "text-ink-400"}`}>{count}</span>
    </button>
  );
}

function QuestionRow({
  q,
  unitTitle,
  report,
  hidden,
  onReport,
  onEdit,
  onDelete,
}: {
  q: Question;
  unitTitle: string;
  report?: Report;
  hidden: boolean;
  onReport: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const options =
    q.type === "true-false"
      ? [
          { text: "Doğru", correct: q.answer },
          { text: "Yanlış", correct: !q.answer },
        ]
      : q.choices.map((c, i) => ({ text: c, correct: i === q.answer }));
  return (
    <li className={`rounded-xl bg-ink-850 p-5 shadow-[var(--surface-light)] ${hidden ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-2 text-sm text-ink-400">
        <span>{unitTitle}</span>
        <Tag>{QUESTION_TYPE_LABELS[q.type]}</Tag>
        <Tag>{DIFFICULTY_LABELS[q.difficulty]}</Tag>
        {q.group && <Tag>Bilgi kartından</Tag>}
        {onEdit && <Tag accent>Sizin sorunuz</Tag>}
        {hidden && <Tag warn>Gizli</Tag>}
        <div className="ml-auto flex flex-wrap gap-1">
          {onEdit && (
            <Button variant="quiet" className="!h-9 !px-3" icon={<Pencil className="size-4" />} onClick={onEdit}>
              Düzenle
            </Button>
          )}
          {onDelete &&
            (confirm ? (
              <Button variant="danger" className="!h-9 !px-3" onClick={onDelete}>
                Silinsin mi? Evet
              </Button>
            ) : (
              <Button variant="quiet" className="!h-9 !px-3" icon={<Trash2 className="size-4" />} onClick={() => setConfirm(true)}>
                Sil
              </Button>
            ))}
          {!report && (
            <Button variant="quiet" className="!h-9 !px-3" icon={<Flag className="size-4" />} onClick={onReport}>
              Hata bildir
            </Button>
          )}
          <Button
            variant="quiet"
            className="!h-9 !px-3"
            icon={hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            onClick={() => setHidden(q.id, !hidden)}
          >
            {hidden ? "Göster" : "Gizle"}
          </Button>
        </div>
      </div>
      {report && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-mercan/10 px-4 py-2 text-mercan">
          <Flag className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 font-semibold">
            {REPORT_REASONS[report.reason]}
            {report.note && <span className="font-normal text-cream-dim">: {report.note}</span>}
          </span>
          <button type="button" className="rounded-md px-2 py-1 text-sm font-semibold hover:bg-mercan/20" onClick={() => removeReport(q.id)}>
            Bildirimi kaldır
          </button>
        </div>
      )}
      {q.type === "passage" && <p className="mt-3 rounded-lg bg-ink-900/60 p-4 leading-relaxed text-cream-dim">{q.context}</p>}
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

function Tag({ children, accent = false, warn = false }: { children: React.ReactNode; accent?: boolean; warn?: boolean }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 ${warn ? "bg-mercan/15 text-mercan" : accent ? "bg-kehribar/15 text-kehribar" : "bg-ink-800"}`}>{children}</span>
  );
}
