# Mimari

OynaBil üç katmandan oluşur: **veri havuzu**, **oyun mantığı** ve **tahta ekranları**. Katmanlar birbirini yalnızca tiplerle tanır. Bu yüzden yeni bir ders, yeni bir soru tipi ya da yeni bir oyun eklemek diğer katmanlara dokunmayı gerektirmez.

```
 content/<ders>/sorular, kartlar ──► content/index.loadBuiltIn ──► core/repository ──► core/deck ──► games/<oyun>/logic
   (sınıf başına ayrı dosya)          (kartları soruya çevirir)     (+ öğretmen soruları,  (deste kimlikleri)   (saf reducer)
                                                                    − gizlenen sorular)          ▲                │
                                                       lib/memory (sorulanlar) ──────────────────┘     eylemler ▲ │ durum
                                                                                                                 │ ▼
                                                                                          games/<oyun>/Game.tsx (tahta)
```

## 1. Veri havuzu

- **Model:** `src/core/model.ts`. Zinciri Ders → Sınıf → Ünite → Soru şeklindedir. Her soru bir üniteye bağlıdır; sınıf ve ders bilgisi üniteden çıkar.
- **Soru tipleri:** `multiple-choice` (2-4 şık), `true-false` ve `passage` (LGS tarzı paragraf: metin, soru kökü, dört şık). Yeni bir tip (boşluk doldurma, eşleştirme, sıralama) eklemek için:
  1. `questionSchema` birleşimine yeni şemayı ekleyin.
  2. `toPlayable` içinde oyunların anlayacağı biçime çevirin.
  3. Tipi destekleyen oyunlar bunu `questionTypes` alanında bildirir. Desteklemeyen oyunlar o soruları görmez.
- **Bilgi kartları:** `src/core/cards.ts`. Bir kart kümesi doğrulanmış bilgileri tablo gibi tutar; `questionsFromCards` her satırdan çoktan seçmeli sorular ve doğru/yanlış önermeler üretir.
  - `pairs` kümesinde soru kalıpları (`"{kitap} hangi peygambere indirilmiştir?"`) satırların alanlarıyla doldurulur. Çeldiriciler diğer satırlardan seçilir. Yanlış önerme, bir alanın komşu satırdakiyle değiştirilmesiyle kurulur.
  - `list` kümesinde bir grubun üyeleri ve üye olmayanları vardır ("Hangisi namazın farzlarından biridir?" / "biri değildir?").
  - Seçimler kümenin kimliğinden türetilen tohumla yapılır (`hashSeed`). Aynı kart her derlemede aynı kimlikli, aynı soruları üretir; böylece hafıza ve hata bildirimleri kart sorularında da çalışır.
  - Aynı satırdan üretilen soruların `group` alanı ortaktır. Deste kurucu bir gruptan yalnızca bir soru alır.
- **Sınıf bazında yükleme:** `src/content/index.ts` içindeki `CONTENT_FILES` her ders ve sınıf için soru, kart ve paragraf dosyalarını `import()` ile tanımlar. Tahta yalnızca seçilen sınıfın dosyalarını indirir; kartlar o anda soruya çevrilir. Ana sayfadaki sayılar `countBuiltIn` ile hesaplanır.
- **Doğrulama:** Bütün soru, kart ve paragraf dosyaları `src/content/content.test.ts` ile şemaya, ünite eşleşmesine ve benzersiz kimliğe karşı test edilir. Kartlar için ayrıca aynı kümede iki satırın aynı soruyu üretmediği ve önermelerin tekrarlanmadığı denetlenir.
- **Öğretmen soruları:** `src/core/repository.ts` bu soruları tarayıcıda (`localStorage`) tutar ve yerleşik sorularla birleştirir. Hesaplar geldiğinde yalnızca bu dosyadaki okuma/yazma fonksiyonları bir API'ye bağlanır; ekranlar ve oyunlar değişmez.

## 2. Deste

`buildDeckIds(havuz, { unitIds, types, seed, seen })`:

- seçilen ünitelerden uygun tipteki soruları alır,
- aynı bilgi grubundan (`group`) yalnızca bir soru alır,
- `seen` verilirse hiç sorulmamış sorular önce, en eski sorulanlar sonra gelir,
- üniteleri sırayla harmanlar ki tek bir ünite destenin başını doldurmasın,
- her ünite içinde kolaydan zora sıralar.

