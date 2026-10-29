# Tasarım sistemi

Kod tarafındaki karşılıkları: `src/app/globals.css` (renk, yazı, süre belirteçleri) ve `src/lib/motion.ts` (animasyon belirteçleri).

## Tezler

**Görsel tez:** Ekran, 8 metreden okunacak bir akıllı tahta için tasarlandı.
- **Zemin:** İznik çinisinin lacivertidir. Tahtada parlamaz ve takım renkleri üzerinde öne çıkar.
- **Vurgular:** Çini paletinden gelir: firuze, kehribar, mercan, zümrüt, kobalt.
- **Yazı:** Tek aile, Lexend. Okuma akıcılığı için tasarlanmış, geniş harfli bir yazı tipidir ve Türkçe karakterlerin tamamını taşır. Başlık ve sorular 700 kalınlıkta, metin 400 kalınlıktadır.
- **Bileşenler:** Yuvarlak köşeli ve dolgulu, gölge yerine ışıklı üst kenar kullanır. Basılabilir düğmelerin alt kenarı vardır.
- **Aralık:** Kurulum ekranlarında ferahtır. Oyun ekranında ise içerik tahtayı doldurur.

**Hareket tezi:**
- **Hız:** Arayüz hızlı ve kurudur (150-250 ms, `ease-out`). Yaylı taşma yalnızca kutlama anlarında (puan artışı, doğru cevap, geri sayım) ve ipin çekilmesinde vardır.
- **Basma:** Dokunulan düğme 6 px aşağı çöker. Tahtada titreşim olmadığı için dokunuşun alındığını sınıfın arkasından görmek gerekir.
- **Kaydırma:** Kaydırmaya bağlı animasyon yoktur. Oyun ekranları tek ekrandır.
- **Yasak:** Sonsuz döngü, parlama/neon, cam efekti ve paralaks kullanılmaz.

**Bilinçli kalıplar:**
- **Girih deseni:** Selçuklu sekiz köşeli yıldızından örülür ve kurulum ile giriş ekranlarında %4-7 opaklıkla kenarlara doğru belirginleşir. 5. ve 6. sınıf müfredatı dinî motifleri işlediği için dersin kimliğidir.
- **Takım amblemleri:** Yıldız, altıgen, daire ve baklava şekilleri renk körlüğü için renkle birlikte kullanılır.
- **Sayaç halkası:** Gerçek bir süreyi gösterir.
- **Konfeti:** Yalnızca kazanan ekranında, kazanan takımın rengiyle atılır.
- **Ünite doğruluk çubukları:** Sonuç ekranında ölçülen doğru/toplam oranını gösterir.

## Renkler

| Belirteç | Değer | Kullanım |
|---|---|---|
| `ink-950` | `#071228` | En koyu zemin, açık renk düğmelerin üstündeki yazı |
| `ink-900` | `#0c1b3a` | Sayfa zemini |
| `ink-850` | `#10234a` | Panel |
| `ink-800` | `#162d5c` | Kart, cevap kutusu |
| `ink-700` | `#213f78` | İkincil düğme, seçili satır |
| `ink-400` | `#8aa0c8` | Soluk metin |
| `ink-300` | `#b3c3e0` | Yardımcı metin |
| `cream` | `#fbf5e9` | Ana metin |
| `firuze` | `#3ccbc2` | Seçim, odak halkası, marka |
| `kehribar` | `#ffc23d` | Ana eylem (Başla, Sonraki) |
| `zumrut` | `#34c784` | Doğru cevap, Yeşil Takım |
| `mercan` | `#ff6b4f` | Yanlış cevap, Kırmızı Takım |
| `kobalt` | `#5a96ff` | Mavi Takım |

Her rengin `-deep` tonu, basılabilir düğmenin alt kenarıdır.

**Kontrast (WCAG):**

| Renk çifti | Oran |
|---|---|
| cream / ink-900 | 15,7 |
| ink-300 / ink-900 | 9,6 |
| ink-400 / ink-800 | 5,1 |
| ink-950 / kehribar | 11,6 |
| ink-950 / zümrüt | 8,6 |
| ink-950 / mercan | 6,6 |
| kobalt / ink-850 | 5,3 |
| mercan / ink-850 | 5,5 |

Hepsi 4,5 eşiğinin üzerindedir.

## Yazı ölçeği

Kök boyut ekrana göre ölçeklenir: 1920x1080 tahtada 20 px, 1366x768 tahtada yaklaşık 14 px. Telefonda 15 px'in altına inmez.

| Sınıf | rem | 1080p'de |
|---|---|---|
| `text-base` | 1 | 20 px |
| `text-xl` | 1.5 | 30 px |
| `text-2xl` | 2 | 40 px |
| `text-3xl` | 2.5 | 50 px (cevap şıkları) |
| `text-4xl` | 3.25 | 65 px (orta uzunlukta soru) |
| `text-5xl` | 4.25 | 85 px (kısa soru) |
| `text-6xl` | 5.5 | 110 px (oyun adı) |

## Hareket belirteçleri

| Ad | Değer | Nerede |
|---|---|---|
| `dur.fast` / `--dur-fast` | 150 ms | Örtü açılışı, kısa geçişler |
| `dur.base` / `--dur-base` | 250 ms | Soru girişi, alt çubuk değişimi, renk geçişi |
| `dur.slow` / `--dur-slow` | 400 ms | Başlık girişi, doğru/yanlış vurgusu |
| `ease` | `cubic-bezier(0.22, 1, 0.36, 1)` | Bütün süreli geçişler |
| `spring.ui` | 420 / 36 | Seçim zemini, anahtar, pencere |
| `spring.enter` | 320 / 30 | Takım ve sıralama satırları |
| `spring.celebrate` | 400 / 18 | Puan, doğru rozeti, geri sayım |
| `spring.rope` | 160 / 16 | İp |

`prefers-reduced-motion` açıkken bütün geçişler 1 ms'ye iner ve konfeti atılmaz.
