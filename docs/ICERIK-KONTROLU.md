# İçerik kontrol listesi

Havuzda 2.122 soru var:
- 240 elle yazılan soru,
- 87 bilgi kartı kümesinden üretilen 1.832 soru,
- 8. sınıf için 50 LGS tarzı paragraf sorusu.

Hepsi şema testinden geçer: tip, uzunluk, ünite eşleşmesi ve benzersiz kimlik. Kartlardan üretilen soruların her biri yazdırılıp okundu. LGS soruları ayrıca cevap anahtarını görmeyen ikinci bir denetçiye çözdürüldü; 50 sorunun 50'sinde aynı cevap bulundu.

Sorular yazılırken genel ilkeler şunlardı:

- MEB ders kitaplarının dili ve yaklaşımı esas alındı.
- Fıkhî ayrıntılarda Hanefî görüş tercih edildi ve gerektiğinde bu belirtildi.
- Ayet metni alıntılanmadı. Tek ayet numarası Âyetü'l-Kürsî (Bakara 255) için verildi.
- Para tutarı (nisap ya da fitre TL değeri) yazılmadı.

Aşağıdaki sorular yanlış değildir, ancak ders kitabının ifadesiyle karşılaştırılmaları önerilir. Uygulamada **Soru bankası** ekranında aranabilirler. Kimlikler şu dosyalardadır:
- elle yazılan sorular: `src/content/din-kulturu/sorular/<sınıf>.json`,
- kart kümeleri: `kartlar/<sınıf>.json`; kart sorusunun kimliği küme ve satır kimliğiyle başlar,
- paragraf soruları: `sorular/8-lgs.json`.

Bir kart satırını düzeltmek, o satırdan üretilen bütün soruları birlikte düzeltir.

## Elle yazılan sorular

### 5. sınıf
- `dkab-5-3-11`: Kevser suresi "en kısa sure" olarak anılıyor. Ayet sayısında Asr ve Nasr da üç ayettir, Kevser kelime sayısına göre en kısadır.
- `dkab-5-3-12`: Mukabelenin tanımı: biri okur, diğerleri takip eder.
- `dkab-5-5-08`: Çini yapımı sadeleştirilmiş anlatılıyor (desen, sır, fırın).
- `dkab-5-5-12`: Sedefkâr Mehmed Ağa, "Mimar Sinan'ın öğrencisi" olarak geçiyor.
- `dkab-5-5-02`: Bursa Ulu Camii'nin şadırvanı caminin içindedir.
- `dkab-5-1-11`, `dkab-5-2-10`: Kudret sıfatı ve abdestin farzları (Hanefî). Yeni programın kapsamını aşıyor olabilir.
- `dkab-5-4-10`, `dkab-5-4-12`: Hz. Süleyman ve Hz. Şuayb. Bu peygamberlerin yeni ders kitabındaki kıssalar arasında olup olmadığı kontrol edilmeli.

### 6. sınıf
- `dkab-6-1-09`: Suhuf verilen peygamberler "kaynaklara göre" diye veriliyor.
- `dkab-6-2-05`: Fitrenin zamanı ve vacip oluşu (Hanefî, Diyanet).
- `dkab-6-2-06`: Kadir Gecesi Türkiye'de 27. gece ihya edilir; kesin gecesi bilinmez.
- `dkab-6-4-03`: Babasının, o doğmadan vefat ettiği (çoğunluk görüşü).
- `dkab-6-4-06`: Hılfu'l-Fudul ile ilgili siyer rivayeti.
- `dkab-6-5-07`: Mahya geleneği ve "Hoş geldin ya şehr-i Ramazan" yazısı.
- `dkab-6-5-09`: "Gelin tanış olalım, işi kolay kılalım" dizesi Yunus Emre'ye ait olarak veriliyor.
- `dkab-6-5-11`: Klasik hilye düzeninin Hafız Osman'a dayandırılması.