Sonuç soru kimliklerinin listesidir ve oyun ayarıyla (`GameConfig.deckIds`) birlikte saklanır. Ekran bu kimlikleri `deckFromIds` ile oynanabilir sorulara çevirir. Şıklar her soru için tohum ve soru kimliğinden türetilen sırayla karıştırılır (`keepOrder` işaretli sorular hariç). Bu sayede sayfa yenilense ya da havuza yeni sorular eklense bile süren oyun aynı sorularla, aynı şık sırasıyla devam eder. Çok cihazlı sürümde bu, bütün cihazların aynı desteyi görmesini sağlar.

## 3. Sorulanlar hafızası ve hata bildirimleri

- **Hafıza:** `src/lib/memory.ts`. Oyun bitince sorulan soruların kimlikleri ve zamanı kaydedilir. Kapsam ders, sınıf ve isteğe bağlı şubedir (`din-kulturu-8-B`); şube seçilmezse sınıf geneli kullanılır. Kurulum ekranı kaç sorunun daha önce sorulduğunu gösterir ve hafızayı silmeye izin verir.
- **Bildirimler ve gizleme:** `src/lib/reports.ts`. Bildirim soru kimliği, hata türü ve kısa nottan oluşur. Gizlenen sorular `useGradePool` tarafından oyun havuzundan çıkarılır, soru bankasında görünmeye devam eder. Bildirimler JSON olarak dışa aktarılır.
- Bu kayıtlar `src/lib/store.ts` ile `localStorage`da tutulur. `useSyncExternalStore` sayesinde aynı tahtada açık sekmeler birbirini günceller. Hesaplar geldiğinde yalnızca bu dosyalar bir API'ye bağlanır.

## 4. LGS soru üretim hattı

`scripts/lgs-uret.ts` paragraf sorularını Claude API ile üretir (kullanım: README). Hat dört adımdan oluşur:

1. **Üret:** Ünite adı, mevcut sorular ve biçim örnekleriyle yapılandırılmış çıktı istenir (zod şeması).
2. **Denetle:** OynaBil şeması ve mevcut sorulara benzerlik denetlenir.
3. **Körlemesine çöz:** İkinci bir çağrı, soruları cevap anahtarını görmeden çözer.
4. **Yaz:** Cevabı tutan ve sorunsuz bulunan sorular eklenir, kalanlar gerekçesiyle `icerik-inceleme/` klasörüne yazılır.

Betik oyun koduna dokunmaz; yalnızca içerik dosyası üretir. Sonra `npm test` ile doğrulanır ve insan gözüyle okunur.

## 5. Oyun mantığı: saf reducer

Her oyunun mantığı `(durum, eylem) => yeni durum` şeklinde saf bir fonksiyondur:

- Durum düz JSON'dur: kaydedilebilir, ağ üzerinden gönderilebilir.
- Zaman eylemle birlikte gelir (`{ type: "answer", option, now }`). Reducer `Date.now()` çağırmaz, bu yüzden testler belirleyicidir.
- Rastgelelik desteyle birlikte önceden kurulur. Reducer'ın içinde rastgelelik yoktur.

Testler: `src/games/*/logic.test.ts`.

## 6. Tahta ekranı

`Game.tsx`, reducer'ı `usePersistentReducer` ile çalıştırır. Bu hook her değişiklikte durumu tarayıcıya yazar; tahta uyku moduna geçse ya da sayfa yenilense oyun kaldığı yerden devam eder. Yeniden yüklenen bir Bilgi Yarışması'nda süre kendiliğinden akmaz, öğretmen "Devam" diyene kadar duraklatılmış bekler.

Sahneli oyunlar (Halat Çekme, Kule Yıkmaca) çizimi SVG olarak bir kez kurar. Hareketi tek bir `requestAnimationFrame` döngüsü yönetir ve `data-part` ile işaretli öğelerin özniteliklerini doğrudan günceller; React her karede yeniden çizmez. İki sahnenin çocukları aynı iskelet ve çizimi kullanır (`src/games/shared/skeleton.ts`, `src/games/shared/kid.tsx`).

