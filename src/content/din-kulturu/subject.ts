import type { Subject } from "@/core/model";

export const dinKulturu: Subject = {
  id: "din-kulturu",
  name: "Din Kültürü ve Ahlak Bilgisi",
  shortName: "Din Kültürü",
  code: "dkab",
  grades: [5, 6, 7, 8],
  curriculumNote:
    "5, 6 ve 7. sınıf üniteleri Türkiye Yüzyılı Maarif Modeli'ne, 8. sınıf üniteleri 2026-2027 öğretim yılında okutulan programa göre düzenlenmiştir.",
  units: [
    { id: "dkab-5-1", grade: 5, order: 1, title: "Allah İnancı" },
    { id: "dkab-5-2", grade: 5, order: 2, title: "Namaz" },
    { id: "dkab-5-3", grade: 5, order: 3, title: "Kur'an-ı Kerim" },
    { id: "dkab-5-4", grade: 5, order: 4, title: "Peygamber Kıssaları" },
    { id: "dkab-5-5", grade: 5, order: 5, title: "Mimarimizde Dinî Motifler" },

    { id: "dkab-6-1", grade: 6, order: 1, title: "Peygamber ve İlahi Kitap İnancı" },
    { id: "dkab-6-2", grade: 6, order: 2, title: "Ramazan ve Oruç" },
    { id: "dkab-6-3", grade: 6, order: 3, title: "Ahlaki Davranışlar" },
    { id: "dkab-6-4", grade: 6, order: 4, title: "Peygamberliğinden Önce Hz. Muhammed" },
    { id: "dkab-6-5", grade: 6, order: 5, title: "Kültürümüzdeki Dinî Motifler" },

    { id: "dkab-7-1", grade: 7, order: 1, title: "Melek ve Ahiret İnancı" },
    { id: "dkab-7-2", grade: 7, order: 2, title: "Hac, Umre ve Kurban" },
    { id: "dkab-7-3", grade: 7, order: 3, title: "İslam Düşüncesinde Yorumlar" },
    { id: "dkab-7-4", grade: 7, order: 4, title: "Peygamber Olarak Hz. Muhammed" },
    { id: "dkab-7-5", grade: 7, order: 5, title: "Yaşayan Dünya Dinleri" },

    { id: "dkab-8-1", grade: 8, order: 1, title: "Kader İnancı" },
    { id: "dkab-8-2", grade: 8, order: 2, title: "Zekât ve Sadaka" },
    { id: "dkab-8-3", grade: 8, order: 3, title: "Din ve Hayat" },
    { id: "dkab-8-4", grade: 8, order: 4, title: "Hz. Muhammed'in Örnekliği" },
    { id: "dkab-8-5", grade: 8, order: 5, title: "Kur'an-ı Kerim ve Özellikleri" },
  ],
};
