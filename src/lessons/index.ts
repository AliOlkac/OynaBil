import { SUBJECTS } from "@/content";
import type { Grade, Subject, Unit } from "@/core/model";
import dkab5 from "@/content/din-kulturu/dersler/5.json";
import dkab5Timing from "@/content/din-kulturu/dersler/5.ses.json";
import { lessonSchema, type Lesson } from "./model";

/**
 * Ders videolarının kaydı. Dersler küçük olduğu için derlemede okunur; sesler `public/ses/dersler/`
 * altında durur ve oynatılırken iner. `*.ses.json` her ses dosyasının süresini ve kelime zamanlarını
 * taşır (altyazıda okunan kelime vurgulanır); ses üretim betiği yazar (bkz. docs/DERSLER.md).
 */
export type WordTiming = [startMs: number, word: string];
export type AudioTiming = { ms: number; words: WordTiming[] };

const SOURCES: { subjectId: string; grade: Grade; lessons: unknown[]; timing: Record<string, AudioTiming> }[] = [
  { subjectId: "din-kulturu", grade: 5, lessons: dkab5, timing: dkab5Timing as unknown as Record<string, AudioTiming> },
];

export const LESSONS: Lesson[] = SOURCES.flatMap((s) => s.lessons.map((l) => lessonSchema.parse(l))).sort((a, b) => a.unit.localeCompare(b.unit) || a.order - b.order);
const TIMING: Record<string, AudioTiming> = Object.assign({}, ...SOURCES.map((s) => s.timing));

export const audioTiming = (name: string): AudioTiming | undefined => TIMING[name];
export const findLesson = (id: string) => LESSONS.find((l) => l.id === id);
export const lessonsOfUnit = (unitId: string) => LESSONS.filter((l) => l.unit === unitId);

/** Dersin ünitesi ve dersi: sayfa başlığı ve "sonraki ders" için. */
export function lessonContext(lesson: Lesson): { subject: Subject; unit: Unit; next: Lesson | null } {
  const subject = SUBJECTS.find((s) => s.units.some((u) => u.id === lesson.unit))!;
  const unit = subject.units.find((u) => u.id === lesson.unit)!;
  const siblings = lessonsOfUnit(lesson.unit);
  return { subject, unit, next: siblings[siblings.indexOf(lesson) + 1] ?? null };
}

/** Dersi olan dersler, sınıflar ve üniteler (liste sayfası için). */
export function lessonCatalog() {
  return SUBJECTS.flatMap((subject) => {
    const units = subject.units.filter((u) => LESSONS.some((l) => l.unit === u.id));
    if (!units.length) return [];
    const grades = [...new Set(units.map((u) => u.grade))].sort((a, b) => a - b);
    return [{ subject, grades: grades.map((grade) => ({ grade, units: units.filter((u) => u.grade === grade).map((unit) => ({ unit, lessons: lessonsOfUnit(unit.id) })) })) }];
  });
}
