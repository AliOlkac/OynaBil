import { notFound } from "next/navigation";
import { findLesson, lessonContext, LESSONS } from "@/lessons";
import { LessonPlayer } from "@/lessons/LessonPlayer";

export function generateStaticParams() {
  return LESSONS.map((l) => ({ dersId: l.id }));
}

export async function generateMetadata({ params }: PageProps<"/dersler/[dersId]">) {
  const { dersId } = await params;
  return { title: `${findLesson(dersId)?.title ?? "Ders"} · OynaBil` };
}

export default async function LessonPage({ params }: PageProps<"/dersler/[dersId]">) {
  const { dersId } = await params;
  const lesson = findLesson(dersId);
  if (!lesson) notFound();
  const { subject, unit, next } = lessonContext(lesson);
  return <LessonPlayer key={lesson.id} lesson={lesson} unitTitle={unit.title} subjectName={subject.shortName} next={next ? { id: next.id, title: next.title } : null} />;
}
