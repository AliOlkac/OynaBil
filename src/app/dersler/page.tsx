import { ArrowLeft, Clock, PlayCircle } from "lucide-react";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Girih } from "@/components/ui/Girih";
import { audioTiming, lessonCatalog } from "@/lessons";
import { audioName, readingMs, STAGES, type Lesson } from "@/lessons/model";

export const metadata = { title: "Ders videoları · OynaBil" };

/** Dersin yaklaşık süresi (dakika): ses dosyalarının süresi ya da okuma süresi. */
function minutes(lesson: Lesson): number {
  const ms = lesson.scenes.reduce((sum, s, i) => {
    const say = audioTiming(audioName(lesson, i))?.ms ?? readingMs(s.say);
    const reveal = s.reveal ? (audioTiming(audioName(lesson, i, "reveal"))?.ms ?? readingMs(s.reveal)) + 6000 : 0;
    return sum + say + reveal + 700;
  }, 0);
  return Math.max(1, Math.round(ms / 60000));
}

export default function LessonsPage() {
  const catalog = lessonCatalog();
  return (
    <div className="relative min-h-dvh overflow-hidden bg-ink-900">
      <Girih className="text-cream opacity-[0.05]" scale={1.4} />
      <header className="relative mx-auto flex h-24 max-w-6xl items-center gap-3 px-5 sm:px-10">
        <ButtonLink href="/" variant="quiet" size="lg" className="-ml-3 !px-3" icon={<ArrowLeft className="size-6" />} aria-label="Ana sayfa" />
        <h1 className="text-3xl font-bold sm:text-4xl">Ders videoları</h1>
      </header>
      <main className="relative mx-auto flex max-w-6xl flex-col gap-10 px-5 pb-16 sm:px-10">
        <p className="max-w-3xl text-xl leading-relaxed text-ink-300">
          Her konu, sesli anlatımlı ve canlandırmalı kısa bir derstir: merak uyandıran bir soruyla başlar, keşfeder, öğretir, günlük hayatla
          ilişkilendirir, bir soruyla kendini denetir ve özetler. Tahtada tam ekran açılabilir; altyazılıdır.
        </p>
        {catalog.map(({ subject, grades }) => (
          <section key={subject.id} className="flex flex-col gap-6">
            <h2 className="text-2xl font-bold text-kehribar">{subject.name}</h2>
            {grades.map(({ grade, units }) =>
              units.map(({ unit, lessons }) => (
                <div key={unit.id} className="flex flex-col gap-3">
                  <p className="text-lg font-semibold text-ink-300">
                    {grade}. sınıf · {unit.order}. ünite · <span className="text-cream">{unit.title}</span>
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {lessons.map((l) => (
                      <Link
                        key={l.id}
                        href={`/dersler/${l.id}`}
                        className="group flex flex-col gap-3 rounded-xl bg-ink-850/90 p-5 shadow-[var(--surface-light),var(--surface-drop)] transition-colors duration-(--dur-base) hover:bg-ink-800"
                      >
                        <div className="flex items-center gap-3">
                          <PlayCircle className="size-10 shrink-0 text-kehribar transition-transform duration-(--dur-base) group-hover:scale-110" />
                          <span className="text-sm font-bold text-ink-400">{l.order}. konu</span>
                        </div>
                        <p className="text-xl leading-snug font-bold">{l.title}</p>
                        <div className="mt-auto flex items-center gap-2 text-ink-400">
                          <Clock className="size-4" />
                          <span className="text-sm">yaklaşık {minutes(l)} dk</span>
                          <span className="ml-auto flex gap-1" aria-hidden>
                            {[...new Set(l.scenes.map((s) => s.stage))].map((st) => (
                              <span key={st} className="size-2.5 rounded-full" style={{ background: STAGES[st].color }} />
                            ))}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )),
            )}
          </section>
        ))}
      </main>
    </div>
  );
}
