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
