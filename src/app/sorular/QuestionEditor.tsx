"use client";

import { motion } from "motion/react";
import { Check, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { questionSchema, type Difficulty, type Grade, type Question, type QuestionType, type Subject } from "@/core/model";
import { newCustomQuestionId, unitsFor, upsertCustomQuestion } from "@/core/repository";
import { dur, spring } from "@/lib/motion";

const LETTERS = ["A", "B", "C", "D"];

/** Öğretmenin kendi sorusunu yazdığı panel. Kaydetmeden önce yerleşik sorularla aynı kurallardan geçer. */
export function QuestionEditor({
  subject,
  initialGrade,
  initialUnit,
  question,
  onClose,
}: {
  subject: Subject;
  initialGrade: Grade;
  initialUnit: string;
  question: Question | null;
  onClose: (saved: boolean) => void;
}) {
  const startGrade = question ? (subject.units.find((u) => u.id === question.unit)?.grade ?? initialGrade) : initialGrade;
  const [grade, setGrade] = useState<Grade>(startGrade);
  const [unit, setUnit] = useState(question?.unit ?? initialUnit);
  const [type, setType] = useState<QuestionType>(question?.type ?? "multiple-choice");
  const [difficulty, setDifficulty] = useState<Difficulty>(question?.difficulty ?? 2);
  const [prompt, setPrompt] = useState(question?.prompt ?? "");
  const [choices, setChoices] = useState<string[]>(question?.type === "multiple-choice" ? [...question.choices, "", "", ""].slice(0, 4) : ["", "", "", ""]);
  const [answerIndex, setAnswerIndex] = useState(question?.type === "multiple-choice" ? question.answer : 0);
  const [answerBool, setAnswerBool] = useState(question?.type === "true-false" ? question.answer : true);
  const [explanation, setExplanation] = useState(question?.explanation ?? "");
  const [error, setError] = useState<string | null>(null);

  const units = unitsFor(subject, grade);

  const save = () => {
    const id = question?.id ?? newCustomQuestionId(unit);
    let candidate: unknown;
    if (type === "multiple-choice") {
      const filled = choices.map((c, i) => ({ c: c.trim(), i })).filter((x) => x.c);
      const answer = filled.findIndex((x) => x.i === answerIndex);
      if (answer === -1) return setError("Doğru cevap olarak işaretlenen şık boş olamaz.");
      candidate = { id, unit, type, difficulty, prompt: prompt.trim(), explanation: explanation.trim(), choices: filled.map((x) => x.c), answer };
    } else {
      candidate = { id, unit, type, difficulty, prompt: prompt.trim(), explanation: explanation.trim(), answer: answerBool };
    }
    const parsed = questionSchema.safeParse(candidate);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = String(issue.path[0] ?? "");
      const messages: Record<string, string> = {
        prompt: "Soru metni 5 ile 220 karakter arasında olmalı.",
        explanation: "Açıklama 5 ile 320 karakter arasında olmalı. Cevaptan sonra tahtada gösterilir.",
        choices: "En az iki dolu şık gerekli.",
      };
      return setError(messages[field] ?? issue.message);
    }
    upsertCustomQuestion(parsed.data);
    onClose(true);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex justify-end bg-ink-950/70"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: dur.fast }}
      onClick={() => onClose(false)}
    >
      <motion.aside
        role="dialog"
        aria-modal
        aria-labelledby="editor-title"
        className="flex h-full w-full max-w-[44rem] flex-col bg-ink-850 shadow-[var(--surface-drop)]"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={spring.ui}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-4 px-8 pt-6">
          <h2 id="editor-title" className="text-2xl font-bold">
            {question ? "Soruyu düzenle" : "Yeni soru"}
          </h2>
          <button type="button" aria-label="Kapat" onClick={() => onClose(false)} className="ml-auto rounded-md p-2 text-ink-400 hover:bg-ink-800 hover:text-cream">
            <X className="size-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          <Field label="Sınıf">
            <Segmented
              label="Sınıf"
              value={grade}
              options={subject.grades.map((g) => ({ value: g, label: `${g}. sınıf` }))}
              onChange={(g) => {
                setGrade(g);
                setUnit(unitsFor(subject, g)[0].id);
              }}
            />
          </Field>
          <Field label="Ünite">
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="h-12 w-full rounded-lg bg-ink-950/60 px-4 text-lg outline-none focus-visible:outline-2 focus-visible:outline-firuze"
            >
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.order}. {u.title}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Soru tipi">
              <Segmented
                label="Soru tipi"
                value={type}
                options={[
                  { value: "multiple-choice", label: "Çoktan seçmeli" },
                  { value: "true-false", label: "Doğru/Yanlış" },
                ]}
                onChange={setType}
              />
            </Field>
            <Field label="Zorluk">
              <Segmented
                label="Zorluk"
                value={difficulty}
                options={[
                  { value: 1, label: "Kolay" },
                  { value: 2, label: "Orta" },
                  { value: 3, label: "Zor" },
                ]}
                onChange={(d) => setDifficulty(d as Difficulty)}
              />
            </Field>
          </div>

          <Field label={type === "true-false" ? "İfade" : "Soru"} hint={`${prompt.length}/220`}>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              maxLength={220}
              placeholder={type === "true-false" ? "Ör. Zekât, zengin olan Müslümanın vermesi gereken bir ibadettir." : "Ör. Hicret hangi şehre yapılmıştır?"}
              className="w-full resize-none rounded-lg bg-ink-950/60 p-4 text-lg outline-none placeholder:text-ink-400 focus-visible:outline-2 focus-visible:outline-firuze"
            />
          </Field>

          {type === "multiple-choice" ? (
            <Field label="Şıklar" hint="Doğru cevabın yanındaki daireye dokunun. Şıklar oyunda karıştırılır.">
              <div className="flex flex-col gap-2">
                {choices.map((c, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={answerIndex === i}
                      aria-label={`${LETTERS[i]} şıkkı doğru cevap`}
                      onClick={() => setAnswerIndex(i)}
                      className={`grid size-11 shrink-0 place-items-center rounded-full font-bold transition-colors ${
                        answerIndex === i ? "bg-zumrut text-ink-950" : "bg-ink-800 text-ink-400 hover:text-cream"
                      }`}
                    >
                      {answerIndex === i ? <Check className="size-5" strokeWidth={3} /> : LETTERS[i]}
                    </button>
                    <input
                      value={c}
                      maxLength={80}
                      onChange={(e) => setChoices((list) => list.map((x, j) => (j === i ? e.target.value : x)))}
                      placeholder={i < 2 ? `${LETTERS[i]} şıkkı` : `${LETTERS[i]} şıkkı (isteğe bağlı)`}
                      className="h-12 flex-1 rounded-lg bg-ink-950/60 px-4 text-lg outline-none placeholder:text-ink-400 focus-visible:outline-2 focus-visible:outline-firuze"
                    />
                  </div>
                ))}
              </div>
            </Field>
          ) : (
            <Field label="Doğru cevap">
              <Segmented
                label="Doğru cevap"
                value={answerBool ? "dogru" : "yanlis"}
                options={[
                  { value: "dogru", label: "Doğru" },
                  { value: "yanlis", label: "Yanlış" },
                ]}
                onChange={(v) => setAnswerBool(v === "dogru")}
              />
            </Field>
          )}

          <Field label="Açıklama" hint="Cevaptan sonra tahtada gösterilir. Neden doğru olduğunu bir iki cümleyle yazın.">
            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              rows={3}
              maxLength={320}
              className="w-full resize-none rounded-lg bg-ink-950/60 p-4 text-lg outline-none focus-visible:outline-2 focus-visible:outline-firuze"
            />
          </Field>
        </div>

        <div className="flex items-center gap-4 bg-ink-950/50 px-8 py-4">
          <p className="flex-1 text-kehribar" role="alert">
            {error}
          </p>
          <Button size="lg" variant="quiet" onClick={() => onClose(false)}>
            Vazgeç
          </Button>
          <Button size="lg" variant="primary" onClick={save}>
            Kaydet
          </Button>
        </div>
      </motion.aside>
    </motion.div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <span className="font-semibold">{label}</span>
        {hint && <span className="text-right text-sm text-ink-400">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
