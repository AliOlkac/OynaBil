import type { BasketState, Launch, Range, Shot } from "../logic";

/** Basketbol sahnelerinin (3D ve çizim) ortak girdisi: oyun mantığından özet. */
export type BasketSceneInput = {
  phase: BasketState["phase"];
  shooter: 0 | 1 | null;
  range: Range | null;
  /** Şutçunun o an çektiği atış (çekiş sürerken); sahne yolun başını noktalarla gösterir. */
  pull: Launch | null;
  shots: Shot[];
  winner: 0 | 1 | "draw" | null;
};

export type SceneTeam = { base: string; deep: string };
