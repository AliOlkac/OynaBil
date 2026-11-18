import { questionsFromCards, type CardSet } from "@/core/cards";
import type { Grade, Question, Subject } from "@/core/model";
import { turkce } from "./turkce/subject";
import { matematik } from "./matematik/subject";
import { hayatBilgisi } from "./hayat-bilgisi/subject";
import { fenBilimleri } from "./fen-bilimleri/subject";
import { sosyalBilgiler } from "./sosyal-bilgiler/subject";
import { ingilizce } from "./ingilizce/subject";
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
export const SUBJECTS: Subject[] = [turkce, matematik, hayatBilgisi, fenBilimleri, sosyalBilgiler, ingilizce, dinKulturu];

type Module = { default: unknown };
type GradeFiles = {
  questions: () => Promise<Module>;
  cards?: () => Promise<Module>;
  passages?: () => Promise<Module>;
};

export const CONTENT_FILES: Record<string, Partial<Record<Grade, GradeFiles>>> = {
  turkce: {
    1: { questions: () => import("./turkce/sorular/1.json"), cards: () => import("./turkce/kartlar/1.json") },
    2: { questions: () => import("./turkce/sorular/2.json"), cards: () => import("./turkce/kartlar/2.json") },
    3: { questions: () => import("./turkce/sorular/3.json"), cards: () => import("./turkce/kartlar/3.json") },
    4: { questions: () => import("./turkce/sorular/4.json"), cards: () => import("./turkce/kartlar/4.json") },
  },
  matematik: {
    1: { questions: () => import("./matematik/sorular/1.json"), cards: () => import("./matematik/kartlar/1.json") },
    2: { questions: () => import("./matematik/sorular/2.json"), cards: () => import("./matematik/kartlar/2.json") },
    3: { questions: () => import("./matematik/sorular/3.json"), cards: () => import("./matematik/kartlar/3.json") },
    4: { questions: () => import("./matematik/sorular/4.json"), cards: () => import("./matematik/kartlar/4.json") },
    5: { questions: () => import("./matematik/sorular/5.json"), cards: () => import("./matematik/kartlar/5.json") },
    6: { questions: () => import("./matematik/sorular/6.json"), cards: () => import("./matematik/kartlar/6.json") },
    7: { questions: () => import("./matematik/sorular/7.json"), cards: () => import("./matematik/kartlar/7.json") },
    8: { questions: () => import("./matematik/sorular/8.json"), cards: () => import("./matematik/kartlar/8.json"), passages: () => import("./matematik/sorular/8-lgs.json") },
  },
  "hayat-bilgisi": {
    1: { questions: () => import("./hayat-bilgisi/sorular/1.json"), cards: () => import("./hayat-bilgisi/kartlar/1.json") },
    2: { questions: () => import("./hayat-bilgisi/sorular/2.json"), cards: () => import("./hayat-bilgisi/kartlar/2.json") },
    3: { questions: () => import("./hayat-bilgisi/sorular/3.json"), cards: () => import("./hayat-bilgisi/kartlar/3.json") },
  },
  "fen-bilimleri": {
    6: { questions: () => import("./fen-bilimleri/sorular/6.json"), cards: () => import("./fen-bilimleri/kartlar/6.json") },
    7: { questions: () => import("./fen-bilimleri/sorular/7.json"), cards: () => import("./fen-bilimleri/kartlar/7.json") },
    8: { questions: () => import("./fen-bilimleri/sorular/8.json"), cards: () => import("./fen-bilimleri/kartlar/8.json"), passages: () => import("./fen-bilimleri/sorular/8-lgs.json") },
  },
  "sosyal-bilgiler": {
    4: { questions: () => import("./sosyal-bilgiler/sorular/4.json"), cards: () => import("./sosyal-bilgiler/kartlar/4.json") },
    5: { questions: () => import("./sosyal-bilgiler/sorular/5.json"), cards: () => import("./sosyal-bilgiler/kartlar/5.json") },
    6: { questions: () => import("./sosyal-bilgiler/sorular/6.json"), cards: () => import("./sosyal-bilgiler/kartlar/6.json") },
    7: { questions: () => import("./sosyal-bilgiler/sorular/7.json"), cards: () => import("./sosyal-bilgiler/kartlar/7.json") },
  },
  ingilizce: {
    2: { questions: () => import("./ingilizce/sorular/2.json"), cards: () => import("./ingilizce/kartlar/2.json") },
    3: { questions: () => import("./ingilizce/sorular/3.json"), cards: () => import("./ingilizce/kartlar/3.json") },
    4: { questions: () => import("./ingilizce/sorular/4.json"), cards: () => import("./ingilizce/kartlar/4.json") },
    5: { questions: () => import("./ingilizce/sorular/5.json"), cards: () => import("./ingilizce/kartlar/5.json") },
    6: { questions: () => import("./ingilizce/sorular/6.json"), cards: () => import("./ingilizce/kartlar/6.json") },
    7: { questions: () => import("./ingilizce/sorular/7.json"), cards: () => import("./ingilizce/kartlar/7.json") },
    8: { questions: () => import("./ingilizce/sorular/8.json"), cards: () => import("./ingilizce/kartlar/8.json"), passages: () => import("./ingilizce/sorular/8-lgs.json") },
  },
  "din-kulturu": {
    5: { questions: () => import("./din-kulturu/sorular/5.json"), cards: () => import("./din-kulturu/kartlar/5.json") },
    6: { questions: () => import("./din-kulturu/sorular/6.json"), cards: () => import("./din-kulturu/kartlar/6.json") },
    7: { questions: () => import("./din-kulturu/sorular/7.json"), cards: () => import("./din-kulturu/kartlar/7.json") },
    8: { questions: () => import("./din-kulturu/sorular/8.json"), cards: () => import("./din-kulturu/kartlar/8.json"), passages: () => import("./din-kulturu/sorular/8-lgs.json") },
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
