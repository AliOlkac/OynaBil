import { hashSeed } from "./cards";
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
  /** Paragraf sorularında soru kökünden önce okunan metin. */
  context?: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

/** Şık sırası soru kimliği ve oyun tohumundan türetilir: sayfa yenilense de aynı kalır. */
export function toPlayable(q: Question, seed: number): PlayableQuestion {
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
  const rng = createRng(hashSeed(q.id) ^ seed);
  const order = q.keepOrder ? q.choices.map((_, i) => i) : shuffle(q.choices.map((_, i) => i), rng);
  return {
    id: q.id,
    unit: q.unit,
    type: q.type,
    difficulty: q.difficulty,
    context: q.type === "passage" ? q.context : undefined,
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
  /** Bu sınıfa daha önce sorulan sorular: kimlik -> son sorulma anı. */
  seen?: Readonly<Record<string, number>>;
};

/**
 * Seçilen ünitelerden, oyunun desteklediği tiplerde bir deste sırası kurar ve soru kimliklerini döner.
 *
 * - Daha önce sorulmamış sorular önce gelir; sorulmuş olanlar en eski sorulandan başlayarak sona dizilir.
 * - Üniteler sırayla harmanlanır ki tek bir ünite destenin başını doldurmasın.
 * - Her ünitede yeni sorular kolaydan zora doğru ilerler.
 * - Aynı bilgiyi soran sorular (aynı `group`) bir oyunda yan yana gelmez: ikincisi destenin sonuna kalır.
 */
export function buildDeckIds(pool: readonly Question[], options: DeckOptions): string[] {
  const rng = createRng(options.seed);
  const units = new Set(options.unitIds);
  const types = new Set(options.types);
  const seen = options.seen ?? {};
  const eligible = pool.filter((q) => units.has(q.unit) && types.has(q.type));

  const byUnit = new Map<string, Question[]>();
  for (const q of shuffle(eligible, rng)) {
    const list = byUnit.get(q.unit) ?? [];
    list.push(q);
    byUnit.set(q.unit, list);
  }
  const queues = shuffle([...byUnit.values()], rng).map((list) => {
    const fresh = list.filter((q) => !seen[q.id]).sort((a, b) => a.difficulty - b.difficulty);
    const old = list.filter((q) => seen[q.id]).sort((a, b) => seen[a.id] - seen[b.id]);
    return [...fresh, ...old];
  });

  const primary: Question[] = [];
  const later: Question[] = [];
  const usedGroups = new Set<string>();
  while (queues.some((qs) => qs.length > 0)) {
    for (const qs of queues) {
      const next = qs.shift();
      if (!next) continue;
      if (next.group && usedGroups.has(next.group)) later.push(next);
      else {
        if (next.group) usedGroups.add(next.group);
        primary.push(next);
      }
    }
  }
  return [...primary, ...later].map((q) => q.id);
}

/** Kayıtlı deste sırasından oynanabilir sorular. Havuzdan silinmiş bir soru atlanır. */
export function deckFromIds(pool: readonly Question[], ids: readonly string[], seed: number): PlayableQuestion[] {
  const byId = new Map(pool.map((q) => [q.id, q]));
  return ids.flatMap((id) => {
    const q = byId.get(id);
    return q ? [toPlayable(q, seed)] : [];
  });
}

/** Seçilen ünitelerde bir oyunun kullanabileceği soru sayısı. */
export function countEligible(pool: readonly Question[], unitIds: readonly string[], types: readonly QuestionType[]): number {
  const units = new Set(unitIds);
  const t = new Set(types);
  return pool.filter((q) => units.has(q.unit) && t.has(q.type)).length;
}
