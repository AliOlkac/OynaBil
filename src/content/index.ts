import { questionsFromCards, type CardSet } from "@/core/cards";
import type { Grade, Question, Subject } from "@/core/model";
import { dinKulturu } from "./din-kulturu/subject";

/**
 * İçerik kaydı. Her ders ve sınıfın soruları ayrı parça olarak yüklenir:
 * tahta yalnızca seçilen sınıfın sorularını indirir, gerisi gerektiğinde gelir.
 *
 * Bir sınıfın içeriği üç kaynaktan oluşur:
 * - `sorular/<sınıf>.json`      elle yazılmış sorular
 * - `kartlar/<sınıf>.json`      bilgi kartları (sorular koddan üretilir, bkz. src/core/cards.ts)
 * - `sorular/<sınıf>-lgs.json`  LGS tarzı paragraf soruları (isteğe bağlı)
 *
 * Yeni bir ders eklemek için `subject.ts` ile üniteleri tanımlayın, dosyaları koyun ve
 * aşağıdaki iki listeye ekleyin.
 */
export const SUBJECTS: Subject[] = [dinKulturu];

type Module = { default: unknown };
type GradeFiles = {
  questions: () => Promise<Module>;
  cards?: () => Promise<Module>;
  passages?: () => Promise<Module>;
};

export const CONTENT_FILES: Record<string, Partial<Record<Grade, GradeFiles>>> = {
  "din-kulturu": {
    5: { questions: () => import("./din-kulturu/sorular/5.json"), cards: () => import("./din-kulturu/kartlar/5.json") },
    6: { questions: () => import("./din-kulturu/sorular/6.json"), cards: () => import("./din-kulturu/kartlar/6.json") },
    7: { questions: () => import("./din-kulturu/sorular/7.json"), cards: () => import("./din-kulturu/kartlar/7.json") },
    8: {
      questions: () => import("./din-kulturu/sorular/8.json"),
      cards: () => import("./din-kulturu/kartlar/8.json"),
      passages: () => import("./din-kulturu/sorular/8-lgs.json"),
    },
  },
};

/** Bir ders ve sınıfın uygulamayla gelen bütün soruları. İçerik testleri dosyaları ayrıca doğrular. */
export async function loadBuiltIn(subjectId: string, grade: Grade): Promise<Question[]> {
  const files = CONTENT_FILES[subjectId]?.[grade];
  if (!files) return [];
  const [questions, cards, passages] = await Promise.all([files.questions(), files.cards?.(), files.passages?.()]);
  return [
    ...(questions.default as Question[]),
    ...(cards ? questionsFromCards(cards.default as CardSet[]) : []),
    ...((passages?.default as Question[] | undefined) ?? []),
  ];
}

/** Sınıf bazında soru sayıları (ana sayfa ve belgeler için). Derleme sırasında sunucuda çalışır. */
export async function countBuiltIn(): Promise<{ subject: Subject; total: number; byGrade: Partial<Record<Grade, number>> }[]> {
  return Promise.all(
    SUBJECTS.map(async (subject) => {
      const byGrade: Partial<Record<Grade, number>> = {};
      for (const grade of subject.grades) byGrade[grade] = (await loadBuiltIn(subject.id, grade)).length;
      return { subject, total: Object.values(byGrade).reduce((a, b) => a + (b ?? 0), 0), byGrade };
    }),
  );
}
