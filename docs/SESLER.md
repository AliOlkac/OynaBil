# Sesler

OynaBil'de iki tür ses vardır.

- **Üretilmiş sesler** (`src/lib/sound.ts`): Web Audio ile kodda üretilir, dosyası yoktur. Bütün oyunlar bunları kullanır.
- **Kayıtlı sesler** (`src/lib/samples.ts`): Spiker replikleri, tribün ve vuruş sesleri. Penaltı (`src/games/penalti/audio.ts`), Basketbol (`src/games/basketbol/audio.ts`) ve Okçuluk (`src/games/okculuk/audio.ts`) kullanır.

Kayıtlı bir ses henüz inmediyse ya da çözülemediyse aynı olay için üretilmiş ses çalar. Oyun ses dosyaları olmadan da eksiksiz oynanır.

## Penaltı'nın kayıtları

Dosyalar `public/ses/penalti/` altındadır: 30 dosya, toplam yaklaşık 860 KB. Service worker bunları da önbelleğe alır, yani oyun çevrimdışıyken de seslidir.

| Dosya | Ne zaman çalar |
|---|---|
| `spiker-baslangic-1` | Oyun başlarken |
| `spiker-hazir-1…3` | Bir takım şut hakkı kazanınca (her iki şutta bir) |
| `spiker-gol-1…4` | Gol |
| `spiker-kurtaris-1…3` | Kurtarış |
| `spiker-direk-1…2` | Top direkten dönünce |
| `spiker-aut-1…2` | Top kaleyi bulmayınca |
| `spiker-pas-1…2` | İki takım da bilemeyince |
| `spiker-seri-1` | Seri penaltıya geçilirken |
| `spiker-bitis-1…2`, `spiker-berabere-1` | Oyun bitince |
| `tribun-ortam` | Oyun boyunca alçak bir uğultu; şut anında yükselir |
| `tribun-gol`, `tribun-alkis`, `tribun-ah` | Gol, kurtarış, kaçan şut |
| `duduk`, `vurus`, `ag`, `direk`, `eldiven` | Hakem düdüğü, topa vuruş, ağ, direk, eldiven |

Aynı olayın birden çok repliği sırayla döner. Yeni bir replik başlayınca süren replik kesilir: son olay önceliklidir. Ses düğmesi kapatılınca süren bütün kayıtlar susar.

## Basketbol'un kayıtları

Dosyalar `public/ses/basketbol/` altındadır: 30 dosya, toplam yaklaşık 860 KB.

| Dosya | Ne zaman çalar |
|---|---|
| `spiker-baslangic-1` | Oyun başlarken |
| `spiker-hazir-1…3` | Bir takım atış hakkı kazanınca (her iki atışta bir) |
| `spiker-ates-1` | Eli ateş almış takım atışa geçerken |
| `spiker-basket-1…3`, `spiker-uclu-1…2`, `spiker-temiz-1`, `spiker-cember-1` | Basket: iki sayı, üçlük, tertemiz, çemberden giren |
| `spiker-kacti-1…3`, `spiker-kisa-1` | Çemberden ya da panyadan dönen, havaya giden top |
| `spiker-pas-1…2` | İki takım da bilemeyince |
| `spiker-uzatma-1` | Uzatmaya geçilirken |
| `spiker-bitis-1…2`, `spiker-berabere-1` | Oyun bitince |
| `salon-ortam` | Oyun boyunca alçak bir uğultu; atış anında yükselir |
| `salon-cosku`, `salon-ah` | Basket ve kaçan atış |
| `file`, `cember`, `panya`, `sekme`, `buzzer` | File, çember, panya, parkede sekme, maç sonu sireni |

## Okçuluk'un kayıtları

Dosyalar `public/ses/okculuk/` altındadır: 30 dosya, toplam yaklaşık 810 KB.

| Dosya | Ne zaman çalar |
|---|---|
| `spiker-baslangic-1` | Oyun başlarken |
| `spiker-hazir-1…3` | Bir takım atış hakkı kazanınca (her iki atışta bir) |
| `spiker-ruzgar-1` | Sert rüzgârda (3. kademe) atış hakkı kazanılınca |
| `spiker-onluk-1…2`, `spiker-dokuz-1` | 10 ve 9 |
| `spiker-iyi-1…2`, `spiker-orta-1…2`, `spiker-kotu-1` | 7–8, 4–6, 1–3 |
| `spiker-iska-1…2` | Ok hedefi bulamayınca |
| `spiker-pas-1…2` | İki takım da bilemeyince |
| `spiker-uzatma-1` | Uzatmaya geçilirken |
| `spiker-bitis-1…2`, `spiker-berabere-1` | Oyun bitince |
| `alan-ortam` | Oyun boyunca alçak bir uğultu ve rüzgâr |
| `alan-cosku`, `alan-ah` | İyi atış ve kaçan ok |
| `yay-ger`, `birak`, `ucus`, `hedef`, `cimen`, `ruzgar` | Yayın gerilmesi, kirişin bırakılması, okun vızıltısı, hedefe ve çimene saplanma, rüzgâr |

## Nasıl üretildi

Sesler ElevenLabs ile üretildi.

- **Spiker (üç oyunda da):** "OynaBil Coşkulu Spiker (TR)" sesi (`8TSaHJWrS14oJ4HmIoZF`). Ses tasarımıyla üretildi: orta yaşlı, İstanbul Türkçesiyle konuşan, kalın ve hafif boğuk sesli, golde coşan, kaçan atışta hayıflanan bir maç spikeri. Gerçek bir kişinin sesi taklit edilmedi. `eleven_v4` modeli, kararlılık 0.3. Replikler `[excited]`, `[shouting]`, `[groaning]`, `[disappointed]` gibi duygu etiketleriyle yazıldı; etiketler okunmaz, yalnızca vurguyu yönlendirir.
- Replikler takım adı içermez, çünkü takım adlarını öğretmen belirler.
- **Tribün ve vuruş sesleri:** Metinden ses efekti üretimiyle.
- **Kontrol:** Penaltı'dan iki, Basketbol'dan bir, Okçuluk'tan iki replik yeniden yazıya döküldü ve metinle karşılaştırıldı; etiketlerin seslendirilmediği görüldü. Yeni spikerin ses perdesi aralığı eski basketbol repliklerininkinin yaklaşık iki katıdır.

Ham dosyalar ayrı bir depoda durur. Siteye uygun hâle getirmek için:

```bash
scripts/sesleri-hazirla.sh <ses deposunun klasörü>
```

Betik her dosyayı tek kanala indirir, baştaki ve sondaki sessizliği kırpar, tepe düzeyini eşitler ve 64 kb/sn mp3 olarak yazar. `ffmpeg` gerektirir.

## Yeni replik eklemek

1. Repliği aynı ses, model ve kararlılıkla (0.3) bir duygu etiketiyle üretin; dosya adı `spiker-<olay>-<sıra>.mp3` olsun.
2. `src/games/penalti/audio.ts` içindeki `LINES` listesinde o olayın çeşit sayısını artırın.
3. `npm run build` çalıştırın; service worker yeni dosyayı kendiliğinden önbelleğe alır.

## Başka bir oyuna kayıtlı ses eklemek

`src/games/penalti/audio.ts` örnektir: kayıtları `loadSamples` ile indirin, her olay için `playSample(...) ?? sfx.<üretilmiş ses>()` kalıbını kullanın. Böylece dosya yokken de olay sessiz kalmaz.

Penaltı başlangıçta "Raju – High Energy Football Commentary" sesiyle seslendirilmişti; üç oyun aynı spikerle konuşsun diye yeni sese geçildi.
