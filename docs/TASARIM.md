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
- **LGS paragraf ekranı:** Metin solda kendi kutusunda okunur. Soru kökü, sayaç ve şıklar sağda birlikte durur, böylece göz kökten şıklara kısa yoldan gider. Metin 320 karakteri geçince yazı bir kademe küçülür (40 px'ten 30 px'e). Tahtaya yine sığmazsa yalnızca metin kutusu kayar, ekran kaymaz. Telefonda metin, kök ve şıklar alt alta dizilir.
- **LGS işaretleri:**
  - Paragraf sorusunun kehribar renkli "LGS tarzı" rozeti vardır.
  - Olumsuz soru kökü ("değildir", "çıkarılamaz") mercan renkte ve altı çizili gösterilir. LGS'deki altı çizili yazımın tahtadaki karşılığıdır.
- **Hata bildir:** Açıklama çubuğunda sessiz bir düğmedir, oyunun akışını bölmez. Pencerede altı hata türü büyük dokunma alanlarıyla sunulur; not isteğe bağlıdır.
- **Halat Çekme sahnesi:** Okul şenliği akşamı. Gökyüzü, yıldızlar ve tepeler sahne dekorudur. Takım renklerinde bayrak dizisi takım yanlarını gösterir. Saha, çamur havuzu ve kazanma bayrakları kuralı görünür kılar.
- **Sahnedeki sürekli hareket:** Çekişme sürerken çocukların hafif zorlanma salınımı vardır. Bu, canlı bir durumu gösterdiği için sonsuz döngü yasağının tek istisnasıdır ve oyun bitince durur. Kamera ipi hafifçe izler, tepeler daha yavaş kayar.
- **Kule Yıkmaca sahnesi:**
  - Gün batımında iki taş kule. Gövde taş örgüdür, üst gövdede İznik çinisinden bir kuşak geçer, burç mazgallıdır, külah takım renginde kiremitlidir.
  - Pencere içeriden kandille aydınlanır. En değerli hedef olduğu için uzaktan seçilir.
  - Ahşap mancınıkların başında iki çocuk durur: biri vinci çevirip taşı yükler, öteki karşı kuleyi gösterir. Çocuklar Halat Çekme'dekilerle aynı karakter tasarımını paylaşır (`src/games/shared/kid.tsx`).
- **Nişangâh ve hasar cetveli:** Nişan anında hedef kulenin önünde takım renginde bir nişangâh inip çıkar. Kesikli çizgi kuleyi boydan boya geçer ve kulenin dış yanındaki cetvele ulaşır. Cetvel her yüksekliğin kaç hasar verdiğini yazar; pencere bandı kehribar renkle işaretlidir. Kural ekranda görünür, öğrenci ezberlemek zorunda kalmaz.
- **Kule sağlamlık çubukları:**
  - Hasar önce takım rengindeki çubuktan düşer. Arkasındaki krem iz yarım saniye sonra yetişir, böylece kaybedilen parça bir an görünür kalır.
  - Can 30'un altına inince çubuk mercana döner.
  - Soru sırasında çubuklar küçülür ki kuleleri örtmesin.
- **Kamera:** Soru sırasında iki kule geniş çerçevede durur. Nişan ve atışta sahne büyür (`--dur-scene`). Kamera isabet anında vurulan kuleye yaklaşır ve sarsılır, yıkılışta yıkılan kuleyi izler.
- **Rüzgâr:** Bulutlar ve bayraklar rüzgârın yönünde ve şiddetinde hareket eder. Bu sürekli hareket oyun bilgisi taşıdığı için sonsuz döngü yasağının ikinci istisnasıdır.
- **Oyun anı efektleri:**
  - Toz, ter damlası ve çamur sıçraması parçacıkları.
  - Yanlış cevapta buz kalıbı ve titreme.
  - Doğru şıktan konfeti patlaması.
  - Skor kutusuna uçan puan.
  - "ÇALDI!" damgası.
  - Önde olan takımda taç, üst üste doğrularda alev rozeti.
  - Sonuç ekranında yükselen kürsü.
  - Kule Yıkmaca'da:
    - Mancınık kurulur ve vinç döner. Taş yığından alınıp kepçeye konur. Kol kasnağa çarpıp sekerken mancınık geri teper.
    - Taş iz bırakarak uçar, yerde gölgesi gezer. Ateşli güllenin alev kuyruğu vardır.
    - Karşı ekip taş üstünden geçerken başını korur.
    - İsabette taş kırıkları saçılır, toz kalkar, çatlaklar belirir. Mazgallar düşer, külah eğilir, pencere kırılır.
    - Kritik vuruşta kehribar bir halka açılır ve hasar yazısı yaylanarak yükselir.
    - Yanlış cevapta mancınık tutukluk yapar: kol boşa çıkar, taş mancınığın önüne düşer, vinçten duman çıkar.
    - Yıkılışta kule katları sırayla çöker. Toz bulutunun içinden kırık bayraklı bir moloz yığını çıkar. Kazananlar zıplayıp sevinir, kaybedenler çöker.

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

**Halat Çekme sahnesi:**

| Belirteç | Değer | Kullanım |
|---|---|---|
| `saha` / `saha-acik` | `#23603f` / `#2b6f49` | Çim ve çim şeritleri |
| `camur` / `camur-koyu` / `camur-parlak` | `#6b4527` / `#3f2715` / `#9a6a3f` | Çamur havuzu, kenarı, parlaması |
| `ip` / `ip-koyu` | `#d6ab66` / `#a67a3a` | İp ve örgü deseni |

**Kule Yıkmaca sahnesi:**

| Belirteç | Değer | Kullanım |
|---|---|---|
| `ufuk` / `ufuk-acik` | `#f0a35e` / `#ffd9a3` | Gün batımı ufku, güneş, kandil ışığı |
| `tas` / `tas-acik` / `tas-koyu` | `#a3937c` / `#cdbb9b` / `#6f6353` | Kule taşları; ışık sahnenin ortasından vurur |
| `tas-derz` | `#4d4438` | Taş derzleri, çatlaklar |
| `ahsap` / `ahsap-acik` / `ahsap-koyu` | `#8f5c33` / `#b97d47` / `#5a381d` | Mancınık, kapı, kepenk çerçevesi |
| `ates` | `#ff8a2a` | Ateşli gülle, alev, "Zor soru" işareti |
| `toz` | `#d9c7a5` | Toz bulutu |
| `servi` | `#173a2c` | Tepelerdeki serviler |

Çocukların ten, saç ve kıyafet renkleri iki sahnenin paylaştığı sabit bir listedir (`src/games/shared/kid.tsx`).

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
| `spring.impact` | 520 / 22 | Kule sağlamlık çubuğunun düşmesi |
| `dur.scene` / `--dur-scene` | 600 ms | Kule Yıkmaca'da sahnenin büyüyüp küçülmesi |

`prefers-reduced-motion` açıkken:
- bütün geçişler 1 ms'ye iner,
- konfeti, puan uçuşu ve parçacıklar kapanır,
- halat sahnesinde salınım ve titreme durur, ama ipin konumu ve bitiş pozları yine gösterilir,
- Kule Yıkmaca'da:
  - Parçacıklar, kamera sarsıntısı ve bulut kayması kapanır. Kamera kaymadan doğrudan yerine geçer.
  - Kule katlar hâlinde çökmez, solup moloza dönüşür.
  - Nişangâh oyunun parçası olduğu için hareket etmeye devam eder.
