import type { Question, QuestionType } from "./model";
import { createRng, shuffle } from "./random";

/**
 * Oyunların gördüğü tek soru biçimi. Doğru/Yanlış soruları da iki şıklı
 * bir soruya dönüştürülür; böylece her oyun tek bir şekli çizer.
 */
export type PlayableQuestion = {
  id: string;
  unit: string;
  type: QuestionType;
  difficulty: Question["difficulty"];
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

export function toPlayable(q: Question, rng: () => number): PlayableQuestion {
  if (q.type === "true-false") {
    return {
      id: q.id,
      unit: q.unit,
      type: q.type,
      difficulty: q.difficulty,
      prompt: q.prompt,
      options: ["Doğru", "Yanlış"],
      correctIndex: q.answer ? 0 : 1,
      explanation: q.explanation,
    };
  }
  const order = q.keepOrder ? q.choices.map((_, i) => i) : shuffle(q.choices.map((_, i) => i), rng);
  return {
    id: q.id,
    unit: q.unit,
    type: q.type,
    difficulty: q.difficulty,
    prompt: q.prompt,
    options: order.map((i) => q.choices[i]),
    correctIndex: order.indexOf(q.answer),
    explanation: q.explanation,
  };
}

export type DeckOptions = {
  unitIds: readonly string[];
  types: readonly QuestionType[];
  seed: number;
};

/**
 * Seçilen ünitelerden, oyunun desteklediği tiplerde karışık bir deste kurar.
 * Üniteler sırayla harmanlanır ki tek bir ünite destenin başını doldurmasın;
 * zorluk her turda kolaydan zora doğru hafifçe artar.
 */
export function buildDeck(pool: readonly Question[], options: DeckOptions): PlayableQuestion[] {
  const rng = createRng(options.seed);
  const units = new Set(options.unitIds);
  const types = new Set(options.types);
  const eligible = pool.filter((q) => units.has(q.unit) && types.has(q.type));

  const byUnit = new Map<string, Question[]>();
  for (const q of shuffle(eligible, rng)) {
    const list = byUnit.get(q.unit) ?? [];
    list.push(q);
    byUnit.set(q.unit, list);
  }
  for (const list of byUnit.values()) list.sort((a, b) => a.difficulty - b.difficulty);

  const queues = shuffle([...byUnit.values()], rng);
  const ordered: Question[] = [];
  while (queues.some((qs) => qs.length > 0)) {
    for (const qs of queues) {
      const next = qs.shift();
      if (next) ordered.push(next);
    }
  }
  return ordered.map((q) => toPlayable(q, rng));
}

/** Seçilen ünitelerde bir oyunun kullanabileceği soru sayısı. */
export function countEligible(
  pool: readonly Question[],
  unitIds: readonly string[],
  types: readonly QuestionType[],
): number {
  const units = new Set(unitIds);
  const t = new Set(types);
  return pool.filter((q) => units.has(q.unit) && t.has(q.type)).length;
}
