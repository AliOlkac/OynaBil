/**
 * Beceri oyunlarının zorluğu: 1 kolay, 2 normal, 3 zor. Okçuluk, Basketbol ve Kule Yıkmaca her zaman
 * zor oynanır; kurulumda zorluk ayarı yoktur (projenin sahibinin kararı: tam puan kolay olmamalı).
 * Penaltı şansa dayandığı için sapmasız (1) oynanır. Kademeler testler ve ileride açılabilecek
 * ayarlar için durur.
 */
export type Difficulty = 1 | 2 | 3;

export const SKILL_DIFFICULTY: Difficulty = 3;

/** Ayarlarda geçerli bir zorluk yazıyorsa onu, yoksa `fallback` değerini döner. */
export function difficultyOf(settings: { difficulty?: number }, fallback: Difficulty = SKILL_DIFFICULTY): Difficulty {
  const d = settings.difficulty;
  return d === 1 || d === 2 || d === 3 ? d : fallback;
}

/** Zorluğa göre değer seçer: [kolay, normal, zor]. */
export const byDifficulty = <T,>(d: Difficulty, values: readonly [T, T, T]): T => values[d - 1];
