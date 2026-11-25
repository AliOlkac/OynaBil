import type { ArcheryState, Shot, Wind } from "../logic";

/** Okçuluk sahnelerinin (3D ve çizim) ortak girdisi: oyun mantığından özet. */
export type ArcherySceneInput = {
  phase: ArcheryState["phase"];
  shooter: 0 | 1 | null;
  /** Nişan alma başladığında (yay gerilir). */
  aimStart: number | null;
  wind: Wind;
  shots: Shot[];
  winner: 0 | 1 | "draw" | null;
};

export type SceneTeam = { base: string; deep: string };
