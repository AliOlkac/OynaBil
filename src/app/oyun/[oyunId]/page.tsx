import { notFound } from "next/navigation";
import { GAMES, getGame } from "@/games/registry";
import { GameHost } from "./GameHost";

export function generateStaticParams() {
  return GAMES.map((g) => ({ oyunId: g.id }));
}

export async function generateMetadata({ params }: PageProps<"/oyun/[oyunId]">) {
  const { oyunId } = await params;
  return { title: `${getGame(oyunId)?.name ?? "Oyun"} · OynaBil` };
}

export default async function GamePage({ params }: PageProps<"/oyun/[oyunId]">) {
  const { oyunId } = await params;
  if (!getGame(oyunId)) notFound();
  return <GameHost gameId={oyunId} />;
}
