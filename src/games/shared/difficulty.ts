import type { SettingField } from "../types";

/**
 * Beceri oyunlarının zorluğu (Okçuluk, Basketbol, Penaltı, Kule Yıkmaca): 1 kolay, 2 normal, 3 zor.
 * Kolay, oyunların ilk sürümündeki ayardır; küçük sınıflar için uygundur. Ayarı olmayan (eski) kayıtlı
 * oyunlar kolay sayılır: yarıda kalan bir oyun yeniden açılınca kuralları değişmez.
 */
export type Difficulty = 1 | 2 | 3;

export const DIFFICULTY_SETTING: SettingField = {
  key: "difficulty",
  label: "Zorluk",
  kind: "choice",
  options: [
    { value: 1, label: "Kolay" },
    { value: 2, label: "Normal" },
    { value: 3, label: "Zor" },
  ],
};

export const DEFAULT_DIFFICULTY: Difficulty = 2;

export function difficultyOf(settings: { difficulty?: number }): Difficulty {
  const d = settings.difficulty;
  return d === 2 || d === 3 ? d : 1;
}

/** Zorluğa göre değer seçer: [kolay, normal, zor]. */
export const byDifficulty = <T,>(d: Difficulty, values: readonly [T, T, T]): T => values[d - 1];
