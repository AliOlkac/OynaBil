# Mimari

OynaBil üç katmandan oluşur: **veri havuzu**, **oyun mantığı** ve **tahta ekranları**. Katmanlar birbirini yalnızca tiplerle tanır. Bu yüzden yeni bir ders, yeni bir soru tipi ya da yeni bir oyun eklemek diğer katmanlara dokunmayı gerektirmez.

```
 content/ (JSON)  ──►  core/repository  ──►  core/deck.buildDeck  ──►  games/<oyun>/logic (saf reducer)
 öğretmen soruları ─┘   (havuz)              (PlayableQuestion[])           ▲             │
                                                                           eylemler       durum
                                                                            │             ▼
                                                                    games/<oyun>/Game.tsx (tahta)
```

## 1. Veri havuzu

- **Model:** `src/core/model.ts`. Zinciri Ders → Sınıf → Ünite → Soru şeklindedir. Her soru bir üniteye bağlıdır; sınıf ve ders bilgisi üniteden çıkar.
- **Soru tipleri:** `multiple-choice` (2-4 şık) ve `true-false`. Yeni bir tip (boşluk doldurma, eşleştirme, sıralama) eklemek için:
  1. `questionSchema` birleşimine yeni şemayı ekleyin.
  2. `toPlayable` içinde oyunların anlayacağı biçime çevirin.
  3. Tipi destekleyen oyunlar bunu `questionTypes` alanında bildirir. Desteklemeyen oyunlar o soruları görmez.
- **Doğrulama:** Bütün soru dosyaları `src/content/content.test.ts` ile şemaya, ünite eşleşmesine ve benzersiz kimliğe karşı test edilir.
- **Öğretmen soruları:** `src/core/repository.ts` bu soruları tarayıcıda (`localStorage`) tutar ve yerleşik sorularla birleştirir. Hesaplar geldiğinde yalnızca bu dosyadaki okuma/yazma fonksiyonları bir API'ye bağlanır; ekranlar ve oyunlar değişmez.

## 2. Deste

`buildDeck(havuz, { unitIds, types, seed })`:

- seçilen ünitelerden uygun tipteki soruları alır,
- üniteleri sırayla harmanlar ki tek bir ünite destenin başını doldurmasın,
- her ünite içinde kolaydan zora sıralar,
- şıkları karıştırır (`keepOrder` işaretli sorular hariç).

Tohum (`seed`) aynı kaldığı sürece deste de aynı kalır. Bu sayede sayfa yenilense bile oyun aynı sorularla devam eder. Çok cihazlı sürümde bu, bütün cihazların aynı desteyi görmesini sağlar.

## 3. Oyun mantığı: saf reducer

Her oyunun mantığı `(durum, eylem) => yeni durum` şeklinde saf bir fonksiyondur:

- Durum düz JSON'dur: kaydedilebilir, ağ üzerinden gönderilebilir.
- Zaman eylemle birlikte gelir (`{ type: "answer", option, now }`). Reducer `Date.now()` çağırmaz, bu yüzden testler belirleyicidir.
- Rastgelelik desteyle birlikte önceden kurulur. Reducer'ın içinde rastgelelik yoktur.

Testler: `src/games/*/logic.test.ts`.

## 4. Tahta ekranı

`Game.tsx`, reducer'ı `usePersistentReducer` ile çalıştırır. Bu hook her değişiklikte durumu tarayıcıya yazar; tahta uyku moduna geçse ya da sayfa yenilense oyun kaldığı yerden devam eder. Yeniden yüklenen bir Bilgi Yarışması'nda süre kendiliğinden akmaz, öğretmen "Devam" diyene kadar duraklatılmış bekler.

Halat Çekme'de iki öğrenci aynı anda dokunur. Tarayıcılar çoklu dokunuşta `click` olayını yalnızca birine gönderdiği için cevaplar `pointerdown` ile alınır.

## 5. Çok cihazlı sürüme geçiş planı

Bugünkü yapı bu geçiş düşünülerek kuruldu. Önerilen yol:

1. **Ev sahibi otoritesi:** Öğretmen cihazı (tahta) reducer'ı çalıştırmaya devam eder ve tek doğru kaynak olur.
2. **Aktarım katmanı:** Supabase Realtime, PartyKit ya da Cloudflare Durable Objects ile bir "oda" açılır. Öğrenci cihazları yalnızca eylem gönderir (`{ type: "answer", teamId, option }`). Ev sahibi eylemi kendi saatiyle (`now`) reducer'a verir, yeni durumu odaya yayınlar.
3. **Öğrenci ekranı:** Her oyuna `Player.tsx` eklenir. Bu ekran yalnızca şıkları ve takım bilgisini gösterir; soru metni tahtada kalabilir.
4. **Oyuncu kimliği:** Eylemlere `playerId` eklenir. Bilgi Yarışması'nda "takımın ilk cevabı" ya da "takım oylaması" kuralı reducer'a eklenir.
5. **Barındırma:** `next.config.ts` içindeki `output: "export"` kaldırılır ve oda sunucusu için bir API rotası açılır.

Reducer'lar, deste ve soru havuzu bu geçişte değişmeden kalır.

## 6. Çevrimdışı çalışma

`npm run build` sonrasında `scripts/build-sw.mjs`, `out/` altındaki bütün dosyaları listeleyip `out/sw.js` dosyasını yazar. Service worker ilk ziyarette her şeyi önbelleğe alır:

- Sayfa istekleri önce ağdan denenir, ağ yoksa önbellekten gelir.
- Sürüm adı taşıyan derleme dosyaları doğrudan önbellekten gelir.
- Her derleme yeni bir sürüm adı üretir; eski önbellek kendiliğinden silinir.

Service worker yalnızca derlenmiş sürümde kaydolur, `npm run dev` sırasında devreye girmez.
