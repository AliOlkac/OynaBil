# OynaBil

Ortaokul öğretmenlerinin akıllı tahtada sınıfı takımlara ayırıp **yarışarak ders işlediği** oyun platformu.
İlk ders: **Din Kültürü ve Ahlak Bilgisi** (5-8. sınıf, 20 ünite, 1.998 açıklamalı soru).

| Sınıf | Elle yazılan | Bilgi kartından | LGS tarzı paragraf | Toplam |
|---|---|---|---|---|
| 5 | 59 | 417 | | 476 |
| 6 | 60 | 418 | | 478 |
| 7 | 58 | 476 | | 534 |
| 8 | 59 | 404 | 47 | 510 |

- **Tek ekran:** Bütün oyun tahtada döner, öğrencilerin cihaz kullanmasına gerek yoktur.
- **Öğreten yarışma:** Her sorudan sonra tahtada kısa bir açıklama çıkar. Oyun sonunda sınıfın zorlandığı üniteler ve kimsenin bilemediği sorular listelenir.
- **Tekrar etmez:** Hangi sorunun hangi sınıfa ve şubeye sorulduğu hatırlanır. Yeni oyunda önce sorulmamış sorular gelir, aynı bilginin iki farklı sorusu aynı oyuna düşmez.
- **Hata bildirimi:** Öğretmen şüpheli bir soruyu oyunda ya da soru bankasında bir dokunuşla bildirir, isterse oyunlardan gizler. Bildirimler dosya olarak dışa aktarılıp içerik ekibine gönderilir.
- **İnternetsiz çalışır:** Tahtada bir kez açıldıktan sonra okul interneti kesilse de oyunlar çalışır.
- **Genişlemeye açık:** Dersler, üniteler, sorular ve oyunlar ayrı parçalardır; hepsi aynı soru havuzundan beslenir.

## Oyunlar

| Oyun | Takım | Nasıl oynanır |
|---|---|---|
| **Bilgi Yarışması** | 2-4 | Takımlar sırayla soru alır. Bilemeyen takımın sorusunu başka takım çalabilir. Her takımın birer kez yarı yarıya, +15 saniye ve pas jokeri vardır. Doğru cevapta puan şıktan skor kutusuna uçar; önde olan takımda taç, üst üste bilen takımda alev rozeti çıkar. 8. sınıfta LGS tarzı paragraf soruları karışık ya da tek başına seçilebilir: metin solda okunur, okumak için 20 saniye ek süre verilir, olumsuz soru kökü ("çıkarılamaz", "değildir") altı çizili gösterilir. |
| **Halat Çekme** | 2 | Tahta ikiye bölünür, iki öğrenci aynı anda kendi sorusunu çözer. Tahtanın üst yarısında çizimli bir halat çekme sahnesi vardır: doğru cevapta takım ipe asılır, yanlış cevapta buz kesilir. Kurdele bayrağa ulaşınca kaybeden takım çamura düşer, kazananlar sevinir. |
| **Kule Yıkmaca** | 2 | Her takımın bir kulesi ve önünde bir mancınığı vardır. İki takıma aynı soru sorulur; ilk bilen takım atış hakkı kazanır, yanlış cevap veren takımın mancınığı tutukluk yapar. Karşı kulenin önünde inip çıkan nişangâhı doğru anda durdurmak gerekir: pencere en çok, temel en az hasar verir. Her soruda değişen rüzgâr taşı yükseltir ya da alçaltır, zor soruyu bilen ateşli gülle atar. Kulesi yıkılan kaybeder; sorular biterse kazanan şeref atışıyla karşı kuleyi yıkar. |
| **Penaltı** | 2 | İki takıma aynı soru sorulur; ilk bilen takımın oyuncusu topun başına geçer. Şutçu topa dokunup parmağını kalede istediği yere sürükler ve bırakır. Bilgisayar kaleci üçte bir olasılıkla sola, ortaya ya da sağa atlar; topun gittiği köşeyi tutturursa ağır çekimde kurtarır, tutturamazsa ağ esner ve tribün coşar. Direğe ya da dışarıya giden şut gol olmaz. Eşitlikte seri penaltıya geçilir. |

