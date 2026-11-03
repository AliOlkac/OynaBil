import { z } from "zod";

/**
 * OynaBil veri havuzu modeli.
 *
 * Bütün oyunlar aynı havuzdan beslenir: Ders -> Sınıf -> Ünite -> Soru.
 * Yeni bir ders, ünite ya da soru tipi eklemek için oyun koduna dokunmak gerekmez;
 * oyunlar yalnızca destekledikleri soru tiplerini bildirir.
 */

export const GRADES = [5, 6, 7, 8] as const;
export const gradeSchema = z.union([z.literal(5), z.literal(6), z.literal(7), z.literal(8)]);
export type Grade = z.infer<typeof gradeSchema>;

export const difficultySchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type Difficulty = z.infer<typeof difficultySchema>;

export const idSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "id küçük harf, rakam ve tire içermeli");

const questionBase = z.object({
  id: idSchema,
  /** Ünite kimliği, ör. "dkab-8-1". Ders ve sınıf üniteden çıkarılır. */
  unit: idSchema,
  difficulty: difficultySchema,
  prompt: z.string().min(5).max(220),
  /** Cevaptan sonra tahtada gösterilen kısa açıklama. Öğretme kısmı burası. */
  explanation: z.string().min(5).max(320),
  tags: z.array(z.string()).optional(),
  /**
   * Aynı bilgiyi soran soruların ortak kimliği. Bilgi kartından üretilen sorular
   * (ör. "Tevrat hangi peygambere...?" ve "Hz. Musa'ya indirilen kitap...?") aynı gruptadır;
   * deste bir oyunda aynı gruptan ikinci soruyu sona bırakır.
   */
  group: z.string().optional(),
});

export const multipleChoiceSchema = questionBase.extend({
  type: z.literal("multiple-choice"),
  choices: z.array(z.string().min(1).max(80)).min(2).max(4),
  /** `choices` içindeki doğru cevabın sırası (0'dan başlar). */
  answer: z.number().int().min(0).max(3),
  /** Şıklar "Hepsi" gibi sıraya bağlıysa karıştırılmaz. */
  keepOrder: z.boolean().optional(),
});

export const trueFalseSchema = questionBase.extend({
  type: z.literal("true-false"),
  answer: z.boolean(),
});

/**
 * Paragraf sorusu (LGS tarzı): kısa bir metin ya da durum, ardından metne dayalı soru.
 * Okuma süresi gerektirdiği için oyunlar bu tipe ek süre verir; uzun metni sığdıramayan
 * oyunlar (ör. Halat Çekme) bu tipi desteklemez.
 */
export const passageSchema = questionBase.extend({
  type: z.literal("passage"),
  context: z.string().min(40).max(700),
  choices: z.array(z.string().min(1).max(140)).length(4),
  answer: z.number().int().min(0).max(3),
  keepOrder: z.boolean().optional(),
});

export const questionSchema = z
  .discriminatedUnion("type", [multipleChoiceSchema, trueFalseSchema, passageSchema])
  .refine((q) => q.type === "true-false" || q.answer < q.choices.length, {
    message: "answer, şık sayısından küçük olmalı",
  });

export type Question = z.infer<typeof questionSchema>;
export type QuestionType = Question["type"];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  "multiple-choice": "Çoktan seçmeli",
  "true-false": "Doğru / Yanlış",
  passage: "Paragraf (LGS)",
};

export type Unit = {
  id: string;
  grade: Grade;
  order: number;
  title: string;
};

export type Subject = {
  id: string;
  name: string;
  shortName: string;
  /** Ünite kimliklerinin öneki, ör. "dkab". */
  code: string;
  grades: readonly Grade[];
  units: Unit[];
  /** Müfredat kaynağı, öğretmene gösterilir. */
  curriculumNote: string;
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  1: "Kolay",
  2: "Orta",
  3: "Zor",
};
