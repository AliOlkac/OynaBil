import type { Grade, Subject, Unit } from "@/core/model";

/** Türkiye Yüzyılı Maarif Modeli Hayat Bilgisi programının altı öğrenme alanı; üç sınıfta da aynıdır. */
const LEARNING_AREAS = [
  "Ben ve Okulum",
  "Sağlığım ve Güvenliğim",
  "Ailem ve Toplum",
  "Yaşadığım Yer ve Ülkem",
  "Doğa ve Çevre",
  "Bilim, Teknoloji ve Sanat",
] as const;

const GRADES: readonly Grade[] = [1, 2, 3];

const units: Unit[] = GRADES.flatMap((grade) =>
  LEARNING_AREAS.map((title, i) => ({ id: `hb-${grade}-${i + 1}`, grade, order: i + 1, title })),
);

export const hayatBilgisi: Subject = {
  id: "hayat-bilgisi",
  name: "Hayat Bilgisi",
  shortName: "Hayat Bilgisi",
  code: "hb",
  grades: GRADES,
  curriculumNote:
    "1, 2 ve 3. sınıf üniteleri, Türkiye Yüzyılı Maarif Modeli Hayat Bilgisi Dersi Öğretim Programı'nın altı öğrenme alanına göre düzenlenmiştir.",
  units,
};