### 7. sınıf
- `dkab-7-2-03`: Kurban edilmek istenen oğul Hz. İsmail olarak veriliyor; bu yaygın görüştür.
- `dkab-7-3-06`: Cem töreninin tarifi.
- `dkab-7-3-11`: Makâlât ve "Eline, beline, diline sahip ol" öğüdü.
- `dkab-7-1-12`: Münker ve Nekir'in sorgusu (hadis kaynaklı, açıklamada belirtiliyor).
- `dkab-7-4-11`: Kuba Mescidi'nin konumu ve ilkliği.
- `dkab-7-2-09`, `dkab-7-2-12`: Umrenin mekruh olduğu günler ve kurbanın hükmü (Hanefî).

### 8. sınıf
- `dkab-8-1-03`: Yasa türleri sınıflandırması (ahlaki ya da toplumsal).
- `dkab-8-1-08`: "Deveni bağla, sonra tevekkül et" hadisi (Tirmizî).
- `dkab-8-2-01`: Nisap 80,18 gram altın olarak veriliyor (Hanefî, Diyanet). Bazı kaynaklar 85 gram der.
- `dkab-8-2-05`: Yolda kalmış yolcuya zekât verilebilmesi.
- `dkab-8-2-12`: "Mâûn" kelimesinin sadeleştirilmiş anlamı.
- `dkab-8-4-07`: Hadis çevirisindeki "lokma" ifadesi.

## Bilgi kartları

Kart kümesi kimlikleri `küme` ya da `küme / satır` biçiminde verilmiştir.

