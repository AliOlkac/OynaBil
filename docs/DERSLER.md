# Ders videoları

Her konu, sesli anlatımlı ve canlandırmalı kısa bir derstir (`/dersler`). Ders sitenin içinde oynar:
sahneler sırayla gelir, anlatıcı konuşur, altyazıda o an okunan kelime vurgulanır. Video dosyası
yoktur; bir ders yaklaşık 2-3 dakikalık anlatım ve 700-900 KB sestir, tahtada ve telefonda
çevrimdışı da oynar.

## Akış (Türkiye Yüzyılı Maarif Modeli)

Her ders aynı öğrenme yaşantısını izler ve sahneler aşamasıyla etiketlenir:

| Aşama | Ne yapılır |
|---|---|
| Başlıyoruz (`giris`) | Konunun adı |
| Merak et (`merak`) | Günlük hayattan bir soru ya da durumla merak uyandırılır |
| Keşfet (`kesfet`) | Örnekler, gözlem, benzetme |
| Öğren (`ogren`) | Kavramlar, ayetlerin anlamları |
| Hayatla bağ kur (`hayat`) | Öğrenilenin davranışa ve günlük hayata yansıması |
| Kendini dene (`dene`) | Oynatıcı durur, öğrenci cevabını seçer (6 sn), doğru cevap anlatılır |
| Özetle (`ozet`) | Öğrenilenler maddeler hâlinde |

Testler her dersin girişle başlayıp özetle bittiğini, bir merak ve bir kendini dene sahnesi içerdiğini denetler.

## İçerik kuralları

- Dil, sınıf düzeyine uygun, kısa cümlelerle; öğrenciye "sen" diye seslenilir.
- Bilgiler ders kitabı ve soru bankasıyla tutarlıdır (aynı tanımlar, aynı Esmâ-i Hüsnâ anlamları).
- Ayetler meal olarak, kaynağıyla (sure ve ayet numarası) verilir; yalnızca yaygın meallerle örtüşen ifadeler kullanılır.
- Sure okunuşu ekranda yazılı gösterilir, yapay sesle okutulmaz; öğrenci öğretmeniyle okumaya yönlendirilir.
- **Allah, peygamberler ve melekler hiçbir zaman resmedilmez.** Çizimler doğa, gök, mimari ve çocuk karakterlerdir.

## Dosyalar

- `src/content/<ders>/dersler/<sınıf>.json`: dersler ve sahneleri (şema: `src/lessons/model.ts`).
- `src/content/<ders>/dersler/<sınıf>.ses.json`: her ses dosyasının süresi ve kelime zamanları (betik yazar).
- `public/ses/dersler/<ders kimliği>/<ad>.mp3`: anlatım; `<ad>` sahne sırasıdır (`dkab-5-1-d1-03`), test cevabı `-cevap` ekiyle.
- `src/lessons/`: oynatıcı (`LessonPlayer.tsx`), sahne görselleri (`visuals.tsx`), çizimler (`illustrations.tsx`).

Sahne görsel türleri: `kapak`, `sahne` (çizim: `gece`, `doga`, `cocuklar`, `sofra`, `kitap`, `cami`), `kavram`,
`liste`, `kartlar`, `ayet`, `test`, `ozet`. Listeler, kartlar ve ayet satırları anlatım ilerledikçe sırayla açılır.

## Yeni ders eklemek

1. Dersi `src/content/<ders>/dersler/<sınıf>.json` dosyasına yazın (yeni sınıf dosyasıysa `src/lessons/index.ts` içindeki `SOURCES` listesine ekleyin).
2. Anlatımları Ses Atölyesi ile seslendirin: her sahnenin `say` metni `<ders kimliği>-<sıra>` adıyla, test cevabı (`reveal`) `-cevap` ekiyle. Ses: "Amelia - Warm, Friendly and Articulate" (`1Iy00CVh3yqYLlZBmEFo`), `eleven_v4_turbo`, kararlılık 0.55.
3. Sesleri siteye hazırlayın:

   ```bash
   node scripts/dersleri-hazirla.mjs <ses deposu>/jobs/<iş adı> <ders klasörü> <sınıf>
   ```

   Betik sesleri tek kanala indirir, düzeyini eşitler, 48 kb/sn mp3 yazar ve kelime zamanlarını `<sınıf>.ses.json` dosyasına ekler. Baştaki sessizliği kırpmaz; kelime zamanları dosyanın başına göredir.
4. `npm test` her anlatımın ses dosyasını ve zamanlarını denetler.

Ses dosyası bulunamazsa sahne okuma süresi kadar sessiz oynar, altyazı yine akar.

## Şu an olan dersler

- Din Kültürü ve Ahlak Bilgisi, 5. sınıf, 1. ünite "Allah İnancı": Allah'ın Varlığı ve Birliği; Allah'ın Güzel İsimleri; Allah'ı Anmak ve Dua; İhlas Suresi ve Anlamı.
