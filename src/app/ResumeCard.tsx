"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { getGame } from "@/games/registry";
import { loadActiveGame, loadGameState } from "@/lib/session";

/** Tahta kapanıp açıldığında ya da sayfa yenilendiğinde yarım kalan oyuna tek dokunuşla dönüş. */
export function ResumeCard() {
  const [active] = useState(() => {
    const config = loadActiveGame();
    // Bitmiş oyun "yarım kalan" sayılmaz.
    return config && loadGameState<{ phase?: string }>(config.sessionId)?.phase !== "finished" ? config : null;
  });
  const game = active ? getGame(active.gameId) : undefined;
  if (!active || !game) return null;
  return (
    <ButtonLink href={`/oyun/${game.id}`} size="xl" icon={<RotateCcw className="size-6" />}>
      Yarım kalan {game.name}
    </ButtonLink>
  );
}