Kule Yıkmaca'da atışın sonucu (bölge, hasar) reducer'da, ATEŞ anında hesaplanır:
- Nişangâhın konumu `aimStart` ile eylemin zamanından bulunur.
- Rüzgâr oyun tohumundan türetilir.

Sahne yalnızca bu sonucu oynatır. Kulenin bölgeleri `logic.ts` içindeki `BANDS` sınırlarından çizilir (`scene/geometry.ts`), yani pencereye isabet gerçekten pencereye çarpar. Taş kuleye değdiği anda sahne `onImpact` ile ekrana haber verir; sağlamlık çubuğu ancak o zaman düşer.

Kule Yıkmaca ve Penaltı düello sorusu kullanır (`src/games/shared/duel.ts`). İki takıma aynı soru sorulur ve `duelAnswer` cevabı işler:
- İlk doğru cevaplayan takım kazanır.
- Yanlış cevap veren takım kilitlenir.
- İkisi de yanlışsa kimse kazanamaz.

`optionOrder`, iki takımın şıkları gördüğü sırayı soru ve oyun tohumundan türetir. Ekran `DuelQuestion` ile çizilir. Atıştan sonraki geçişi `AutoAdvance` zamanlar; zaman reducer'a yine eylemle (`next`) girer.

Penaltı'da şutun yeri kale koordinatıyla gelir (x: -1 sol direk, +1 sağ direk; y: 0 zemin, 1 üst direk). Kalecinin seçimi `keeperFor(tohum, şut sırası)` ile belirlenir, sonuç (`gol`, `kurtardi`, `direk`, `aut`) reducer'da hesaplanır. Sahne yalnızca bu sonucu oynatır. Top kaleye ulaştığında `onContact` ile skoru, gösteri bitince `onKickDone` ile otomatik geçişi başlatır.

Halat Çekme'de iki öğrenci aynı anda dokunur. Tarayıcılar çoklu dokunuşta `click` olayını yalnızca birine gönderdiği için cevaplar `pointerdown` ile alınır.

### Üç boyutlu sahne (Penaltı)

Penaltı'nın iki sahnesi vardır: three.js ile çizilen üç boyutlu sahne (`scene3d/`) ve SVG çizimi (`scene/`). İkisi aynı girdiyi alır, aynı olayları bildirir (`onKick`, `onContact`, `onKickDone`, `onFinale`); oyun ekranı hangisinin çalıştığını bilmez. Seçimi `PenaltyStage` yapar.

- **Karar** (`src/games/shared/stage3d/support.ts`, three.js içermez): Ekran kartıyla çizen bir WebGL 2 varsa 3D, yoksa çizim sahnesi açılır (yazılımsal çizen ya da yalnızca WebGL 1 sunan tarayıcıda 3D kendiliğinden açılmaz). Öğretmen üst çubuktaki 3D düğmesiyle tercihi değiştirebilir; tercih tarayıcıda saklanır.
- **Tembel yükleme:** three.js ve sahne motoru (`scene3d/engine.ts`) ayrı bir parçadır, yalnızca 3D sahne açılırken indirilir. Öbür sayfalar ve oyunlar bu parçayı indirmez.
- **Kalite:** Motor kare süresini ölçer; sahne akmıyorsa bir alt kademeye iner, en alt kademede de akmıyorsa çizim sahnesine dönülür ve tercih "kapalı" olarak saklanır. Çizim bağlamı kaybolursa da aynı yol izlenir. Sahne oyunun ortasında değişirse süren şut bitmiş sayılır, oyun takılmaz.
- **Zaman çizelgesi** (`scene3d/timeline.ts`, three.js içermez): Topun yolu, kalecinin uçuşu ve şutçunun vuruşu yalnızca şuta ve geçen süreye bağlı saf fonksiyonlardır. Topun temastan sonraki yolu (ağ, eldiven, direk, pano) şut başlarken sabit adımlı küçük bir fizikle önceden hesaplanır. Bu sayede aynı şut başka bir kameradan ağır çekimde birebir yeniden oynatılır ve testte sınanır (`timeline.test.ts`).
- **Nişan:** Parmağın altındaki nokta kameradan kale düzlemine ışın izlenerek kale koordinatına çevrilir. Görünen noktalı yol ile topun gittiği yol aynı fonksiyondan çıkar.
- **Ortak parçalar** (`src/games/shared/stage3d/`): belirteç renkleri ve tuvalden doku (`kit.ts`), iki kemikli uzuvlar için ters kinematik ve çocuk karakter (`figure.ts`), toz ve kırıntı parçacıkları (`particles.ts`). Yeni bir üç boyutlu sahne bunları kullanır.

