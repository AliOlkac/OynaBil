"use client";

import { useRouter } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { ClientOnly } from "@/components/ClientOnly";
import { GameShell } from "@/components/game/GameShell";
import { ButtonLink } from "@/components/ui/Button";
import { Girih } from "@/components/ui/Girih";
import { buildDeckIds, deckFromIds } from "@/core/deck";
import { findUnit, getSubject, useGradePool } from "@/core/repository";
import { randomSeed } from "@/core/random";
import { gameTypes, getGame } from "@/games/registry";
import { GAME_SCREENS } from "@/games/screens";
import type { GameConfig } from "@/games/types";
import { getSeen, memoryScope } from "@/lib/memory";
import { endActiveGame, loadActiveGame, newSessionId, startGame } from "@/lib/session";

export function GameHost({ gameId }: { gameId: string }) {
  return (
    <ClientOnly fallback={<div className="h-dvh bg-ink-900" />}>
      <ActiveGame gameId={gameId} />
    </ClientOnly>
  );
}

function ActiveGame({ gameId }: { gameId: string }) {
  const router = useRouter();
  const game = getGame(gameId)!;
  const [config, setConfig] = useState<GameConfig | null>(() => {
    const active = loadActiveGame();
    return active?.gameId === gameId ? active : null;
  });
  const subjectId = config?.subjectId ?? "din-kulturu";
  const grade = config?.grade ?? 5;
  // Süren oyunun destesi gizlenen sorular dahil havuzdan, kayıtlı sırayla kurulur; yeni deste gizlenenleri almaz.
  const fullPool = useGradePool(subjectId, grade, { includeHidden: true });
  const playablePool = useGradePool(subjectId, grade);
  const deck = useMemo(() => {
    if (!config || !fullPool) return null;
    const ids = config.deckIds ?? buildDeckIds(fullPool, { unitIds: config.unitIds, types: gameTypes(game, config.settings), seed: config.seed });
    return deckFromIds(fullPool, ids, config.seed);
  }, [config, fullPool, game]);

  if (config && !deck) return <div className="h-dvh bg-ink-900" />;

  if (!config || !deck || deck.length === 0) {
    return (
      <div className="relative grid h-dvh place-items-center bg-ink-900 p-8 text-center">
        <Girih className="text-cream opacity-[0.05]" />
        <div className="relative">
          <h1 className="text-4xl font-bold">{game.name} için kurulum gerekiyor</h1>
          <p className="mt-3 text-xl text-ink-300">Sınıfı, üniteleri ve takımları seçip oyunu başlatın.</p>
          <ButtonLink href={`/kurulum?oyun=${gameId}`} variant="primary" size="lg" className="mt-8">
            Kuruluma git
          </ButtonLink>
        </div>
      </div>
    );
  }

  const subject = getSubject(config.subjectId);
  const unitLabel = config.unitIds.length === 1 ? (findUnit(config.unitIds[0])?.title ?? "") : `${config.unitIds.length} ünite`;
  const Screen = GAME_SCREENS[gameId];

  const restart = () => {
    const seed = randomSeed();
    const seen = getSeen(memoryScope(config.subjectId, config.grade, config.section));
    const deckIds = buildDeckIds(playablePool ?? fullPool ?? [], { unitIds: config.unitIds, types: gameTypes(game, config.settings), seed, seen });
    const next: GameConfig = { ...config, seed, deckIds, sessionId: newSessionId() };
    startGame(next);
    setConfig(next);
  };

  return (
    <GameShell
      title={game.name}
      context={`${config.grade}${config.section ? `-${config.section}` : ". sınıf"} ${subject?.shortName ?? ""}, ${unitLabel}`}
      onExit={() => {
        endActiveGame();
        router.push(`/kurulum?oyun=${gameId}`);
      }}
    >
      <Suspense fallback={null}>
        <Screen key={config.sessionId} config={config} deck={deck} onExit={() => router.push("/")} onRestart={restart} />
      </Suspense>
    </GameShell>
  );
}
