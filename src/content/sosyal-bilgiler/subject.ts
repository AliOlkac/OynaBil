import type { Subject } from "@/core/model";

export const sosyalBilgiler: Subject = {
  id: "sosyal-bilgiler",
  name: "Sosyal Bilgiler",
  shortName: "Sosyal",
  code: "sos",
  grades: [4, 5, 6, 7],
  curriculumNote:
    "5, 6 ve 7. sınıf üniteleri Türkiye Yüzyılı Maarif Modeli Sosyal Bilgiler programının öğrenme alanlarına, 4. sınıf üniteleri 2026-2027 öğretim yılında okutulan 2018 programının öğrenme alanlarına göre düzenlenmiştir.",
  units: [
    { id: "sos-4-1", grade: 4, order: 1, title: "Birey ve Toplum" },
    { id: "sos-4-2", grade: 4, order: 2, title: "Kültür ve Miras" },
    { id: "sos-4-3", grade: 4, order: 3, title: "İnsanlar, Yerler ve Çevreler" },
    { id: "sos-4-4", grade: 4, order: 4, title: "Bilim, Teknoloji ve Toplum" },
    { id: "sos-4-5", grade: 4, order: 5, title: "Üretim, Dağıtım ve Tüketim" },
    { id: "sos-4-6", grade: 4, order: 6, title: "Etkin Vatandaşlık" },
    { id: "sos-4-7", grade: 4, order: 7, title: "Küresel Bağlantılar" },

    { id: "sos-5-1", grade: 5, order: 1, title: "Birlikte Yaşamak" },
    { id: "sos-5-2", grade: 5, order: 2, title: "Evimiz Dünya" },
    { id: "sos-5-3", grade: 5, order: 3, title: "Ortak Mirasımız" },
    { id: "sos-5-4", grade: 5, order: 4, title: "Yaşayan Demokrasimiz" },
    { id: "sos-5-5", grade: 5, order: 5, title: "Hayatımızdaki Ekonomi" },
    { id: "sos-5-6", grade: 5, order: 6, title: "Teknoloji ve Sosyal Bilimler" },

    { id: "sos-6-1", grade: 6, order: 1, title: "Birlikte Yaşamak" },
    { id: "sos-6-2", grade: 6, order: 2, title: "Evimiz Dünya" },
    { id: "sos-6-3", grade: 6, order: 3, title: "Ortak Mirasımız" },
    { id: "sos-6-4", grade: 6, order: 4, title: "Yaşayan Demokrasimiz" },
    { id: "sos-6-5", grade: 6, order: 5, title: "Hayatımızdaki Ekonomi" },
    { id: "sos-6-6", grade: 6, order: 6, title: "Teknoloji ve Sosyal Bilimler" },

    { id: "sos-7-1", grade: 7, order: 1, title: "Birlikte Yaşamak" },
    { id: "sos-7-2", grade: 7, order: 2, title: "Evimiz Dünya" },
    { id: "sos-7-3", grade: 7, order: 3, title: "Ortak Mirasımız" },
    { id: "sos-7-4", grade: 7, order: 4, title: "Yaşayan Demokrasimiz" },
    { id: "sos-7-5", grade: 7, order: 5, title: "Hayatımızdaki Ekonomi" },
    { id: "sos-7-6", grade: 7, order: 6, title: "Teknoloji ve Sosyal Bilimler" },
  ],
};