### Üç boyutlu sahne (Basketbol)

Basketbol, Penaltı'nın düzenini izler: `BasketStage` üç boyutlu salon (`scene3d/engine.ts`) ile çizim sahnesi (`scene/BasketScene.tsx`) arasında seçer; ikisi aynı girdiyi alır ve `onContact`, `onShotDone`, `onFinale` olaylarını bildirir.

- **Atışın sonucu oyun mantığındadır** (`logic.ts`): `shoot` eylemi topa basılı tutmanın başladığı anı (`pressAt`) ve bırakma anını taşır; güç çubuğunun yeri aradaki süreden saf bir fonksiyonla (`meterAt`) hesaplanır. Ekrandaki çubuk da aynı fonksiyonu çizer; öğrencinin gördüğü yer ile sonuç birebir aynıdır. Sahneler `pressAt`ten şutçuyu çömeltir.
- **Zaman çizelgesi** (`timeline.ts`, three.js içermez): topun yolu, sonuca göre (tertemiz, çemberden içeri, ön ya da arka çemberden dönen, panyadan seken, havaya giden) yerçekimli yay parçalarından kurulur; çember, panya, file ve parke olayları aynı listededir. Sesler, skorun güncellenmesi ve ağır çekim tekrar bu listeden okunur. Testler her sonucun yolunun kesintisiz olduğunu, basketin çemberin içinden geçtiğini ve kaçan topun geçmediğini sınar.
- **File** her kare topun yerine göre esner: top hangi halkanın hizasındaysa o halka topu sarar; basketten sonra file sallanır.

### Üç boyutlu sahne (Okçuluk)

Okçuluk, Basketbol'un düzenini izler: `ArcheryStage` üç boyutlu atış alanı (`scene3d/engine.ts`) ile çizim sahnesi (`scene/ArcheryScene.tsx`) arasında seçer; ikisi aynı girdiyi alır ve aynı olayları bildirir.

- **Atışın sonucu oyun mantığındadır** (`logic.ts`): `shoot` eylemi yayın gerilmeye başladığı anı (`drawAt`, basılı tutma) ve bırakma anını taşır. Okun nişanı saf bir fonksiyonla (`releaseAim`) hesaplanır: nişangâh basılı tutulan süreye göre sarkaç gibi salınır (`sightAt`; `STEADY_MS` sonra yorgunlukla `fatigueOf` kadar büyür), yay tam gerilmediyse ok düşer (`drawOf`, `WEAK_DROP`); rüzgâr (`windFor`, soru kimliğinden türetilir) oku yana kaydırır, halka puanı merkezden uzaklıktan çıkar. Ekrandaki dürbün (`AimScope.tsx`) aynı fonksiyonu çizer, gerilme halkasını da gösterir; sahneler yayı `drawAt`ten `DRAW_MS` içinde gerer. Bot yayı gerer ve nişangâh rüzgâr payıyla ortaya yaklaşınca bırakır (`botShot`). Uzatmada 7'nin altındaki ok skora eklenmez (`Shot.scored`).
- **Zaman çizelgesi** (`timeline.ts`, three.js içermez): okun ucu bırakış noktasından hedef yüzüne (ya da hedefi bulmazsa arkadaki çimene) yerçekimli bir yayla gider; saplanma anı, okun titreşimi ve ağır çekimin aralığı buradadır.
- **Okçu yan durur:** sol omzu hedefe bakar, yay sol elde, çekme eli çeneye gelir. Yay ve kiriş her kare ellerin dünya koordinatından (`KidFigure.handWorld`) kurulur. Hedefte son altı ok durur.

### Üç boyutlu sahne (Bilgi Yarışması)

