import type { GameDefinition } from "./types";

/**
 * Oyun kaydı. Yeni oyun eklemek için:
 * 1. `src/games/<oyun-id>/` altında mantığı (logic.ts) ve ekranı (Game.tsx) yaz,
 * 2. tanımını buraya ekle,
 * 3. ekranını `src/games/screens.ts` içine ekle.
 * Kurulum ekranı, ayarlar ve soru havuzu bağlantısı kendiliğinden çalışır.
 */

export const bilgiYarismasi: GameDefinition = {
  id: "bilgi-yarismasi",
  name: "Bilgi Yarışması",
  tagline: "Takımlar sırayla soru alır; bilemeyen takımın sorusu çalınabilir.",
  howTo: [
    "Sırası gelen takım cevabı söyler, öğretmen ya da öğrenci tahtada şıkka dokunur.",
    "Yanlış cevapta parmak kaldıran ilk takım soruyu çalabilir.",
    "Her takımın bir kez yarı yarıya, ek süre ve pas hakkı vardır.",
    "Her sorudan sonra açıklama gelir; konuyu orada anlatabilirsiniz.",
  ],
  teamCount: { min: 2, max: 4, default: 2 },
  questionTypes: ["multiple-choice", "true-false"],
  settings: [
    {
      key: "rounds",
      label: "Tur",
      kind: "choice",
      options: [
        { value: 3, label: "3" },
        { value: 5, label: "5" },
        { value: 8, label: "8" },
        { value: 10, label: "10" },
      ],
    },
    {
      key: "seconds",
      label: "Soru süresi",
      kind: "choice",
      options: [
        { value: 20, label: "20 sn" },
        { value: 30, label: "30 sn" },
        { value: 45, label: "45 sn" },
        { value: 0, label: "Süresiz" },
      ],
    },
    { key: "jokers", label: "Jokerler", kind: "toggle", hint: "Yarı yarıya, ek süre, pas" },
    { key: "steal", label: "Soru çalma", kind: "toggle", hint: "Bilemeyen takımın sorusu çalınır" },
  ],
  defaultSettings: { rounds: 5, seconds: 30, jokers: true, steal: true },
  // Her takım için tur sayısı kadar soru, pas jokerleri için de takım başına bir yedek.
  questionsNeeded: (s, teams) => Number(s.rounds) * teams + (s.jokers ? teams : 0),
};

export const halatCekme: GameDefinition = {
  id: "halat-cekme",
  name: "Halat Çekme",
  tagline: "Tahta ikiye bölünür; iki öğrenci aynı anda yarışır, her doğru ipi çeker. Kaybeden çamura düşer.",
  howTo: [
    "İki takımdan birer öğrenci tahtanın kendi yarısına geçer.",
    "Doğru cevapta takım ipe asılır, ip bir adım kendi tarafına gelir; yeni soru hemen çıkar.",
    "Yanlış cevapta takım kısa bir süre buz kesilir: o sırada doğru cevap tahtada görünür.",
    "Kurdele kendi bayrağınıza ulaşınca karşı takım çamura düşer. Süre biterse ip kimin tarafındaysa o kazanır.",
  ],
  teamCount: { min: 2, max: 2, default: 2 },
  questionTypes: ["multiple-choice", "true-false"],
  settings: [
    {
      key: "target",
      label: "İp uzunluğu",
      kind: "choice",
      options: [
        { value: 4, label: "Kısa" },
        { value: 6, label: "Orta" },
        { value: 9, label: "Uzun" },
      ],
    },
    {
      key: "seconds",
      label: "Süre",
      kind: "choice",
      options: [
        { value: 90, label: "1,5 dk" },
        { value: 180, label: "3 dk" },
        { value: 300, label: "5 dk" },
      ],
    },
  ],
  defaultSettings: { target: 6, seconds: 180 },
  // Deste bitince baştan döner; tekrarı azaltmak için bir miktar soru yeterli.
  questionsNeeded: () => 8,
};

export const GAMES: GameDefinition[] = [bilgiYarismasi, halatCekme];

export function getGame(id: string): GameDefinition | undefined {
  return GAMES.find((g) => g.id === id);
}
