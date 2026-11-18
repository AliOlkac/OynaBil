import type { Subject } from "@/core/model";

export const inkilapTarihi: Subject = {
  id: "inkilap-tarihi",
  name: "T.C. İnkılap Tarihi ve Atatürkçülük",
  shortName: "İnkılap Tarihi",
  code: "ink",
  grades: [8],
  curriculumNote:
    "8. sınıf üniteleri, 2026-2027 öğretim yılında okutulan 2018 T.C. İnkılap Tarihi ve Atatürkçülük öğretim programına göre düzenlenmiştir.",
  units: [
    { id: "ink-8-1", grade: 8, order: 1, title: "Bir Kahraman Doğuyor" },
    { id: "ink-8-2", grade: 8, order: 2, title: "Millî Uyanış: Bağımsızlık Yolunda Atılan Adımlar" },
    { id: "ink-8-3", grade: 8, order: 3, title: "Millî Bir Destan: Ya İstiklal Ya Ölüm!" },
    { id: "ink-8-4", grade: 8, order: 4, title: "Atatürkçülük ve Çağdaşlaşan Türkiye" },
    { id: "ink-8-5", grade: 8, order: 5, title: "Demokratikleşme Çabaları" },
    { id: "ink-8-6", grade: 8, order: 6, title: "Atatürk Dönemi Türk Dış Politikası" },
    { id: "ink-8-7", grade: 8, order: 7, title: "Atatürk'ün Ölümü ve Sonrası" },
  ],
};