Bilgi Yarışması'nı dizüstü bilgisayardan da yönetebilirsiniz: `A-D` ya da `1-4` cevap verir, `Enter` sonraki soruya geçer, `P` süreyi duraklatır. Kule Yıkmaca'da `Boşluk` ya da `Enter` mancınığı ateşler, Penaltı'da sayı tuşları (sayısal tuş takımı gibi, 7 sol üst, 3 sağ alt) şut çektirir.

Kule Yıkmaca ve Penaltı'da iki takıma aynı soru sorulur: iki öğrenci tahtada kendi yarısındaki şıklara aynı anda dokunabilir, şıklar iki tarafta farklı sırayla dizilir. Bu iki oyunda yalnızca çoktan seçmeli sorular kullanılır; doğru/yanlış sorusunda bir takımın yanlış cevabı görülünce doğrusu belli olurdu. Atıştan sonra sıradaki soruya kendiliğinden geçilir; öğretmen geçişi durdurup konuyu anlatabilir.

## Çalıştırma

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # oyun mantığı, bilgi kartları ve bütün soruların doğrulaması
npm run build      # durağan site out/ klasörüne, service worker ile birlikte
```

`out/` klasörü herhangi bir durağan barındırmaya (Cloudflare Pages, Vercel, Netlify, okul sunucusu) olduğu gibi yüklenebilir.

## Yayına alma (Vercel)

Vercel ayarları `vercel.json` dosyasında hazır: kurulum `npm ci`, derleme `npm run build`, yayınlanan klasör `out/`. Service worker önbelleğe alınmaz, derleme dosyaları ise kalıcı önbelleğe alınır.

1. [vercel.com/new](https://vercel.com/new) adresinde GitHub hesabıyla giriş yapın.
2. **Import Git Repository** listesinden `AliOlkac/OynaBil` deposunu seçin.
3. Ayarları değiştirmeden **Deploy** deyin.

Bundan sonra depoya yapılan her push siteyi kendiliğinden günceller. Varsayılan daldan canlı sürüm, diğer dallardan önizleme bağlantısı üretilir.

## Klasörler

```
src/
  content/                 Veri havuzu: dersler, üniteler, sorular (JSON)
    din-kulturu/subject.ts   üniteler
    din-kulturu/sorular/     5.json … 8.json elle yazılan sorular, 8-lgs.json paragraf soruları
    din-kulturu/kartlar/     5.json … 8.json bilgi kartları (soruya dönüştürülür)
  core/                    Soru modeli (zod), bilgi kartı motoru, deste kurucu, soru deposu
  lib/                     Ses, hareket belirteçleri, sorulanlar hafızası, hata bildirimleri
  games/                   Oyunlar: her biri saf bir oyun mantığı (logic.ts) + tahta ekranı (Game.tsx)
    registry.ts              oyun tanımları ve ayarları
  components/              Ortak arayüz: düğmeler, takım amblemleri, oyun çerçevesi, sonuç ekranı
  app/                     Sayfalar: ana sayfa, /kurulum, /oyun/[oyun], /sorular
