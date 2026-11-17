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
- **Kamera:** Kuleler sahanın iki ucundadır, taş uzun bir yay çizer.
  - Soru sırasında iki kule geniş çerçevede durur.
  - Doğru cevapta sahne büyür (`--dur-scene`). Kamera önce mancınığını kuran takıma, sonra hedef kuleye yaklaşır; nişangâh ve cetvel büyük görünür.
  - ATEŞ'te kamera bütün sahayı gösterir. İsabet anında vurulan kuleye yaklaşıp sarsılır, yıkılışta yıkılan kuleyi izler.
  - Telefonda yakın planlar daha da daralır.
- **Rüzgâr:** Bulutlar ve bayraklar rüzgârın yönünde ve şiddetinde hareket eder. Bu sürekli hareket oyun bilgisi taşıdığı için sonsuz döngü yasağının ikinci istisnasıdır.
- **Penaltı'da sürekli hareket:** Kaleci şut beklerken parmak uçlarında yaylanır, taraftarlar golden sonra birkaç saniye zıplar. İkisi de canlı bir durumu gösterir ve durum bitince durur. Üç boyutlu sahnede panolardaki yazı, bayraklar ve tribündeki flaşlar da yalnızca şut anında hareket eder; soru sırasında sahne durgundur, çünkü öğrenciler soruyu okur.
- **Düello sorusu:**
  - Soru bir kez, ortada yazılır. İki takımın şıkları kendi yarısında, kendi renginde ve farklı sırayla durur.
  - Yanlış cevap veren tarafın şıkları kum saatiyle kapanır ("Rakibini bekle"). Hangi şıkkı seçtiği karar anına kadar gösterilmez.
  - İlk bilen tarafın paneli takım rengiyle çerçevelenir.
- **Otomatik geçiş:**
  - Atıştan ya da açıklamadan sonra devam düğmesi yerine dolan bir çubuk gelir (Kule Yıkmaca, Penaltı).
  - Çubuğun yanında iki düğme vardır: "Bekle" geçişi durdurur, "Geç" hemen geçer.
- **Penaltı sahnesi (üç boyutlu):**
  - Gece maçı, gerçek ölçülerinde bir kale (7,32 x 2,44 m). Çim 5,5 metrelik biçim şeritleriyle çizgilidir; kale arkasında ve yanlarda iki takımın renklerinde taraftarlarla dolu tribünler, "OYNABİL" ve "BİLEN ATAR" yazan LED panolar, projektör kuleleri vardır.
  - Karakterler iri başlı, oyuncak gibi çocuklardır; Halat Çekme ve Kule Yıkmaca'daki çocukların üç boyutlu hâlidir (aynı ten, saç ve kıyafet renkleri). Kalecinin forması iki takımın renginden farklı seçilir.
  - Soru sırasında kamera alçaktan kaleye bakar; iki şutçu ön planda, sırtları dönük bekler. Hak kazanan topun başına yürür, sahne büyür ve kamera yükselip kalenin tamamını gösterir.
  - Şutçu parmağını sürüklerken hedefte takım renginde bir halka, toptan hedefe noktalı bir yol görünür. Yol, topun gerçekten izleyeceği falsolu yoldur. Hedef kalenin dışındaysa halka gri olur.
  - Şutla birlikte kamera topun peşinden kaleye yaklaşır. Uçan topun arkasında kısa bir iz kalır.
  - Kurtarışta kaleci topun gittiği yere uçar, zaman kısa bir an yavaşlar, eldivenlerde kehribar bir parlama açılır ve top sahaya seker. Ortaya gelen topu kaleci göğsünde tutar.
  - Golde ağ topun çarptığı yerde esner, top ağın dibine düşer. Takım renginde konfeti atılır, o takımın tribünü zıplar, panolar takım renginde "GOOOL!" yazar.
  - Direkte kale titrer ve top geri seker. Auta giden top panoya çarpar ya da tribüne gider.
  - **Tekrar:** Gol, kurtarış ve direk, sonuç kartı okunurken başka bir kameradan ağır çekimde yeniden oynar. Gol ağın arkasından, kurtarış kalecinin uçtuğu yandan alçaktan gösterilir. Köşede "TEKRAR" etiketi durur.
  - Sonuç sahnenin altında büyük harflerle yazılır: GOL!, KURTARDI!, DİREK!, AUT!. Oyun bitince kamera kazanan şutçunun çevresinde döner.
  - **Ses:** Türkçe bir spiker gol, kurtarış, direk ve autu duyurur; tribün uğuldar, golde coşar (bkz. `docs/SESLER.md`).
