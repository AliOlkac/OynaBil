import type { Question, Subject } from "@/core/model";
import { dinKulturu } from "./din-kulturu/subject";
import dkab5 from "./din-kulturu/sorular/5.json";
import dkab6 from "./din-kulturu/sorular/6.json";
import dkab7 from "./din-kulturu/sorular/7.json";
import dkab8 from "./din-kulturu/sorular/8.json";

/**
 * İçerik kaydı. Yeni bir ders eklemek için:
 * 1. `src/content/<ders-id>/subject.ts` içinde üniteleri tanımla,
 * 2. `src/content/<ders-id>/sorular/<sınıf>.json` dosyalarına soruları yaz,
 * 3. aşağıdaki iki listeye ekle.
 */
export const SUBJECTS: Subject[] = [dinKulturu];

export const BUILT_IN_QUESTIONS: Question[] = [
  ...(dkab5 as Question[]),
  ...(dkab6 as Question[]),
  ...(dkab7 as Question[]),
  ...(dkab8 as Question[]),
];