Bilgi Yarışması'nın çizim sahnesi yoktur; üç boyutlu stüdyo (`scene3d/StudioStage.tsx`) soru ekranının üstünde bir şerittir. Tahta 3D çizemiyorsa şerit hiç yer kaplamaz ve oyun eskisi gibi oynanır. Şerit paragraf (LGS) sorularında ve 860 pikselden alçak ekranlarda gizlenir; soru metni her zaman önceliklidir. Sahne yalnızca özet girdi alır (sıradaki takım, son sonuç, puanlar, önde olan takım).

### Üç boyutlu sahne (Halat Çekme)

`TugStage` üç boyutlu sahne (`scene3d/engine.ts`) ile çizim sahnesi (`scene/TugScene.tsx`) arasında seçer. İkisi aynı özet girdiyi alır (ipin konumu, son doğru ve yanlış anları, donma, kazanan) ve olay bildirmez; bu yüzden sahne oyunun ortasında değişse de oyun kesintisiz sürer. İp, çocukların ellerinden geçen parçalardan kurulur; el ipi bırakınca ip o noktada yere düşer.

### Üç boyutlu sahne (Kule Yıkmaca)

Kule Yıkmaca aynı düzeni kullanır: `SiegeStage` üç boyutlu sahne (`scene3d/`) ile çizim sahnesi (`scene/`) arasında seçer; ikisi aynı girdiyi alır ve `onImpact`, `onFinale` olaylarını bildirir. Sahne oyunun ortasında değişirse havadaki taş isabet etmiş sayılır.

- **Ölçüler ve uçuş** (`scene3d/world.ts`, three.js içermez): Kulenin bölgeleri oyun mantığındaki `BANDS` sınırlarından metreye çevrilir; taşın yolu ve ıskalayan taşın yuvarlanması saf fonksiyondur.
- **Taşlar ve yıkılış** (`scene3d/debris.ts`, three.js içermez): Kule yaklaşık 215 taştan örülür. İsabet, çarptığı yere en yakın sağlam taşları yerinden çıkarır; yıkılışta hepsi moloz yığınına dökülür. Fizik motoru yoktur: her taşın duracağı yer ve düşüş süresi tohumlu rastgelelikle önceden hesaplanır, taş oraya çözümlü bir yayla iner. Bu yüzden yeniden açılan oyunda kule aynı hasarla, molozu aynı yerde kurulur.
- **Çizim** (`scene3d/tower.ts`): Bir kulenin bütün taşları tek çizim çağrısıdır (`InstancedMesh`). Yerinde duran ve yere inmiş taşlar yeniden hesaplanmaz; yalnızca havadakiler her kare güncellenir.
- **Nişan:** Nişangâh ve hasar cetveli sahnenin içindedir ve her şeyin üstüne çizilir. Cetvel, çizim sahnesiyle aynı veriden (`RulerSpec`) bir tuvale çizilir.
- **Hasar yazısı:** Sahnenin üstünde HTML olarak durur; motor yazının yerini her kare isabet noktasından ekrana izdüşürerek bildirir.

Penaltı'nın kayıtlı sesleri (`src/lib/samples.ts`, `src/games/penalti/audio.ts`) için bkz. [SESLER.md](SESLER.md).

## 7. Çok cihazlı sürüme geçiş planı

Bugünkü yapı bu geçiş düşünülerek kuruldu. Önerilen yol:

1. **Ev sahibi otoritesi:** Öğretmen cihazı (tahta) reducer'ı çalıştırmaya devam eder ve tek doğru kaynak olur.
2. **Aktarım katmanı:** Supabase Realtime, PartyKit ya da Cloudflare Durable Objects ile bir "oda" açılır. Öğrenci cihazları yalnızca eylem gönderir (`{ type: "answer", teamId, option }`). Ev sahibi eylemi kendi saatiyle (`now`) reducer'a verir, yeni durumu odaya yayınlar.
3. **Öğrenci ekranı:** Her oyuna `Player.tsx` eklenir. Bu ekran yalnızca şıkları ve takım bilgisini gösterir; soru metni tahtada kalabilir.
4. **Oyuncu kimliği:** Eylemlere `playerId` eklenir. Bilgi Yarışması'nda "takımın ilk cevabı" ya da "takım oylaması" kuralı reducer'a eklenir.
5. **Barındırma:** `next.config.ts` içindeki `output: "export"` kaldırılır ve oda sunucusu için bir API rotası açılır.