docs/                      Mimari, tasarım sistemi, içerik kontrol listesi
scripts/                   Service worker üretimi, LGS soru üretim hattı (lgs-uret.ts)
```

## Ekleme rehberi

**Soru eklemek:** Üç yol var. Her değişiklikten sonra `npm test` çalıştırın; şema `src/core/model.ts` ve `src/core/cards.ts` içindedir.

1. **Bilgi kartı (en verimlisi):** `src/content/<ders>/kartlar/<sınıf>.json` dosyasına bir kart kümesi ekleyin. Bir kez doğrulanan bilgi, birden çok soruya dönüşür. Örneğin kitap-peygamber eşleşmesinin her satırı iki çoktan seçmeli soru, bir doğru ve bir yanlış önerme üretir. Çeldiriciler aynı kümenin diğer satırlarından gelir ve sorular her derlemede aynı kimlikle üretilir. İki küme türü vardır:
   - `pairs`: eşleşen bilgiler (kitap ↔ peygamber, kavram ↔ tanım).
   - `list`: bir gruba girenler ve girmeyenler (namazın farzları, orucu bozanlar).
2. **Elle soru:** `src/content/<ders>/sorular/<sınıf>.json`. Kartla anlatılamayan, yorum isteyen sorular için.
3. **LGS tarzı paragraf sorusu:** `sorular/<sınıf>-lgs.json`. Elle yazılabilir ya da üretim hattıyla hazırlanabilir:

   ```bash
   export ANTHROPIC_API_KEY=...                           # ya da: ant auth login
   npm run sorular:lgs -- --sinif 8 --kuru                # istemleri gösterir, API'yi çağırmaz
   npm run sorular:lgs -- --sinif 8 --unite dkab-8-2 --adet 6
   npm run sorular:lgs -- --sinif 8 --dogrula             # mevcut soruları körlemesine çözdürür
   ```

   Hat her ünite için soruları yazdırır, şemaya ve mevcut sorulara benzerliğe karşı denetler, sonra ikinci bir çağrıda cevap anahtarını göstermeden çözdürür. Cevabı tutan ve sorunsuz bulunan sorular dosyaya eklenir; diğerleri gerekçesiyle `icerik-inceleme/` klasörüne yazılır. Çalıştırma ücretlidir: ünite başına bir üretim ve bir doğrulama çağrısı yapılır.

Öğretmenler soruları uygulama içinden de ekleyebilir (**Soru bankası > Soru ekle**). Bu sorular tarayıcıda saklanır, dışa ve içe aktarılabilir.

**Ders eklemek:** `src/content/<ders>/subject.ts` ile üniteleri tanımlayın, `sorular/` ve `kartlar/` klasörlerine JSON dosyalarını koyun, ardından `src/content/index.ts` içinde dersi `SUBJECTS` listesine, dosyalarını `CONTENT_FILES` tablosuna ekleyin. Her sınıfın dosyaları ayrı yüklenir; tahta yalnızca seçilen sınıfı indirir.

**Oyun eklemek:** `src/games/<oyun>/logic.ts` (saf reducer) ve `Game.tsx` (tahta ekranı) dosyalarını yazın. Sonra tanımı `src/games/registry.ts`, ekranı `src/games/screens.ts` içine ekleyin. Kurulum ekranı, ayarlar ve soru havuzu bağlantısı kendiliğinden çalışır. Ayrıntılar: [docs/MIMARI.md](docs/MIMARI.md).

## İçerik notu

Sorular MEB Din Kültürü ve Ahlak Bilgisi programının ünite yapısına göre yazıldı. 5, 6 ve 7. sınıflar Türkiye Yüzyılı Maarif Modeli'ne, 8. sınıf 2026-2027'de okutulan programa göre düzenlendi.
Bilgi kartları ve LGS soruları yazıldıktan sonra üretilen her soru okunarak gözden geçirildi; LGS soruları ayrıca cevap anahtarı gösterilmeden bağımsız olarak çözdürüldü (47 sorunun 47'sinde aynı cevap bulundu).
Sınıfta kullanmadan önce bir branş öğretmeninin gözden geçirmesi önerilir. Özellikle bakılması gereken sorular ve kart kümeleri: [docs/ICERIK-KONTROLU.md](docs/ICERIK-KONTROLU.md). Sınıfta fark edilen hatalar **Hata bildir** ile kaydedilir ve soru bankasından dışa aktarılır.
