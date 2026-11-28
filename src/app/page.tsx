import { ArrowRight, Library, PlayCircle, Smartphone } from "lucide-react";
import Link from "next/link";
import { ClientOnly } from "@/components/ClientOnly";
import { ButtonLink } from "@/components/ui/Button";
import { Girih } from "@/components/ui/Girih";
import { Logo } from "@/components/ui/Logo";
import { countBuiltIn } from "@/content";
import { GAMES } from "@/games/registry";
import { GameGlyph } from "@/components/game/GameGlyph";
import { ResumeCard } from "./ResumeCard";

export default async function Home() {
  // Derleme sırasında sayılır: kartlardan üretilenler dahil, uygulamayla gelen bütün sorular.
  const counts = await countBuiltIn();
  const total = counts.reduce((sum, c) => sum + c.total, 0);
  const units = counts.reduce((sum, c) => sum + c.subject.units.length, 0);
  const grades = counts.flatMap((c) => [...c.subject.grades]);
  const summary =
    counts.length === 1
      ? `${counts[0].subject.name}: ${Math.min(...grades)}-${Math.max(...grades)}. sınıf, ${units} ünite, ${total.toLocaleString("tr-TR")} soru.`
      : `${counts.length} ders, ${Math.min(...grades)}-${Math.max(...grades)}. sınıf, ${units} ünite, ${total.toLocaleString("tr-TR")} soru: ${counts.map((c) => c.subject.shortName).join(", ")}.`;
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-ink-900">
      <Girih className="text-cream opacity-[0.07]" scale={1.4} />

      <header className="relative flex h-20 shrink-0 items-center px-5 sm:px-10">
        <Logo className="text-2xl sm:text-3xl" />
        <ButtonLink href="/dersler" variant="quiet" size="lg" className="ml-auto !px-4" icon={<PlayCircle className="size-6" />} aria-label="Ders videoları">
          <span className="hidden sm:inline">Ders videoları</span>
        </ButtonLink>
        <ButtonLink href="/mobil" variant="quiet" size="lg" className="!px-4" icon={<Smartphone className="size-6" />} aria-label="Mobil prototip">
          <span className="hidden sm:inline">Mobil</span>
        </ButtonLink>
        <ButtonLink href="/sorular" variant="quiet" size="lg" className="!px-4" icon={<Library className="size-6" />} aria-label="Soru bankası">
          <span className="hidden sm:inline">Soru bankası</span>
        </ButtonLink>
      </header>

      <main className="relative grid flex-1 grid-cols-1 items-center gap-12 px-5 pb-12 sm:px-10 lg:grid-cols-[1.2fr_1fr]">
        <section>
          <h1 className="text-4xl leading-[1.05] font-bold text-balance sm:text-5xl lg:text-6xl">
            Dersi takımlar arası <span className="text-kehribar">yarışmaya</span> çevirin.
          </h1>
          <p className="mt-6 max-w-[38rem] text-xl leading-relaxed text-ink-300">
            Akıllı tahtada açın, sınıfı takımlara ayırın, soruları yarışarak çözün. Her sorudan sonra tahtada kısa bir açıklama
            gelir; konuyu orada pekiştirirsiniz.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <ButtonLink href="/kurulum" variant="primary" size="xl" icon={<ArrowRight className="size-7" />} iconAfter>
              Oyun kur
            </ButtonLink>
            <ClientOnly>
              <ResumeCard />
            </ClientOnly>
          </div>
          <p className="mt-12 text-ink-400">
            {summary}
          </p>
        </section>

        <section className="flex flex-col gap-4" aria-label="Oyunlar">
          {GAMES.map((g) => (
            <Link
              key={g.id}
              href={`/kurulum?oyun=${g.id}`}
              className="group flex items-center gap-5 rounded-xl bg-ink-850/90 p-6 shadow-[var(--surface-light),var(--surface-drop)] transition-colors duration-(--dur-base) hover:bg-ink-800"
            >
              <GameGlyph id={g.id} />
              <div className="min-w-0 flex-1">
                <p className="text-2xl font-bold">{g.name}</p>
                <p className="mt-1 text-lg leading-snug text-ink-300">{g.tagline}</p>
              </div>
              <ArrowRight className="size-7 shrink-0 text-ink-400 transition-transform duration-(--dur-base) group-hover:translate-x-1 group-hover:text-firuze" />
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}
