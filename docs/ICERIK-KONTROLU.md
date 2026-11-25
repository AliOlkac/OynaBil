# İçerik kontrol listesi

Havuzda sekiz derste 10.682 soru var. Bu belgenin ilk bölümü Din Kültürü ve Ahlak Bilgisi'ni (5-8. sınıf), son bölümü ("Öteki dersler") öteki dersleri ve Din Kültürü 4. sınıfı anlatır.

Din Kültürü 5-8'de 1.998 soru var:
- 236 elle yazılan soru,
- 81 bilgi kartı kümesinden üretilen 1.715 soru,
- 8. sınıf için 47 LGS tarzı paragraf sorusu.

Hepsi şema testinden geçer: tip, uzunluk, ünite eşleşmesi ve benzersiz kimlik. Kartlardan üretilen soruların her biri yazdırılıp okundu. LGS soruları ayrıca cevap anahtarını görmeyen ikinci bir denetçiye çözdürüldü; 47 sorunun 47'sinde aynı cevap bulundu.

Sorular yazılırken genel ilkeler şunlardı:

- MEB ders kitaplarının dili ve yaklaşımı esas alındı.
- Sorular mezhepler üstüdür. Cevabı mezhebe göre değişen fıkıh ayrıntısı sorulmaz; "… mezhebine göre" ya da "Hanefîlere göre" gibi kalıpları içerik testi hata sayar. Mezhepler yalnızca 7. sınıfın "İslam Düşüncesinde Yorumlar" ünitesinde konu olarak tanıtılır.
- Ayet metni alıntılanmadı. Tek ayet numarası Âyetü'l-Kürsî (Bakara 255) için verildi.
- Para tutarı (nisap ya da fitre TL değeri) yazılmadı.

### Mezhebe bağlı olduğu için çıkarılanlar

- Elle yazılan: `dkab-5-2-10` (abdestin farzları), `dkab-7-2-10` (haccın farzları), `dkab-7-2-12` (kurbanın hükmü), `dkab-8-2-04`.
- LGS: `dkab-8-2-lgs-03`, `dkab-8-2-lgs-08`, `dkab-8-2-lgs-09` (fitrenin vacip oluşu).
- Kart kümeleri: `dkab-5-2-namazin-icindeki-farzlar`, `dkab-5-2-abdesti-bozanlar`, `dkab-7-2-haccin-farzlari`, `dkab-7-2-kurbanlik-yaslari`, `dkab-8-2-zekat-sartlari`, `dkab-8-2-zekat-verilenler`.
- Kart satırları: `dkab-6-2-hukumler / keffaret` ve `dkab-6-2-orucu-bozanlar` içindeki "Unutarak yemek yemek".
- Mezhep ayrıntısı içeren açıklama ve notlar sadeleştirildi (nisap gramı, fitrenin hükmü, umrenin mekruh günleri). Bilgi değişmedi; zekât ve öşür oranları bütün mezheplerde aynıdır.

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
- `dkab-5-1-11`: Kudret sıfatı. Yeni programın kapsamını aşıyor olabilir.
- `dkab-5-4-10`, `dkab-5-4-12`: Hz. Süleyman ve Hz. Şuayb. Bu peygamberlerin yeni ders kitabındaki kıssalar arasında olup olmadığı kontrol edilmeli.

### 6. sınıf
- `dkab-6-1-09`: Suhuf verilen peygamberler "kaynaklara göre" diye veriliyor.
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

### 8. sınıf
- `dkab-8-1-03`: Yasa türleri sınıflandırması (ahlaki ya da toplumsal).
- `dkab-8-1-08`: "Deveni bağla, sonra tevekkül et" hadisi (Tirmizî).
- `dkab-8-2-05`: Yolda kalmış yolcuya zekât verilebilmesi.
- `dkab-8-2-12`: "Mâûn" kelimesinin sadeleştirilmiş anlamı.
- `dkab-8-4-07`: Hadis çevirisindeki "lokma" ifadesi.

## Bilgi kartları

Kart kümesi kimlikleri `küme` ya da `küme / satır` biçiminde verilmiştir.