Reducer'lar, deste ve soru havuzu bu geçişte değişmeden kalır.

## 8. Çevrimdışı çalışma

`npm run build` sonrasında `scripts/build-sw.mjs`, `out/` altındaki bütün dosyaları listeleyip `out/sw.js` dosyasını yazar. Service worker ilk ziyarette her şeyi önbelleğe alır:

- Sayfa istekleri önce ağdan denenir, ağ yoksa önbellekten gelir.
- Sürüm adı taşıyan derleme dosyaları doğrudan önbellekten gelir.
- Her derleme yeni bir sürüm adı üretir; eski önbellek kendiliğinden silinir.

Service worker yalnızca derlenmiş sürümde kaydolur, `npm run dev` sırasında devreye girmez.

Üç boyutlu sahnenin parçası ve Penaltı'nın ses dosyaları da bu listeye girer; oyun bir kez açıldıktan sonra çevrimdışıyken de üç boyutlu ve sesli çalışır.

## Mobil prototip

`/mobil` rotası (`src/mobile/`) telefonda tek kişilik dereceli maçların prototipidir; sunucu yoktur.

- **Tek oyunculu mod** (`src/games/shared/solo.ts`): Altı oyunun ekranı da isteğe bağlı bir `solo` özelliği alır. Bilgi Yarışması'nda rakip kendi sırasında cevaplar, oyuncu bilemezse soruyu çalmayı dener; rakip bilemezse soru doğrudan oyuncuya geçer. Oyuncu soldaki takımdır; sağdaki takımı bilgisayar oynar. Kurallar değişmez: rakip aynı eylemleri (cevap, mesafe, atış) gecikmeyle gönderir. Kararları oyun tohumundan türetilir (`botRng`), becerisi oyuncunun gizli puanına bağlıdır. Her oyunun rakip hesabı kendi `bot.ts` dosyasındadır. `solo` verilince tanıtım ve sonuç ekranları çizilmez; maç bitince sonuç `onResult` ile kabuğa bildirilir. Soru panelinde yalnızca oyuncunun şıkları görünür (`DuelQuestion`, `only`).
- **Dik ekran kamerası:** Kule Yıkmaca ve Halat Çekme geniş sahnelerdir. Sahne dar olduğunda (Kule Yıkmaca'da en-boy oranı 1,2'nin, Halat Çekme'de 1,7'nin altı) kamera soldaki takımın arkasından çapraz bakar: kendi kulen ya da takımın yakında, rakip uzakta görünür. Tahtadaki geniş görünüm değişmez.
- **Lig** (`src/mobile/league.ts`, saf): 16 basamak (Bronz III … Elmas I, Usta), basamak başına 0–100 lig puanı, gizli beceri puanı, Bronz ve Gümüş'te düşmeme, basamak atlayınca üç maçlık koruma, yenilgide kaybı yarıya indiren kalkan.
- **Oyuncu kaydı** (`src/mobile/profile.ts`): `localStorage` içinde durur: lig, kalkanlar, maç geçmişi, ünite bazında başarı, süren maç. `recordMatch` bir maçı yalnızca bir kez işler. Sunuculu sürümde bu kayıt hesaba taşınır.
- **Ekranlar** (`src/mobile/MobileApp.tsx`): karşılama, lobi (lig kartı, oyun kartları, ders paneli, OYNA), eşleşme (nasıl oynanır ipucuyla), maç, maç sonu (sayan puan, basamak atlama töreni, galibiyet serisi, zayıf konu, yanlışlar), lig, çalışma ve profil (amblem, ses ve 3D ayarı). Mobil maçların sorulanlar hafızası tahtadakinden ayrıdır (`mobil` şubesi).

## Kule Yıkmaca: sapan nişanı

