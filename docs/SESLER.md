# Sesler

OynaBil'de iki tür ses vardır.

- **Üretilmiş sesler** (`src/lib/sound.ts`): Web Audio ile kodda üretilir, dosyası yoktur. Bütün oyunlar bunları kullanır.
- **Kayıtlı sesler** (`src/lib/samples.ts`): Spiker replikleri, tribün ve vuruş sesleri. Şimdilik yalnızca Penaltı kullanır (`src/games/penalti/audio.ts`).

Kayıtlı bir ses henüz inmediyse ya da çözülemediyse aynı olay için üretilmiş ses çalar. Oyun ses dosyaları olmadan da eksiksiz oynanır.

## Penaltı'nın kayıtları

Dosyalar `public/ses/penalti/` altındadır: 30 dosya, toplam yaklaşık 820 KB. Service worker bunları da önbelleğe alır, yani oyun çevrimdışıyken de seslidir.

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

## Nasıl üretildi

Sesler ElevenLabs ile üretildi.

- **Spiker:** "Raju – High Energy Football Commentary" sesi (`jAUbTDuEGvdxrWhSe9eR`), `eleven_v4` modeli, Türkçe. Ses projenin sahibinin seçimidir. Replikler takım adı içermez, çünkü takım adlarını öğretmen belirler.
- **Tribün ve vuruş sesleri:** Metinden ses efekti üretimiyle.
- **Kontrol:** Üç replik yeniden yazıya döküldü ve metinle karşılaştırıldı.

Ham dosyalar ayrı bir depoda durur. Siteye uygun hâle getirmek için:

```bash
scripts/sesleri-hazirla.sh <ses deposunun klasörü>
```

Betik her dosyayı tek kanala indirir, baştaki ve sondaki sessizliği kırpar, tepe düzeyini eşitler ve 64 kb/sn mp3 olarak yazar. `ffmpeg` gerektirir.

## Yeni replik eklemek

1. Repliği aynı ses ve modelle üretin; dosya adı `spiker-<olay>-<sıra>.mp3` olsun.
2. `src/games/penalti/audio.ts` içindeki `LINES` listesinde o olayın çeşit sayısını artırın.
3. `npm run build` çalıştırın; service worker yeni dosyayı kendiliğinden önbelleğe alır.

## Başka bir oyuna kayıtlı ses eklemek

`src/games/penalti/audio.ts` örnektir: kayıtları `loadSamples` ile indirin, her olay için `playSample(...) ?? sfx.<üretilmiş ses>()` kalıbını kullanın. Böylece dosya yokken de olay sessiz kalmaz.
