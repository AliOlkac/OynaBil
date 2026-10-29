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
  teams: Team[];
  settings: GameSettings;
  seed: number;
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
