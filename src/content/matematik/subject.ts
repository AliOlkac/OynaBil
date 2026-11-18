import type { Subject } from "@/core/model";

export const matematik: Subject = {
  id: "matematik",
  name: "Matematik",
  shortName: "Matematik",
  code: "mat",
  grades: [5, 6, 7, 8],
  curriculumNote:
    "5, 6 ve 7. sınıf temaları Türkiye Yüzyılı Maarif Modeli Ortaokul Matematik Dersi Öğretim Programı'na, 8. sınıf üniteleri 2018 Matematik Dersi Öğretim Programı'na göre düzenlenmiştir. 8. sınıfta yakın üniteler birleştirilmiştir.",
  units: [
    { id: "mat-5-1", grade: 5, order: 1, title: "Geometrik Şekiller" },
    { id: "mat-5-2", grade: 5, order: 2, title: "Sayılar ve Nicelikler (1)" },
    { id: "mat-5-3", grade: 5, order: 3, title: "Geometrik Nicelikler" },
    { id: "mat-5-4", grade: 5, order: 4, title: "Sayılar ve Nicelikler (2)" },
    { id: "mat-5-5", grade: 5, order: 5, title: "İstatistiksel Araştırma Süreci" },
    { id: "mat-5-6", grade: 5, order: 6, title: "İşlemlerle Cebirsel Düşünme ve Değişimler" },
    { id: "mat-5-7", grade: 5, order: 7, title: "Veriden Olasılığa" },

    { id: "mat-6-1", grade: 6, order: 1, title: "Sayılar ve Nicelikler (1)" },
    { id: "mat-6-2", grade: 6, order: 2, title: "İşlemlerle Cebirsel Düşünme ve Değişimler" },
    { id: "mat-6-3", grade: 6, order: 3, title: "Sayılar ve Nicelikler (2)" },
    { id: "mat-6-4", grade: 6, order: 4, title: "Geometrik Şekiller" },
    { id: "mat-6-5", grade: 6, order: 5, title: "Geometrik Nicelikler" },
    { id: "mat-6-6", grade: 6, order: 6, title: "İstatistiksel Araştırma Süreci" },
    { id: "mat-6-7", grade: 6, order: 7, title: "Veriden Olasılığa" },

    { id: "mat-7-1", grade: 7, order: 1, title: "Sayılar ve Nicelikler (1)" },
    { id: "mat-7-2", grade: 7, order: 2, title: "İşlemlerle Cebirsel Düşünme ve Değişimler" },
    { id: "mat-7-3", grade: 7, order: 3, title: "Sayılar ve Nicelikler (2)" },
    { id: "mat-7-4", grade: 7, order: 4, title: "Geometrik Şekiller" },
    { id: "mat-7-5", grade: 7, order: 5, title: "Geometrik Nicelikler" },
    { id: "mat-7-6", grade: 7, order: 6, title: "İstatistiksel Araştırma Süreci" },
    { id: "mat-7-7", grade: 7, order: 7, title: "Veriden Olasılığa" },

    { id: "mat-8-1", grade: 8, order: 1, title: "Çarpanlar ve Katlar" },
    { id: "mat-8-2", grade: 8, order: 2, title: "Üslü İfadeler" },
    { id: "mat-8-3", grade: 8, order: 3, title: "Kareköklü İfadeler" },
    { id: "mat-8-4", grade: 8, order: 4, title: "Veri Analizi ve Basit Olayların Olma Olasılığı" },
    { id: "mat-8-5", grade: 8, order: 5, title: "Cebirsel İfadeler ve Özdeşlikler" },
    { id: "mat-8-6", grade: 8, order: 6, title: "Doğrusal Denklemler ve Eşitsizlikler" },
    { id: "mat-8-7", grade: 8, order: 7, title: "Üçgenler, Eşlik ve Benzerlik" },
    { id: "mat-8-8", grade: 8, order: 8, title: "Dönüşüm Geometrisi ve Geometrik Cisimler" },
  ],
};
