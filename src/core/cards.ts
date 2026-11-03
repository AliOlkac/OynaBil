import { z } from "zod";
import { difficultySchema, idSchema, questionSchema, type Question } from "./model";
import { createRng, shuffle } from "./random";

/**
 * Bilgi kartları: soruyu tek tek yazmak yerine dersin bilgileri bir kez yazılır,
 * sorular buradan kodla üretilir. Öğretmen 5 soruyu değil 1 kartı kontrol eder;
 * kart doğruysa ondan çıkan her soru da doğrudur.
 *
 * İki kart kümesi türü var:
 *
 * - **pairs (eşleşme):** Aynı ilişkideki öğeler, ör. kitap -> peygamber. Her öğe alanlardan
 *   oluşur ({ id, kitap, peygamber, peygambereYonelme }). Soru kalıpları alan adlarıyla yazılır:
 *   "{kitap} hangi peygambere indirilmiştir?" cevap alanı "peygamber". Yanlış şıklar aynı kümedeki
 *   öteki öğelerin aynı alanından gelir. Doğru/yanlış ifadesi, bir alanı başka öğeninkiyle
 *   değiştirerek yanlışa çevrilir.
 *
 * - **list (üyelik):** Bir başlığa ait olanlar ve olmayanlar, ör. namazın farzları.
 *   "Hangisi ... biridir?" ve "Hangisi ... biri değildir?" soruları ile doğru/yanlış ifadeleri üretir.
 *
 * Türkçe ekler otomatik çekilmez: kalıbın ihtiyaç duyduğu çekimli biçim öğeye ayrı alan olarak yazılır
 * ("Hz. Musa'ya"). Böylece dil bilgisi hep doğru kalır.
 */

const fieldsSchema = z.record(z.string(), z.string());

export const pairSetSchema = z.object({
  kind: z.literal("pairs"),
  /** Ünite kimliğiyle başlar, ör. "dkab-6-1-kitaplar". */
  id: idSchema,
  unit: idSchema,
  difficulty: difficultySchema,
  /** Çoktan seçmeli soru kalıpları: kök ve doğru cevabın alanı. */
  questions: z.array(z.object({ prompt: z.string().min(5), answer: z.string() })).min(1).max(3),
  /**
   * Doğru/yanlış ifadesi. Yanlış sürümde `swap` alanı başka bir öğeninkiyle değiştirilir.
   * Değişen alan bir öğede aynı kalıyorsa (iki öğe aynı değeri taşıyorsa) o eşleşme atlanır.
   */
  statement: z.object({ text: z.string().min(5), swap: z.string() }).optional(),
  /** Cevaptan sonra gösterilen açıklama kalıbı; öğenin `not` alanı varsa sonuna eklenir. */
  explanation: z.string().min(5),
  items: z.array(z.object({ id: idSchema }).and(fieldsSchema)).min(3),
  /** Alan bazında ek yanlış şıklar (kümede yeterli öğe yoksa ya da daha iyi çeldirici için). */
  distractors: z.record(z.string(), z.array(z.string())).optional(),
});

export const listSetSchema = z.object({
  kind: z.literal("list"),
  id: idSchema,
  unit: idSchema,
  difficulty: difficultySchema,
  /** "Aşağıdakilerden hangisi namazın farzlarından biridir?" */
  positive: z.string().min(5),
  /** "Aşağıdakilerden hangisi namazın farzlarından biri değildir?" */
  negative: z.string().min(5).optional(),
  /** "{item}, namazın farzlarındandır." Üyeler için doğru, üye olmayanlar için yanlış ifade. */
  statement: z.string().min(5).optional(),
  /** Açıklama kalıbı. {members} üyeleri virgülle sıralar, {item} sorulan öğedir. */
  explanation: z.string().min(5),
  members: z.array(z.string().min(1)).min(3),
  nonMembers: z.array(z.string().min(1)).min(3),
});

export const cardSetSchema = z.discriminatedUnion("kind", [pairSetSchema, listSetSchema]);
export type CardSet = z.infer<typeof cardSetSchema>;
export type PairSet = z.infer<typeof pairSetSchema>;
export type ListSet = z.infer<typeof listSetSchema>;

/** Kalıptaki {alan} yerlerini doldurur. Eksik alan bir yazım hatasıdır ve hata fırlatır. */
export function fill(template: string, fields: Record<string, string>): string {
  return template.replace(/\{([^}]+)\}/g, (_, key: string) => {
    if (!(key in fields)) throw new Error(`Kalıpta bilinmeyen alan: {${key}} (${template})`);
    return fields[key];
  });
}

