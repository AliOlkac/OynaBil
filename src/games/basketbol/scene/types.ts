import type { BasketState, Range, Shot } from "../logic";

/** Basketbol sahnelerinin (3D ve çizim) ortak girdisi: oyun mantığından özet. */
export type BasketSceneInput = {
  phase: BasketState["phase"];
  shooter: 0 | 1 | null;
  range: Range | null;
  /** Topa basılı tutulduğu an (güç toplanıyor); şutçu çömelir, güç arttıkça daha çok. */
  pressAt: number | null;
  shots: Shot[];
  winner: 0 | 1 | "draw" | null;
};

export type SceneTeam = { base: string; deep: string };
