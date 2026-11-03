import type { Grade, QuestionType } from "@/core/model";
import type { PlayableQuestion } from "@/core/deck";

export type TeamColor = "kobalt" | "mercan" | "zumrut" | "kehribar";

export type Team = {
  id: string;
  name: string;
  color: TeamColor;
};

export type SettingValue = number | boolean;
export type GameSettings = Record<string, SettingValue>;

/**
 * Oyun ayarları bildirimseldir: kurulum ekranı bu listeyi çizer,
 * yeni bir oyun eklemek kurulum ekranını değiştirmeyi gerektirmez.
 */
export type SettingField =
  | {
      key: string;
      label: string;
      kind: "choice";
      options: { value: number; label: string }[];
      /** Yalnızca seçili ünitelerde bu tipte soru varsa gösterilir (ör. LGS paragraf soruları). */
      requiresType?: QuestionType;
    }
  | {
      key: string;
      label: string;
      kind: "toggle";
      hint: string;
    };

export type GameConfig = {
  gameId: string;
  subjectId: string;
  grade: Grade;
  unitIds: string[];
  /** Şube (ör. "C"). Sorulanlar hafızası şube bazında tutulur. */
  section?: string;
  teams: Team[];
  settings: GameSettings;
  seed: number;
  /**
   * Oyun başlarken kurulan deste sırası (soru kimlikleri). Sayfa yenilense, öğretmen yeni soru
   * eklese ya da bir soruyu gizlese bile süren oyunun soruları ve sırası değişmez.
   */
  deckIds: string[];
  /** Aynı oyunun yeniden yüklenince kaldığı yerden devam etmesi için. */
  sessionId: string;
};

export type GameDefinition = {
  id: string;
  name: string;
  tagline: string;
  howTo: string[];
  teamCount: { min: number; max: number; default: number };
  questionTypes: QuestionType[];
  /** Ayarlara göre kullanılan soru tipleri; yoksa `questionTypes`. */
  typesFor?: (settings: GameSettings) => QuestionType[];
  settings: SettingField[];
  defaultSettings: GameSettings;
  /** Bu ayarlarla oyunun ihtiyaç duyduğu en az soru sayısı. */
  questionsNeeded: (settings: GameSettings, teamCount: number) => number;
};

/** Her cevap kaydedilir; oyun sonu raporu ve öğretmenin "zorlanılan konular" listesi buradan çıkar. */
export type AnswerLog = {
  questionId: string;
  unit: string;
  teamId: string;
  correct: boolean;
  stolen?: boolean;
};

export type GameProps = {
  config: GameConfig;
  deck: PlayableQuestion[];
  onExit: () => void;
  onRestart: () => void;
};