/** Kimlikten türetilen sabit tohum: aynı kart her derlemede aynı soruları ve şıkları üretir. */
export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const norm = (s: string) => s.trim().toLocaleLowerCase("tr");

function pickDistractors(correct: string, pool: string[], count: number, seedKey: string): string[] {
  const seen = new Set([norm(correct)]);
  const unique: string[] = [];
  for (const p of pool) {
    const n = norm(p);
    if (!seen.has(n)) {
      seen.add(n);
      unique.push(p);
    }
  }
  return shuffle(unique, createRng(hashSeed(seedKey))).slice(0, count);
}

function withNote(text: string, item: Record<string, string>): string {
  return item.not ? `${text} ${item.not}` : text;
}

function fromPairs(set: PairSet): Question[] {
  const out: Question[] = [];
  const tfDifficulty = Math.max(1, set.difficulty - 1) as Question["difficulty"];
  set.items.forEach((item, index) => {
    const group = `${set.id}-${item.id}`;
    const explanation = withNote(fill(set.explanation, item), item);

    set.questions.forEach((template, qi) => {
      const correct = item[template.answer];
      if (correct === undefined) throw new Error(`${set.id}: "${template.answer}" alanı ${item.id} öğesinde yok`);
      const pool = [...set.items.filter((o) => o !== item).map((o) => o[template.answer]), ...(set.distractors?.[template.answer] ?? [])];
      const id = `${group}-s${qi + 1}`;
      const wrong = pickDistractors(correct, pool, 3, id);
      if (wrong.length === 0) throw new Error(`${id}: yanlış şık bulunamadı`);
      out.push({
        id,
        unit: set.unit,
        type: "multiple-choice",
        difficulty: set.difficulty,
        prompt: fill(template.prompt, item),
        choices: [correct, ...wrong],
        answer: 0,
        explanation,
        group,
      });
    });

    if (set.statement) {
      const { text, swap } = set.statement;
      out.push({ id: `${group}-d`, unit: set.unit, type: "true-false", difficulty: tfDifficulty, prompt: fill(text, item), answer: true, explanation, group });
      // Yanlış ifade: bir sonraki öğeden başlayarak, değeri farklı ilk öğenin alanıyla değiştirilir.
      for (let step = 1; step < set.items.length; step++) {
        const other = set.items[(index + step) % set.items.length];
        if (norm(other[swap] ?? "") === norm(item[swap] ?? "")) continue;
        out.push({
          id: `${group}-y`,
          unit: set.unit,
          type: "true-false",
          difficulty: tfDifficulty,
          prompt: fill(text, { ...item, [swap]: other[swap] }),
          answer: false,
          explanation,
          group,
        });
        break;
      }
    }
  });
  return out;
}

function fromList(set: ListSet): Question[] {
  const out: Question[] = [];
  const tfDifficulty = Math.max(1, set.difficulty - 1) as Question["difficulty"];
  const members = set.members.join(", ");
  set.members.forEach((member, i) => {
    const group = `${set.id}-u${i + 1}`;
    const explanation = fill(set.explanation, { members, item: member });
    const id = `${group}-p`;
    out.push({
      id,
      unit: set.unit,
      type: "multiple-choice",
      difficulty: set.difficulty,
      prompt: set.positive,
      choices: [member, ...pickDistractors(member, set.nonMembers, 3, id)],
      answer: 0,
      explanation,
      group,
    });
    if (set.statement) {
      out.push({ id: `${group}-d`, unit: set.unit, type: "true-false", difficulty: tfDifficulty, prompt: fill(set.statement, { item: member }), answer: true, explanation, group });
    }
  });
  set.nonMembers.forEach((outsider, i) => {
    const group = `${set.id}-x${i + 1}`;
    const explanation = fill(set.explanation, { members, item: outsider });
    if (set.negative) {
      const id = `${group}-n`;
      out.push({
        id,
        unit: set.unit,
        type: "multiple-choice",
        difficulty: set.difficulty,
        prompt: set.negative,
        choices: [outsider, ...pickDistractors(outsider, set.members, 3, id)],
        answer: 0,
        explanation,
        group,
      });
    }
    if (set.statement) {
      out.push({ id: `${group}-y`, unit: set.unit, type: "true-false", difficulty: tfDifficulty, prompt: fill(set.statement, { item: outsider }), answer: false, explanation, group });
    }
  });
  return out;
}

/** Kart kümelerinden soruları üretir. Her soru, elle yazılan sorularla aynı şemadan geçer. */
export function questionsFromCards(sets: readonly CardSet[]): Question[] {
  return sets.flatMap((set) => (set.kind === "pairs" ? fromPairs(set) : fromList(set))).map((q) => questionSchema.parse(q));
}
