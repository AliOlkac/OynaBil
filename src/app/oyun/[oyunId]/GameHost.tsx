"use client";

import { useRouter } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { ClientOnly } from "@/components/ClientOnly";
import { GameShell } from "@/components/game/GameShell";
import { ButtonLink } from "@/components/ui/Button";
import { Girih } from "@/components/ui/Girih";
import { buildDeck } from "@/core/deck";
import { findUnit, getSubject, useQuestionPool } from "@/core/repository";
import { randomSeed } from "@/core/random";
import { getGame } from "@/games/registry";
import { GAME_SCREENS } from "@/games/screens";
import type { GameConfig } from "@/games/types";
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
  const pool = useQuestionPool();
  const deck = useMemo(
    () => (config ? buildDeck(pool, { unitIds: config.unitIds, types: game.questionTypes, seed: config.seed }) : []),
    // Oyun sırasında öğretmen yeni soru eklese bile deste değişmemeli; yalnızca oturum değişince kurulur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config?.sessionId],
  );

  if (!config || deck.length === 0) {
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
    const next: GameConfig = { ...config, seed: randomSeed(), sessionId: newSessionId() };
    startGame(next);
    setConfig(next);
  };

  return (
    <GameShell
      title={game.name}
      context={`${config.grade}. sınıf ${subject?.shortName ?? ""}, ${unitLabel}`}
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
