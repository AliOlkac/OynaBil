# OynaBil

Ortaokul öğretmenlerinin akıllı tahtada sınıfı takımlara ayırıp **yarışarak ders işlediği** oyun platformu.
İlk ders: **Din Kültürü ve Ahlak Bilgisi** (5-8. sınıf, 20 ünite, 240 açıklamalı soru).

- **Tek ekran:** Bütün oyun tahtada döner, öğrencilerin cihaz kullanmasına gerek yoktur.
- **Öğreten yarışma:** Her sorudan sonra tahtada kısa bir açıklama çıkar. Oyun sonunda sınıfın zorlandığı üniteler ve kimsenin bilemediği sorular listelenir.
- **İnternetsiz çalışır:** Tahtada bir kez açıldıktan sonra okul interneti kesilse de oyunlar çalışır.
- **Genişlemeye açık:** Dersler, üniteler, sorular ve oyunlar ayrı parçalardır; hepsi aynı soru havuzundan beslenir.

## Oyunlar

| Oyun | Takım | Nasıl oynanır |
|---|---|---|
| **Bilgi Yarışması** | 2-4 | Takımlar sırayla soru alır. Bilemeyen takımın sorusunu başka takım çalabilir. Her takımın birer kez yarı yarıya, +15 saniye ve pas jokeri vardır. |
| **Halat Çekme** | 2 | Tahta ikiye bölünür, iki öğrenci aynı anda kendi sorusunu çözer. Doğru cevap ipi bir adım kendi tarafına çeker, yanlış cevap o tarafı kısa süre dondurur. |

Bilgi Yarışması'nı dizüstü bilgisayardan da yönetebilirsiniz: `A-D` ya da `1-4` cevap verir, `Enter` sonraki soruya geçer, `P` süreyi duraklatır.

## Çalıştırma

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # oyun mantığı ve 240 sorunun doğrulaması
npm run build      # durağan site out/ klasörüne, service worker ile birlikte
```

`out/` klasörü herhangi bir durağan barındırmaya (Cloudflare Pages, Vercel, Netlify, okul sunucusu) olduğu gibi yüklenebilir.

## Klasörler

```
src/
  content/                 Veri havuzu: dersler, üniteler, sorular (JSON)
    din-kulturu/subject.ts   üniteler
    din-kulturu/sorular/     5.json 6.json 7.json 8.json
  core/                    Soru modeli (zod), deste kurucu, soru deposu
  games/                   Oyunlar: her biri saf bir oyun mantığı (logic.ts) + tahta ekranı (Game.tsx)
    registry.ts              oyun tanımları ve ayarları
  components/              Ortak arayüz: düğmeler, takım amblemleri, oyun çerçevesi, sonuç ekranı
  app/                     Sayfalar: ana sayfa, /kurulum, /oyun/[oyun], /sorular
docs/                      Mimari, tasarım sistemi, içerik kontrol listesi
scripts/                   Derleme sonrası service worker üretimi
```

## Ekleme rehberi

**Soru eklemek:** `src/content/din-kulturu/sorular/<sınıf>.json` dosyasına ekleyin, sonra `npm test` ile doğrulayın. Şema: `src/core/model.ts`.
Öğretmenler soruları uygulama içinden de ekleyebilir (**Soru bankası > Soru ekle**). Bu sorular tarayıcıda saklanır, dışa ve içe aktarılabilir.

**Ders eklemek:** `src/content/<ders>/subject.ts` ile üniteleri tanımlayın, `sorular/` klasörüne JSON dosyalarını koyun, ardından `src/content/index.ts` içine iki satır ekleyin.

**Oyun eklemek:** `src/games/<oyun>/logic.ts` (saf reducer) ve `Game.tsx` (tahta ekranı) dosyalarını yazın. Sonra tanımı `src/games/registry.ts`, ekranı `src/games/screens.ts` içine ekleyin. Kurulum ekranı, ayarlar ve soru havuzu bağlantısı kendiliğinden çalışır. Ayrıntılar: [docs/MIMARI.md](docs/MIMARI.md).

## İçerik notu

Sorular MEB Din Kültürü ve Ahlak Bilgisi programının ünite yapısına göre yazıldı. 5, 6 ve 7. sınıflar Türkiye Yüzyılı Maarif Modeli'ne, 8. sınıf 2026-2027'de okutulan programa göre düzenlendi.
Sınıfta kullanmadan önce bir branş öğretmeninin gözden geçirmesi önerilir. Özellikle bakılması gereken sorular: [docs/ICERIK-KONTROLU.md](docs/ICERIK-KONTROLU.md).