Atış açı ve güçle yapılır (`Launch`). Öğrenci sahnede parmağını geri ve aşağı çeker: çekişin uzunluğu gücü, yönü açıyı verir; çok az çekilip bırakılan sapan ateşlenmez (`MIN_PULL`). Sahnelerde mancınığın yerini dev sapan alır (`scene3d/slingshot.ts`, `scene/art.tsx`): cebin dinlenme yeri (`POUCH_REST`) eski bırakma noktasıyla aynıdır, böylece uçuş hesabı değişmez; çekiş cebi `pullOffset` kadar geri götürür, bırakınca cep `RELEASE_DELAY` içinde ileri fırlar. Taşın yolu oyun mantığındaki saf balistik hesaptır (`velocityOf`, `pathHeight`, `impactOf`): rüzgâr yatay hızı değiştirir, taşın kule yüzündeki yüksekliği hangi bölgeye isabet ettiğini belirler. Sahnelerin yol noktaları (`pathPoint`) ve uçuşu (`flightFor`) aynı hesaptan çıkar; noktalar yolun yalnızca ilk kısmını (`PREVIEW`) gösterir. Bilgisayar rakip bir açı seçer ve `powerFor` ile pencereye isabet ettiren gücü bulur, becerisine göre şaşar.

## Penaltı: kaleci

Kaleci şutu çeken takımın son dört şutunu hatırlar (`keeperFor`, `habits`): o yönlere atlama ağırlığı artar. Atladığı üçlünün sınırından `KEEPER_REACH` kadar ötedeki topa da uzanır (`keeperReaches`). Seçim yine oyun tohumundan türetilir; aynı oyun yeniden açılınca kaleci aynı yere atlar.

## Penaltı: iki adımlı şut

Şut tek eylemdir: `kick` (hedef, güç, falso). Sahneler parmağın izini toplar ve `swipe.ts` (`readSwipe`) ile okur: çizginin bittiği nokta kendi ekran-kale çevirileriyle hedefe dönüşür (kalenin altında biterse çizgi kaleye kadar uzatılır, yerden şut), hız (sahne yüksekliği / saniye) güce, çizginin kirişten sapması falsoya. Uçuş yolu falsoyla yana açılır (`flightPoint`/`ballAt`, `bend`); falsolu top kalecinin uzanışını `CURL_DODGE` kadar kısaltır. Güç isabetli aralıktaysa top hedefe gider; zayıfsa kaleci fazladan uzanır (`weakReach`), sertse top yükselip dışa açılır (`shotFrom`). Direğe ya da üst direğe çok yakın top (`POST_BAND`, `BAR_BAND`, dar bir pay) direğe değer: topun yarıdan çoğu kale ağzının içindeyse direkten içeri seker (`postIn`, `Kick.post`), değilse döner; sahnede gerçekten direğe değsin diye topun yeri direğin çizgisine çekilir. Doksana (`TOP_CORNER`) zayıf olmayan şuta kaleci doğru yöne atlasa da yetişemez; sahne ve sonuç kartı "DİREKTEN GOL!" ya da "DOKSANA GOL!" yazar (`goalKind`). Kilitlenen nişan sahnelerde halka olarak durur.

## Ders videoları

Dersler (`src/lessons/`) video dosyası değil, sitenin içinde oynayan sahnelerdir: `src/content/<ders>/dersler/<sınıf>.json` derlemede okunur ve zod şemasıyla (`lessonSchema`) doğrulanır; `/dersler/[ders]` sayfaları `generateStaticParams` ile durağan üretilir. Oynatıcı (`LessonPlayer.tsx`) her sahnenin anlatımını `public/ses/dersler/<ders>/<ad>.mp3` dosyasından çalar; ses React durumunun dışında, küçük bir sınıfta (`Playback`) tutulur, tek bir kare döngüsü saati okur. Saat sahnenin ilerleyişini (`shown`) verir: listeler, kartlar ve ayet satırları anlatıcı onlara geldikçe açılır; altyazıda okunan kelime `<sınıf>.ses.json` içindeki kelime zamanlarından vurgulanır. "Kendini dene" sahnesi üç bölümdür: soru anlatımı, cevap bekleme (6 sn, oynatıcı durur), doğru cevap anlatımı. Ses dosyası yoksa sahne okuma süresi (`readingMs`) kadar sürer. Sesler service worker'ın önbelleğine girer, dersler internetsiz de oynar. İçerik ve üretim kuralları: [DERSLER.md](DERSLER.md).