- **Halat Çekme sahnesi (üç boyutlu):** Akşam vakti bir okul şenliği: çayır, flamalar, ortada çamur havuzu, iki yanda takım renginde çizgi ve bayrak. Dörder çocuk ipe asılır; doğru cevapta takım geriye yaslanıp çeker ve ayaklarından toz kalkar, yanlışta çocuklar buz kalıbının içinde kalır. Kurdele çizgiye ulaşınca kaybedenler çamura kapaklanır ve çamur sıçrar; kazananlar ip boşalınca geriye devrilir, sonra kalkıp zıplayarak sevinir. Berabere bitişte ip ortadan kopar. Çizim yedeği aynı sahnenin SVG hâlidir.
- **Kule Yıkmaca sahnesi (üç boyutlu):**
  - Gün batımı: ufukta güneş, sıra sıra tepeler, serviler ve çayır. İki kule sahanın iki ucunda, mancınıklar kulelerinin önündedir.
  - Kuleler taş taş örülüdür: geniş temel, gövde, çini kuşak, mazgallı burç ve takım renginde kiremitli külah. Pencereler içeriden aydınlıktır, kepenkler takım rengindedir.
  - İsabet alan yerin taşları yerinden fırlar ve kulenin dibine yığılır; arkada karanlık dolgu görünür. Pencereye isabet camı ve kepenkleri dağıtır, burca isabet mazgalları düşürür, külaha isabet külahı yana yatırır. Hasar 70'i geçince kule yana yatmaya başlar.
  - Kamera olayı izler: kurulurken atan mancınık, nişan alınırken hedef kule (çapraz açıdan), atışta taşın bütün yolu, isabette çarpma noktası. Soru sırasında iki kule birlikte görünür.
  - Nişangâh hedef kulenin atış gelen yüzünde inip çıkar; yanında her bölgenin vereceği hasarı gösteren cetvel durur, pencere kehribar renklidir.
  - Ekip (her mancınıkta kurucu ve gözcü) vinci çevirir, taşı kepçeye taşır, hedefi gösterir, isabette sevinir, karşı taş tepeden geçerken başını korur.
  - Yıkılış: kule sarsılır, taşlar alttan başlayarak çözülür ve moloz yığınına dökülür, külah yığının üstüne yana yatmış düşer. Kamera kulenin çevresinde döner, toz kalkar, kazanan takımın renginde konfeti atılır.
  - Sesler çizim sahnesiyle aynıdır (`src/lib/sound.ts`).
- **Kule Yıkmaca sahnesi (çizim):** Tahta üç boyutlu çizemiyorsa ya da 3D düğmesi kapalıysa aynı oyun yandan görünen SVG çizimiyle oynanır.
- **Penaltı sahnesi (çizim):** Tahta üç boyutlu çizemiyorsa ya da öğretmen üst çubuktaki 3D düğmesini kapattıysa aynı oyun SVG çizimiyle oynanır: kamera topun arkasından kaleye bakar, kaleci önden, şutçular sırtlarından çizilir. Kurallar, sesler ve sonuç yazıları aynıdır; tekrar gösterimi yoktur.
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

**Penaltı stadyumu (üç boyutlu):**

| Belirteç | Değer | Kullanım |
|---|---|---|
| `cim` / `cim-acik` | `#2c8048` / `#3a9655` | Projektör altındaki çim ve biçim şeritleri |

Stadyumun geri kalanı mevcut belirteçleri kullanır: gökyüzü ve sis `ink-950` / `ink-900`, çizgiler ve direkler `cream`, panolar `firuze` ve `kehribar`, taraftarlar takım renkleri.

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
- Kule Yıkmaca'nın üç boyutlu sahnesinde kamera kaymadan yerine geçer; taşlar düşmez, doğrudan yere konur; toz, kırıntı, sarsıntı ve bayrak dalgalanması kapanır. Taşın uçuşu yine gösterilir.
- Penaltı'da:
  - Ağır çekim, kamera yaklaşması, sarsıntı ve konfeti kapanır. Tribün zıplamaz.
  - Üç boyutlu sahnede kamera kaymadan doğrudan yerine geçer; tekrar gösterimi, topun izi, parlama, flaşlar, bayrak ve pano hareketi kapanır.
  - Kalecinin uçuşu ve topun yolu yine gösterilir.

## Üç boyutlu sahneler

Üç boyutlu sahneler three.js ile çizilir. Ortak altyapı `src/games/shared/stage3d/` altındadır; örnekler Penaltı (`src/games/penalti/scene3d/`), Kule Yıkmaca (`src/games/kule-yikmaca/scene3d/`) ve Halat Çekme'dir (`src/games/halat-cekme/scene3d/`).

- **Görünüm:** Oyuncak gibi, yalın ve parlak. Foto-gerçekçilik hedeflenmez: tahtada 8 metreden okunan iri şekiller, takım renkleri ve net gölgeler yeterlidir.
- **Dosya yok:** Hazır model ya da resim indirilmez. Çim, ağ, pano, forma ve top dokuları tuvale çizilerek, karakterler basit şekillerden kurulur. Renkler `globals.css` belirteçlerinden okunur.
- **Yasaklar:** Sonradan işleme (bloom, bulanıklık, derinlik alanı) kullanılmaz. Parlama gereken yerde toplamalı bir ışık lekesi yeter.
- **Kalite kademeleri:** Sahne tahtanın gücüne göre üç kademeden birinde açılır ve akmıyorsa kendiliğinden bir alt kademeye iner.

  | Kademe | Çözünürlük | Gölge | Üç boyutlu taraftar sırası (kale arkası / yanlar) | Süsler |
  |---|---|---|---|---|
  | Yüksek | Ekranın tamamı (en çok 2x) | 2048 gölge haritası | 16 / 7 | Flaş, bayrak, ağ salınımı |
  | Orta | En çok 1,25x | 1024 gölge haritası | 10 / 4 | Flaş, bayrak, ağ salınımı |
  | Düşük | 0,8x | Yuvarlak gölge lekeleri | 7 / 0 | Yok |

  Üç boyutlu sıraların arkasındaki taraftarlar tribüne çizilidir. Kule Yıkmaca'da düşük kademede kayalar, bulutların ve servilerin bir bölümü çizilmez.

- **Yedek sahne:** Her üç boyutlu sahnenin bir çizim (SVG) yedeği vardır. Ekran kartı olmayan ya da en düşük kademede de akmayan tahtada oyun yedek sahneyle sürer. Öğretmen üst çubuktaki **3D** düğmesiyle sahneyi kendisi de değiştirebilir.
- **Durgunluk:** Soru sırasında sahnede sürekli hareket olmaz; kamera, panolar, bayraklar ve bulutlar yalnızca atış anında canlanır. Bayrak dururken de rüzgârın yönünü ve şiddetini gösterir.