### 5. sınıf
- **Kapsam:** `dkab-5-4-kissalar-2` (Eyyub, Süleyman, Şuayb, Salih, Davud) ve `dkab-5-4-akrabalik` içindeki Zekeriya-Yahya eşleşmesi. Bu peygamberlerin yeni ders kitabında olup olmadığına bakılmalı.
- **Namazın farzları:** `dkab-5-2-namazin-farzlari` ve `dkab-5-2-namazin-icindeki-farzlar` setlerinde iftitah tekbiri Diyanet ve MEB'in yaptığı gibi namazın içindeki farzlar arasında sayıldı. Hanefîlere göre aslında bir şarttır. Secde "alnı ve burnu yere koyarak kapanmak" diye sadeleştirildi.
- **Abdesti bozanlar:** `dkab-5-2-abdesti-bozanlar` setindeki kanın akması ve ağız dolusu kusma Hanefî görüştür. Soru kökü bunu belirtir.
- **Esmâ-i Hüsnâ:** `dkab-5-1-esma-i-husna-2` setinde Kâdir/Kadîr yazımı ve anlamların ifadesi kontrol edilmeli.
- **Anma sözleri:** `dkab-5-1-anma-sozleri / masallah` "Allah dilemiş" diye çevrildi; "Allah'ın dilediği olur" da yaygındır.
- **Sureler:** `dkab-5-3-sureler / fatiha` maddesinde Fatiha "her rekâtta okunur" diye geçiyor; Hanefîlerde ilk iki ve son iki rekât farklıdır.
- **Kavramlar:** `dkab-5-3-kavramlar / cuz` maddesinde cüz "yaklaşık yirmişer sayfa" diye tanımlanıyor.
- **Mimar Sinan:** `dkab-5-5-mimar-sinan` setinde "Mihrimah Sultan Camii" iki ayrı yapıyı karşılar (ikisi de Sinan'ın). Konya Alaaddin Camii Selçuklu yapısıdır ve çeldirici olarak kullanıldı.

### 6. sınıf
- **Kapsam:**
  - `dkab-6-2-hukumler / keffaret`: 60 gün oruç ve Hanefî görüşe göre kaza. 6. sınıfın kapsamını aşabilir.
  - `dkab-6-3-kavramlar / gipta`: 6. sınıf kitabında olmayabilir.
  - `dkab-6-5-sanatlar / kundekari`: 6. sınıf kitabında olmayabilir.
  - `dkab-6-5-edebi-turler`: Tevhid, münacat ve naat; bütün küme zor (3). Naat notunda Fuzûlî'nin Su Kasidesi anılıyor.
- **Orucu bozanlar:** `dkab-6-2-orucu-bozanlar` setinde sigara içmek ve ağızdan ilaç almak Diyanet'in görüşüne göredir.
- **Ramazan gelenekleri:** `dkab-6-2-ramazan-gelenekleri` setinde Regaip Kandili, Ramazan'a ait olmayan madde olarak kullanılıyor.
- **Peygamberimizin ailesi:** `dkab-6-4-ailesi / abdulmuttalip` ve `ebu-talip` sorularında 6 ve 8 yaş bilgisi kullanılıyor.
- **Ümmîlik:** `dkab-6-4-hayati` açıklamasında okuma yazma bilmediği (ümmî) belirtiliyor.
- **Yazım:** `dkab-6-5-dini-gunler / mevlit` maddesinde elle yazılan sorularla uyum için "Mevlit Kandili" yazıldı; Diyanet "Mevlid" yazar.

### 7. sınıf
- **Kapsam:**
  - `dkab-7-3-fikhi-mezhepler / caferilik`: Elle yazılan sorularda yok. Bu maddenin ve `hanbelilik` maddesinin "yaygın olduğu yerler" notlarına bakılmalı.
  - `dkab-7-5-kurucular`, `dkab-7-5-ibadet-yerleri` (Gurdvara, Ateşgede) ve `dkab-7-5-kutsal-metinler / zerdustluk` (Avesta): Sihizm ve Zerdüştlük maddeleri.
- **Adlandırma:**
  - `dkab-7-3-tasavvufi-yorumlar / bektasilik`: Bektaşîlik tasavvufî yorum olarak anılıyor. Alevîlik için bilerek böyle bir adlandırma yapılmadı.
  - `dkab-7-3-alevi-bektasi-kavramlar`: Semah ("ritüel"), dede ve musahiplik tanımlarına bakılmalı.
  - `dkab-7-5-kavramlar`: `yin-yang` Taoizm'e, `kast` Hinduizm'e bağlandı.
- **Tarihler:** `dkab-7-4-mekke-donemi-yillari` setinde açık davet 613, hüzün yılı 619 olarak veriliyor; bazı kaynaklar bir yıl sonrasını verir. Taif ve Miraç için kaynaklar ayrıştığından 620 yılı kullanılmadı.
- **Hac ve kurban (Hanefî):**
  - `dkab-7-2-hac-yerleri / muzdelife`: "Bayramın ilk sabahı vakfe".
  - `dkab-7-2-kurbanlik-yaslari`: Deve 5, sığır 2, koyun ve keçi 1 yaş. Notta altı aylık iri koyunun yeterli olduğu belirtiliyor.
- **Siyer:**
  - `dkab-7-4-onemli-yerler / taif`: Taşlandığı ve beddua etmediği.
  - `dkab-7-4-onemli-yerler / suffe`: "Mescid-i Nebevi'deki" diye geçiyor.
- **Bilerek dışarıda bırakılan:** Hafaza melekleri `dkab-7-1-melekler` setine alınmadı. Klasik kaynaklarda amelleri yazan meleklerle örtüşebildiği için iki doğru cevap doğabilirdi.

### 8. sınıf
- **Zekât verilemeyenler:** `dkab-8-2-zekat-verilenler` açıklamasında eşe zekât verilemeyeceği yazıyor. Bu Ebû Hanîfe'nin görüşüdür; İmameyn kadının yoksul kocasına vermesine izin verir. Bu yüzden "eşine" şıklarda kullanılmadı.
- **Fitre:** `dkab-8-2-kavramlar / fitre` vacip olarak geçiyor (Hanefî). Not bunu belirtiyor.
- **Kapsam:** `dkab-8-1-kavramlar / sunnetullah` ve `omur` kavramlarının güncel kitapta olduğu doğrulanmalı.
- **Roller:** `dkab-8-4-roller` setinde öğretmenlik, devlet başkanlığı, komutanlık, tüccarlık ve babalık rolleri var. Bu çerçevenin 2026-2027 kitabına uyduğu kontrol edilmeli. Tüccarlık peygamberlik öncesine aittir. Hz. Fatıma rivayeti Ebû Dâvûd ve Tirmizî'dendir.
- **Örnek davranışlar:**
  - `dkab-8-4-ornek-davranislar / adalet`: Mahzûmî kadın olayı, ceza anlatılmadan veriliyor.
  - `dkab-8-4-ornek-davranislar / sefkat`: Kuş yavruları rivayeti Ebû Dâvûd'dandır.
- **Hadis ifadesi:** `dkab-8-4-hadisler / zarar` maddesinde "Müslümanların emin olduğu kimsedir" ifadesi kullanıldı; Diyanet "selamette olduğu" ifadesini de kullanır.
- **Kur'an:**
  - `dkab-8-5-anlatim-yollari / yemin`: Asr suresinde "asr" zaman anlamında alındı.
  - `dkab-8-5-kavramlar / mukabele`: Tanım ve kavramın bu ünitede olup olmadığı kontrol edilmeli.

## LGS tarzı paragraf soruları (8. sınıf)

Ayet metni alıntılanmadı, yalnızca kaynağı belirtilen yakın anlatımlar kullanıldı (Bakara 255, İbrahim 24-26). Fıkıh sorularının hepsinde Hanefî görüş belirtildi, para tutarı yok.

- **Siyer:** `dkab-8-4-lgs-08` maddesinde Mekke'nin fethinde Hz. Yusuf'un "Bugün size kınama yok" sözü tekrarlanıyor. Siyer kaynaklıdır ve Türkçe kitaplarda yaygındır, ama sahih hadis lafzı değildir.
- **Ünite:** `dkab-8-3-lgs-05` Asr suresini işliyor. Bunun 8. sınıf "Din ve Hayat" ünitesinin suresi olduğu kitapla doğrulanmalı.
- **Rivayetler:** Hadis ve siyer olayları serbest anlatımla verildi; kitaptaki ifadeyle karşılaştırılmalı.
  - `dkab-8-4-lgs-01`: Ağlayan deve, Ebû Dâvûd.
  - `dkab-8-4-lgs-05`: Medine'deki gece sesi, Buhârî.
  - `dkab-8-4-lgs-07`: Safa tepesi çağrısı.
- **Ön bilgi:** `dkab-8-4-lgs-09` öğrencinin Uhud'daki istişareyi bilmesini gerektiriyor. Aynı bilgiyi `dkab-8-4-lgs-03` de öğretiyor.
- **Benzetme:** `dkab-8-1-lgs-06` kader ve kazayı mimar benzetmesiyle anlatıyor. Metin bunun yalnızca bir benzetme olduğunu belirtiyor.
- **Fitre:** `dkab-8-2-lgs-09` sorusunun cevabı fitrenin Hanefîlere göre farz değil vacip olmasına dayanıyor.
- **Düzeltilen:** `dkab-8-5-lgs-05` metni bütün ayetlerin bir olay üzerine indiği izlenimini veriyordu. Doğrulayıcının uyarısıyla "Bazen…" diye düzeltildi.
- **Genel not:** Çeldiricilerin bir kısmı "yalnızca", "hiçbir" gibi kesin sözcüklerle kendini ele veriyor, bu da soruları gerçek LGS'den biraz kolaylaştırıyor. Üretim hattının kuralları bundan kaçınacak şekilde güncellendi.

## Yazım tercihleri
- Peygamber adlarında Diyanet yazımı kullanıldı: Davud, Yakub, Şuayb, Eyyub.
- Ek getirilirken ek, parantezden önce gelir: "Hz. Muhammed'in (sav)".