### 5. sınıf
- **Kapsam:** `dkab-5-4-kissalar-2` (Eyyub, Süleyman, Şuayb, Salih, Davud) ve `dkab-5-4-akrabalik` içindeki Zekeriya-Yahya eşleşmesi. Bu peygamberlerin yeni ders kitabında olup olmadığına bakılmalı.
- **Namazın farzları:** `dkab-5-2-namazin-farzlari` setinde iftitah tekbiri, ders kitabındaki gibi namazın içindeki farzlar arasında sayıldı. Sorular yalnızca kavramın tanımını sorar. Secde "alnı ve burnu yere koyarak kapanmak" diye sadeleştirildi.
- **Esmâ-i Hüsnâ:** `dkab-5-1-esma-i-husna-2` setinde Kâdir/Kadîr yazımı ve anlamların ifadesi kontrol edilmeli.
- **Anma sözleri:** `dkab-5-1-anma-sozleri / masallah` "Allah dilemiş" diye çevrildi; "Allah'ın dilediği olur" da yaygındır.
- **Sureler:** `dkab-5-3-sureler / fatiha` maddesinde Fatiha "her rekâtta okunur" diye geçiyor; Hanefîlerde ilk iki ve son iki rekât farklıdır.
- **Kavramlar:** `dkab-5-3-kavramlar / cuz` maddesinde cüz "yaklaşık yirmişer sayfa" diye tanımlanıyor.
- **Mimar Sinan:** `dkab-5-5-mimar-sinan` setinde "Mihrimah Sultan Camii" iki ayrı yapıyı karşılar (ikisi de Sinan'ın). Konya Alaaddin Camii Selçuklu yapısıdır ve çeldirici olarak kullanıldı.

### 6. sınıf
- **Kapsam:**
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
- **Hac:** `dkab-7-2-hac-yerleri / muzdelife`: "Bayramın ilk sabahı vakfe".
- **Siyer:**
  - `dkab-7-4-onemli-yerler / taif`: Taşlandığı ve beddua etmediği.
  - `dkab-7-4-onemli-yerler / suffe`: "Mescid-i Nebevi'deki" diye geçiyor.
- **Bilerek dışarıda bırakılan:** Hafaza melekleri `dkab-7-1-melekler` setine alınmadı. Klasik kaynaklarda amelleri yazan meleklerle örtüşebildiği için iki doğru cevap doğabilirdi.

### 8. sınıf
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

Ayet metni alıntılanmadı, yalnızca kaynağı belirtilen yakın anlatımlar kullanıldı (Bakara 255, İbrahim 24-26). Fıkıh soruları mezhebe göre değişmeyen bilgilerle sınırlıdır, para tutarı yok.

- **Siyer:** `dkab-8-4-lgs-08` maddesinde Mekke'nin fethinde Hz. Yusuf'un "Bugün size kınama yok" sözü tekrarlanıyor. Siyer kaynaklıdır ve Türkçe kitaplarda yaygındır, ama sahih hadis lafzı değildir.
- **Ünite:** `dkab-8-3-lgs-05` Asr suresini işliyor. Bunun 8. sınıf "Din ve Hayat" ünitesinin suresi olduğu kitapla doğrulanmalı.
- **Rivayetler:** Hadis ve siyer olayları serbest anlatımla verildi; kitaptaki ifadeyle karşılaştırılmalı.
  - `dkab-8-4-lgs-01`: Ağlayan deve, Ebû Dâvûd.
  - `dkab-8-4-lgs-05`: Medine'deki gece sesi, Buhârî.
  - `dkab-8-4-lgs-07`: Safa tepesi çağrısı.
- **Ön bilgi:** `dkab-8-4-lgs-09` öğrencinin Uhud'daki istişareyi bilmesini gerektiriyor. Aynı bilgiyi `dkab-8-4-lgs-03` de öğretiyor.
- **Benzetme:** `dkab-8-1-lgs-06` kader ve kazayı mimar benzetmesiyle anlatıyor. Metin bunun yalnızca bir benzetme olduğunu belirtiyor.
- **Düzeltilen:** `dkab-8-5-lgs-05` metni bütün ayetlerin bir olay üzerine indiği izlenimini veriyordu. Doğrulayıcının uyarısıyla "Bazen…" diye düzeltildi.
- **Genel not:** Çeldiricilerin bir kısmı "yalnızca", "hiçbir" gibi kesin sözcüklerle kendini ele veriyor, bu da soruları gerçek LGS'den biraz kolaylaştırıyor. Üretim hattının kuralları bundan kaçınacak şekilde güncellendi.

## Öteki dersler

### Bağımsız denetim

Öteki derslerin elle yazılan ve LGS tarzı soruları (2.467 soru), cevap anahtarını görmeyen ayrı denetçilere baştan sona çözdürüldü; **2.467 sorunun 2.467'sinde anahtarla aynı cevap bulundu.** Kart kümelerinin 6.155 satırı da okundu. Bilgi olarak yanlış bir cevap çıkmadı; bulunan sorunlar iki şıkkın birden savunulabildiği ya da ifadenin tartışmalı olduğu satırlardı ve düzeltildi:

- İngilizce: "ABaker" gibi bozuk yazılan meslek şıkları; tekne/gemi, kasırga/hortum, tavsiye/öneri, roket/uzay gemisi, dilimlemek/doğramak, yüklemek/indirmek çiftleri.
- Türkçe: konuşturma satırları (konuşturma kişileştirmeyi de içerdiği için çıkarıldı), yay ayraç ile kısa çizgi, deneme ile söyleşi tanımı, "içeriye" ile "içeri".
- Matematik: alan bağıntıları kümesi (kare aynı zamanda dikdörtgen ve paralelkenar olduğu için çıkarıldı), zar-küp satırı.
- Fen ve Hayat Bilgisi: vitaminler sorusunda "su" çeldiricisi, acil yardım kartının kökleri, kurbağa-orman, balığın görünen yeri, pusula ifadesi.
- Sosyal, İnkılap, Din Kültürü 4: Asya Hun Devleti'nin kurucusu (Teoman/Mete Han), karınca yuvası ve yosunla yön bulma, Halk Fırkası'nın "Cumhuriyet Dönemi'nin ilk partisi" diye anılması, dürüstlük örneği.

Din Kültürü 4. sınıftaki "altı iman şartı" ve "beş İslam şartı" soruları MEB programının çerçevesine göredir; denetçi bu sayımın Ehl-i sünnet sayımı olduğunu not etti, sorular değiştirilmedi.

### Yazım süreci

Bu dersler yardımcı yazarlarla hazırlandı. Her biri şema testinden geçer; sayısal cevaplar betikle yeniden hesaplandı, LGS soruları ikinci kez çözüldü, karttan üretilen sorular örneklenerek okundu. MEB'in program sitesine (tymm.meb.gov.tr) yazım sırasında erişilemedi: Maarif Modeli tema adları arama sonuçlarından alındı, konuların temalara dağılımı tahmindir. Aşağıdaki maddelerdeki soruların cevabı doğrudur; soru işareti çoğunlukla konunun o sınıfın programında yer alıp almadığı ya da ders kitabının ifadesidir.

### Türkçe

**Türkçe 1-4**

- Üniteler beceri alanı (resmî tema adı değil). tr-3-2 "Adlar ve Sözcük Türleri" kapsamı doğrulanmadı.
- Bakılacaklar: tr-3-2-* ve tr-3-2-cogul-adlar; tr-2-3-07; tr-1-4-05, tr-2-3-04, tr-3-3-06; tr-2-2-es-sesli, tr-3-1-es-sesli, tr-4-1-09; tr-3-4-04, tr-4-4-04, tr-4-4-05, tr-2-4-04, tr-2-4-07; tr-3-4-10, tr-4-4-07, tr-4-4-09; tr-3-5-04, tr-4-5-06, tr-4-5-08; tr-4-1-mecaz-anlam, tr-4-1-04/07/08; tr-4-3-06, tr-4-3-07; tr-4-2-atasozleri.

**Türkçe 5-8**

- Üniteler beceri alanı; Maarif dil bilgisi konularının sınıf dağılımı doğrulanmadı.
- Bakılacaklar: tr-5-7-* ve tr-5-7-yapim-eki, tr-6-7-sifatlar ve tr-6-7-06, tr-6-7-edatlar, tr-6-5-07/08, tr-7-1-06, tr-7-7-10/11, tr-7-7-kipler, tr-8-5-02, tr-8-6-08 ve tr-8-6-oge-sorulari, tr-8-7-08 ve tr-8-7-cati, tr-8-2-lgs-14, tr-8-2-lgs-04, tr-8-2-lgs-05..08.

### Matematik

**Matematik 1-4**

- Tema adları arama özetleri/hafıza; 1-2'de 7, 3'te 6 tema; numaralı temaların içerik dağılımı tahmin. 4: öğrenme alanları 6 başlıkta.
- Bakılacaklar: mat-1-1-02 (daire/çember), mat-1-6-03/04/05/07/08, mat-2-1-07, mat-2-6-03/04, mat-2-4-08/14 ve 3-4 çarpım kartları, mat-3-1-07/13/06/11, mat-3-4-07/12, mat-3-5-12/06/07, saat yazımı (15.30), mat-4-5-03/04/09/14 (birimkare), mat-4-3-01, mat-4-6-10. Birim dönüşümü kartlarında zayıf yanlış ifadeler.

**Matematik 5-8**

- Tema adları arama özetlerinden; 6 ve özellikle 7. sınıfın tema sırası/sayısı doğrulanamadı ("Dönüşüm" teması eklenmedi). 8: 12 ünite 8'e indirildi.
- Bakılacaklar (cevaplar doğru, kapsam belirsiz): mat-5-5-05, mat-5-5-06, mat-5-2-* üslü ve mat-5-2-uslu-ifadeler, mat-5-1-04/07/09, mat-6-1-06, mat-6-1-asal-carpanlar, mat-6-5-02/04/08, mat-6-7-* (05, 06), mat-7-1-*, mat-7-4-06, mat-7-5-07, mat-7-7-07, mat-8-1-04, mat-8-3-lgs-01, mat-5-3-uzunluk-donusumleri (zayıf çeldirici).

### Hayat Bilgisi

- Öğrenme alanları: Ben ve Okulum, Sağlığım ve Güvenliğim, Ailem ve Toplum, Yaşadığım Yer ve Ülkem, Doğa ve Çevre, Bilim, Teknoloji ve Sanat. 1, 5, 6. alan adı arama özetinden doğrulandı; 2, 3, 4 hafızadan. Konuların sınıflara dağılımı doğrulanmadı.
- Bakılacaklar: hb-1-2-duyu-organlari, hb-3-5-bitkinin-bolumleri, hb-3-5-atik-kutu-renkleri, hb-1-5-atik-kutulari, hb-2-2-09, hb-2-2-08, hb-2-2-05, hb-2-2-01, hb-3-4-11, hb-3-4-08, hb-3-4-bayram-olaylari, hb-2-4-ataturkun-ailesi, hb-3-6-05 (Bell), hb-3-6-09, hb-3-6-bilim-insanlari, hb-3-4-04/05/06, hb-3-5-10, hb-3-5-05.

### Fen Bilimleri

**Fen 3-5**

- 3. sınıf üniteleri arama özetlerinden: Bilimsel Keşif Yolculuğu; Canlılar Dünyasına Yolculuk; Yer Bilimciler İş Başında; Maddeyi Tanıyalım, Karıştırıp Ayıralım; Hareketi Keşfediyorum; Yaşamımızı Kolaylaştıran Elektrik; Toprağı Tanıyorum, Tarımı Keşfediyorum; Canlıların Yaşam Alanlarına Yolculuk (8. ünite yalnızca üçüncü taraf sitede; yoksa fen-3-8 silinmeli). 5. sınıf ünite sayısı (7/8) belirsiz.
- Bakılacaklar: fen-3-3-05/06/07, fen-3-3-katmanlar, fen-3-4-09 ve fen-3-4-ayirma, fen-3-7-05 ve fen-3-7-toprak-turleri, fen-4-1-06, fen-4-3-09, fen-4-2-icerik-gorev, fen-5-1-09, fen-5-1-ay-evreleri, fen-5-3-hucre-yapilari, fen-5-5-04/05/06/08 ve fen-5-5-hal-degisimleri, fen-5-6-06/08/10, fen-5-7-09/10.

**Fen 6-8**

- 6: Güneş Sistemi ve Tutulmalar; Kuvvetin Etkisinde Hareket; Canlılarda Sistemler; Işığın Yansıması ve Renkler; Maddenin Ayırt Edici Özellikleri; Elektriğin İletimi ve Direnç; Sürdürülebilir Yaşam ve Etkileşim. 7: Uzay Çağı; Kuvvet ve Enerjiyi Keşfedelim; Vücudumuzdaki Sistemler; Işığın Kırılması ve Mercekler; Maddenin Doğasına Yolculuk; Elektriklenme; Sürdürülebilir Yaşam ve Enerji (ad belirsiz). Adlar arama özetinden; ünite kapsamları (6-7, 7-3, 7-1, 7-5) tahmin.
- Bakılacaklar: fen-6-7-* ve fen-7-3-* (tümü), fen-6-3-*, fen-6-5-07/08 ve fen-6-5-ayirt-edici, fen-6-4-cukur-ayna, fen-6-4-03, fen-7-1-04/07/08/09, fen-7-4-ince-kenarli-mercek, fen-7-5-10/11, fen-7-6-10, fen-8-7-10, fen-7-2-enerji-donusumu, fen-8-7-isi-donusumu, fen-8-4-gruplar, fen-8-4-element-siniflari, fen-8-7-11, fen-8-7-lgs-02, fen-8-4-lgs-01.

### Sosyal Bilgiler

- Ünite adları verilen öğrenme alanı adları (doğrulanmadı). 6-7. sınıfta konuların öğrenme alanlarına dağılımı belirsiz: sos-7-1 (tamamı), sos-7-2, sos-6-2, sos-7-4, sos-7-5.
- Bakılacaklar: sos-6-3-08, sos-6-3-kurucular, sos-6-5-05 (bor), sos-6-2-09, sos-6-4-kuvvetler ve sos-6-4-01/04, sos-7-5-01/08, sos-7-6-bilginler, sos-7-6-09, sos-7-3-kasifler, sos-7-4-08, sos-4-4-01 ve sos-4-4-buluslar, sos-5-3-07/08, sos-4-2-07.

### T.C. İnkılap Tarihi ve Atatürkçülük; Din Kültürü 4. sınıf

- Ünite adları 2018 programı (hafızadan); konu yerleşimi belirsiz: TBMM'nin açılışı 3. ünitede, saltanatın kaldırılması 4'te, Nutuk 5'te.
- Bakılacaklar: ink-8-3-12 (Şerife Bacı), ink-8-3-lgs-04 (Akif'in ödülü), ink-8-5-09, ink-8-4-11 (Millet Mektepleri 1 Ocak 1929), ink-8-3-savaslar (Londra Konferansı, İtalyan çekilmesi), ink-8-3-antlasmalar (mudanya, moskova, kars), ink-8-4-ilkeler (halkçılık tanımı), ink-8-4-inkilaplar (alan etiketleri); dkab-4-4-ailesi (Abdullah), dkab-4-1-ifadeler (maşallah), dkab-4-5-06/07 (teyemmüm, gusül), dkab-4-4-09 (Hacerülesved), dkab-4-3-degerler.

### İngilizce

**İngilizce 2-4**

- 2-3. sınıf temaları (School Life, Classroom Life, Personal Life, Family Life, Homes & Houses & Neighbourhoods, Life in the City & the World) yalnızca arama özetlerinden; tema 5-6 adları ve kelimelerin temalara dağılımı doğrulanamadı.
- Bakılacaklar önerilenler: ing-3-4-06 ve ing-3-4-aile (son/daughter/parents); ing-3-5-06/09/11 (fridge, oven, bakery, pharmacy); ing-3-6-05/06 (mevsimler); ing-3-2-yer-bildirenler; ing-3-3-duygular; ing-2-3-10, ing-2-5-10, ing-2-6-08; ing-4-2-07 ve ing-4-2-ulkeler-uyruklar (Britain/British); ing-4-5-07; ing-4-6-deney-yonergeleri; ing-4-4-etkinlikler; ing-4-9-dis-gorunus (slim).

**İngilizce 5-8**

- 5-7 temaları (School Life, Classroom Life, Personal Life, Family Life, Life in the Neighbourhood & City, Life in the World, Life in Nature, Life in the Universe & Future) arama özetlerinden; sıra ve 7. sınıf adları tahmin; dil bilgisi dağılımı tahmin.
- Bakılacaklar: ing-5-6-*, ing-5-7-*, ing-5-8-*; ing-5-8-03, ing-6-5-*, ing-6-4-*, ing-6-6-04/05/06; ing-7-7-07, ing-7-8-04, ing-7-8-07; ing-8-7-06; ing-8-9-02, ing-8-9-04, ing-8-9-lgs-01; ing-8-10-lgs-02; ing-5-2-dersler; ing-8-6-sporlar.

## Yazım tercihleri
- Peygamber adlarında Diyanet yazımı kullanıldı: Davud, Yakub, Şuayb, Eyyub.
- Ek getirilirken ek, parantezden önce gelir: "Hz. Muhammed'in (sav)".
