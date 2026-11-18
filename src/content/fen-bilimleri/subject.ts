import type { Subject } from "@/core/model";

export const fenBilimleri: Subject = {
  id: "fen-bilimleri",
  name: "Fen Bilimleri",
  shortName: "Fen",
  code: "fen",
  grades: [6, 7, 8],
  curriculumNote:
    "6 ve 7. sınıf üniteleri Türkiye Yüzyılı Maarif Modeli Fen Bilimleri programına, 8. sınıf üniteleri 2026-2027 öğretim yılında okutulan 2018 programına göre düzenlenmiştir.",
  units: [
    { id: "fen-6-1", grade: 6, order: 1, title: "Güneş Sistemi ve Tutulmalar" },
    { id: "fen-6-2", grade: 6, order: 2, title: "Kuvvetin Etkisinde Hareket" },
    { id: "fen-6-3", grade: 6, order: 3, title: "Canlılarda Sistemler" },
    { id: "fen-6-4", grade: 6, order: 4, title: "Işığın Yansıması ve Renkler" },
    { id: "fen-6-5", grade: 6, order: 5, title: "Maddenin Ayırt Edici Özellikleri" },
    { id: "fen-6-6", grade: 6, order: 6, title: "Elektriğin İletimi ve Direnç" },
    { id: "fen-6-7", grade: 6, order: 7, title: "Sürdürülebilir Yaşam ve Etkileşim" },

    { id: "fen-7-1", grade: 7, order: 1, title: "Uzay Çağı" },
    { id: "fen-7-2", grade: 7, order: 2, title: "Kuvvet ve Enerjiyi Keşfedelim" },
    { id: "fen-7-3", grade: 7, order: 3, title: "Vücudumuzdaki Sistemler" },
    { id: "fen-7-4", grade: 7, order: 4, title: "Işığın Kırılması ve Mercekler" },
    { id: "fen-7-5", grade: 7, order: 5, title: "Maddenin Doğasına Yolculuk" },
    { id: "fen-7-6", grade: 7, order: 6, title: "Elektriklenme" },
    { id: "fen-7-7", grade: 7, order: 7, title: "Sürdürülebilir Yaşam ve Enerji" },

    { id: "fen-8-1", grade: 8, order: 1, title: "Mevsimler ve İklim" },
    { id: "fen-8-2", grade: 8, order: 2, title: "DNA ve Genetik Kod" },
    { id: "fen-8-3", grade: 8, order: 3, title: "Basınç" },
    { id: "fen-8-4", grade: 8, order: 4, title: "Madde ve Endüstri" },
    { id: "fen-8-5", grade: 8, order: 5, title: "Basit Makineler" },
    { id: "fen-8-6", grade: 8, order: 6, title: "Enerji Dönüşümleri ve Çevre Bilimi" },
    { id: "fen-8-7", grade: 8, order: 7, title: "Elektrik Yükleri ve Elektrik Enerjisi" },
  ],
};
