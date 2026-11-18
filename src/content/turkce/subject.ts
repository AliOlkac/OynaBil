import type { Subject } from "@/core/model";

export const turkce: Subject = {
  id: "turkce",
  name: "Türkçe",
  shortName: "Türkçe",
  code: "tr",
  grades: [1, 2, 3, 4],
  curriculumNote:
    "Üniteler, Türkçe Dersi Öğretim Programı'nın kazanımlarına göre tema adlarıyla değil beceri alanlarıyla düzenlenmiştir. 1, 2 ve 3. sınıflar Türkiye Yüzyılı Maarif Modeli'ne, 4. sınıf 2026-2027 öğretim yılında okutulan programa göredir.",
  units: [
    { id: "tr-1-1", grade: 1, order: 1, title: "Harf ve Ses Bilgisi" },
    { id: "tr-1-2", grade: 1, order: 2, title: "Hece Bilgisi" },
    { id: "tr-1-3", grade: 1, order: 3, title: "Sözcükte Anlam (Zıt ve Eş Anlam)" },
    { id: "tr-1-4", grade: 1, order: 4, title: "Cümle Bilgisi" },
    { id: "tr-1-5", grade: 1, order: 5, title: "Yazım ve Noktalama" },
    { id: "tr-1-6", grade: 1, order: 6, title: "Okuduğunu Anlama" },

    { id: "tr-2-1", grade: 2, order: 1, title: "Harf, Hece ve Alfabetik Sıra" },
    { id: "tr-2-2", grade: 2, order: 2, title: "Sözcükte Anlam (Eş, Zıt, Eş Sesli)" },
    { id: "tr-2-3", grade: 2, order: 3, title: "Cümle Bilgisi" },
    { id: "tr-2-4", grade: 2, order: 4, title: "Yazım Kuralları" },
    { id: "tr-2-5", grade: 2, order: 5, title: "Noktalama İşaretleri" },
    { id: "tr-2-6", grade: 2, order: 6, title: "Okuduğunu Anlama" },

    { id: "tr-3-1", grade: 3, order: 1, title: "Sözcükte Anlam (Eş, Zıt, Eş Sesli)" },
    { id: "tr-3-2", grade: 3, order: 2, title: "Adlar ve Sözcük Türleri" },
    { id: "tr-3-3", grade: 3, order: 3, title: "Cümle Bilgisi ve Cümlede Anlam" },
    { id: "tr-3-4", grade: 3, order: 4, title: "Yazım Kuralları" },
    { id: "tr-3-5", grade: 3, order: 5, title: "Noktalama İşaretleri" },
    { id: "tr-3-6", grade: 3, order: 6, title: "Okuduğunu Anlama" },

    { id: "tr-4-1", grade: 4, order: 1, title: "Sözcükte Anlam (Eş, Zıt, Eş Sesli, Mecaz)" },
    { id: "tr-4-2", grade: 4, order: 2, title: "Deyimler ve Atasözleri" },
    { id: "tr-4-3", grade: 4, order: 3, title: "Cümlede Anlam" },
    { id: "tr-4-4", grade: 4, order: 4, title: "Yazım Kuralları" },
    { id: "tr-4-5", grade: 4, order: 5, title: "Noktalama İşaretleri" },
    { id: "tr-4-6", grade: 4, order: 6, title: "Okuduğunu Anlama" },
  ],
};
