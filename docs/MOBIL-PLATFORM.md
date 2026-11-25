# OynaBil Mobil: rekabetçi ders oyunu platformu (plan)

Bu belge, akıllı tahtadaki OynaBil'in öğrencilerin kendi telefonlarında birbirleriyle yarıştığı, ligli ve sezonlu bir mobil oyuna dönüşmesinin planıdır. Henüz bir karar belgesi değil, bir yol haritasıdır. Sondaki "Karar verilecekler" bölümü, başlamadan önce netleşmesi gereken soruları listeler.

## 1. Fikir bir cümlede

Çocuklar ders sorularını cevaplayarak birbirleriyle maç yapar: penaltı atar, kale yıkar, Türkiye haritasında il fetheder. Kazandıkça lig puanı toplar, Bronz'dan Elmas'a çıkar. Kaybettiği maçın sonunda da hangi konuda zorlandığını görür ve oraya çalışır.

## 2. İlkeler

1. **Önce eğitim, sonra oyun.** Bir maçı bilgi kazandırır; el becerisi yalnızca heyecanı artırır. Hiçbir maç, soruları bilmeden yalnızca refleksle kazanılamaz.
2. **Kaybetmek de öğretir.** Her maçın sonunda yanlışlar açıklamalarıyla gösterilir ve zayıf konu için kısa bir çalışma önerilir.
3. **Adil rekabet.** Oyuncular aynı sınıf düzeyinde, benzer güçteki rakiplerle eşleşir. Para ile güç satın alınmaz; satılan bir şey olursa yalnızca görünüştür (forma, top, kale süsü).
4. **Çocuk güvenliği baştan tasarlanır.** Açık sohbet yoktur, kişisel veri en azdır, veli onayı vardır (bkz. 9. bölüm).
5. **Tahta sürümüyle tek kod tabanı.** Oyun kuralları bugün de saf fonksiyonlardır (`src/games/*/logic.ts`). Mobil sürümde aynı kurallar sunucuda çalışır, sahneler ve sesler telefonda yeniden kullanılır.

## 3. Oyun modları

### 3.1 Penaltı Düellosu (1'e 1, ilk mod)

İki oyuncu, gerçek bir penaltı atışları serisi gibi sırayla şutçu ve kaleci olur. Her oyuncu beş şut çeker; eşitlikte seri penaltıya geçilir.

Her atıştan önce iki oyuncuya aynı soru gelir (12 saniye):

| | Doğru cevap | Yanlış cevap ya da süre dolması |
|---|---|---|
| **Şutçu** | Nişanını istediği yere alır, top normal sapar | Top çok sapar, büyük olasılıkla auta ya da kaleciye gider |
| **Kaleci** | Üç yönden (sol, orta, sağ) birini seçip atlar | Kaleci geç kalır: yalnızca ortayı tutabilir |

- **Akıl oyunu:** Şutçu nişan alırken kaleci aynı anda bir yön seçer. İkisi de karşısındakinin seçimini görmez. Bilgisayar kalecinin 1/3 rastgeleliği yerine "bu sefer sağa mı atar?" tahmini oyunun özü olur.
- **Hız bonusu:** Doğru cevabı ilk veren oyuncu nişanını 1 saniye erken kilitler. Hız avantaj sağlar ama bilmeden kazandırmaz.
- **Süre:** Bir maç yaklaşık 4 dakika sürer: on atış ve atış başına yaklaşık 20 saniye.

### 3.2 Bil ve Fethet: Türkiye (3–4 kişilik)

- **Harita:** Türkiye haritası; 81 il ya da daha kısa maç için 7 coğrafi bölgeye bölünmüş yaklaşık 30 parça. Her oyuncu bir köşeden başlar, başkentinde bir kule vardır.
- **Fetih turları:** Herkese aynı soru gelir. En hızlı doğru cevap veren, sınırdaki boş bir ili alır. Sonra gelen doğrular da sırayla il alır.
- **Saldırı turları:** Sıradaki oyuncu bir komşu ile saldırır ve iki oyuncu düello sorusu çözer (sayısal tahmin sorularıyla eşitlik bozulur). Saldıran kazanırsa il el değiştirir. Başkente saldırmak için kulenin üç canını bitirmek gerekir.
- **Kuleler:** Savunmada doğru cevap veren oyuncunun ilindeki kule bir kat yükselir; yüksek kule savunmada bir hak daha verir.
- **Süre ve sonuç:** Maç yaklaşık 10 dakika ya da 6 tur sürer. En çok toprağı olan kazanır; başkentini kaybeden oyundan çıkar.
- **Görünüm:** Haritada iller takım rengine boyanır, fetihte bayrak dikilir, kule yıkılınca Kule Yıkmaca'nın yıkılış sahnesi küçük ölçekte oynar.
- **2 kişilik sürüm:** Aynı harita, yarıya bölünmüş başlangıçla.

### 3.3 Sonra eklenebilecekler

- **Okçuluk ve Basketbol düellosu:** Penaltı Düellosu'nun kalıbıyla; iki oyuncu aynı anda atar, puanlar karşılaştırılır.
- **Takım maçı (2'ye 2):** Arkadaşlar aynı takımda.
- **Sınıf ligi:** Öğretmen sınıfı kurar, haftalık sınıf sıralaması tahtada gösterilir. Bu, tahta sürümüyle mobili birbirine bağlar.

## 4. Maçın akışı

1. **Eşleşme:**
   - "Dereceli" (lig puanı değişir), "Dostluk" (arkadaşa meydan okuma) ya da "Antrenman" (bilgisayara karşı).
   - Oyuncu ders ve ünite seçebilir ya da "karışık" der. Dereceli maçta ders, haftalık lig dersi ya da oyuncunun seçtiği derslerden gelir.
2. **Maç:** 3.1 ya da 3.2.
3. **Maç sonu ekranı:**
   - Lig puanı değişimi (+18 / −14 gibi).
   - Yanlış cevapların açıklamaları.
   - "Zayıf konun: Kesirlerde toplama" kartı ve 2 dakikalık çalışma bağlantısı.
4. **Rövanş:** Tek dokunuşla; aynı rakiple art arda en fazla 3 maç.

Oyuncu sayısı azken canlı eşleşme boş kalabilir. Bunun için **sıralı düello** gerekir: oyuncu kendi atışlarını oynar, rakip birkaç saat içinde kendininkini oynar ve sonuç ikisine bildirilir. Bu yapı ilk aşamada canlı maçtan daha önemlidir (bkz. 10. bölüm).

## 5. Lig ve puan sistemi

- **Ligler:** Bronz, Gümüş, Altın, Platin, Elmas ve en üstte Usta. Elmas'a kadar her ligin III, II, I basamakları vardır.
- **Görünen puan (LP):** Bir basamakta 0–100 lig puanı. 100'e ulaşan oyuncu bir sonraki basamağa geçer; Bronz III'ten Elmas I'e yaklaşık 15 basamak vardır.
- **Gizli beceri puanı (MMR):** Eşleşme bununla yapılır (Glicko-2 benzeri). Güçlü rakibi yenmek daha çok, zayıf rakibe kaybetmek daha çok puan değiştirir. LP kazancı, MMR liginin üstündeyse hızlanır.
- **Sınıfa göre ayrı ligler:** 1–4, 5–6 ve 7–8. sınıflar ayrı havuzlardır. 5. sınıf öğrencisi 8. sınıfla eşleşmez.
- **Küsmemek için korumalar:**
  - Bronz ve Gümüş'te lig düşmesi yoktur.
  - Yeni basamağa çıkınca ilk 3 maçta puan kaybedilmez.
  - Arka arkaya 3 yenilgiden sonra bir sonraki maç daha dengeli bir rakiple eşleşir.
- **Sezon:** 8 hafta, okul dönemine göre. Sezon sonunda ulaşılan lig için kalıcı rozet ve görünüş ödülü verilir. Yeni sezonda herkes biraz aşağıdan başlar (yumuşak sıfırlama).
- **Günlük sınır:** Dereceli maç sayısı günde 15 ile sınırlıdır (veli ayarlayabilir). Amaç çalışmayı teşvik etmek, ekrana bağlamak değil.

## 6. Eğitici döngü

- **Zayıf konu takibi:** Her oyuncunun ünite bazında başarı oranı tutulur. Maç sonunda en zayıf konu önerilir.
- **Çalışma ödülü:** Zayıf konudan 10 soruluk kısa bir çalışma bitiren oyuncu bir sonraki dereceli maçta "kalkan" kazanır: yenilirse daha az lig puanı kaybeder. Çalışmak böylece oyunda işe yarar.
- **Tekrarlı öğrenme:** Yanlış yapılan sorular birkaç gün sonra çalışma moduna geri gelir.
- **Günlük görevler:** "Bugün 3 maç", "Fen'den 2 galibiyet", "Bir zayıf konuyu çalış" gibi. Ödül görünüş eşyasıdır.
- **Ders videoları (ileri aşama):**
  - Her ünite için 2–5 dakikalık kısa anlatımlar.
  - Maç sonunda zayıf konunun videosu önerilir. Videoyu izleyip ardından 3 soruyu doğru çözen oyuncu o konuda "ustalık" rozeti alır.
  - Videolar öğretmen hesabıyla yüklenir ve yayından önce gözden geçirilir.
- **Öğretmen ve veli paneli:** Öğrencinin hangi derste ne kadar çalıştığı ve zayıf konuları. Maç geçmişi değil, öğrenme özeti gösterilir.

## 7. Soru kalitesi

Rekabetçi oyunda soru hatası maçın sonucunu değiştirir; tahtadan daha da önemlidir.

1. **Tekrar etmeme (oyuncu başına):**
   - Her oyuncunun gördüğü sorular sunucuda tutulur.
   - Bir oyuncuya aynı soru, havuz tükenmeden bir daha gelmez.
   - Düelloda iki oyuncunun da daha önce görmediği sorular seçilir.
   - (Tahta sürümünde bu sorun düzeltildi: soru ekrana geldiği anda hafızaya yazılıyor.)
2. **Gerçek zorluk ölçümü:**
   - Her sorunun kaç kişi tarafından ne kadar sürede doğru cevaplandığı tutulur. Yazarın verdiği zorluk (1–3) birkaç yüz cevaptan sonra gerçek veriyle güncellenir.
   - Düelloda iki tarafa denk zorlukta sorular gelir.
3. **Kendiliğinden işaretleme:** Neredeyse herkesin bildiği, neredeyse kimsenin bilemediği ya da güçlü oyuncuların zayıflardan daha çok yanlış yaptığı sorular (çoğunlukla cevap anahtarı hatası ya da belirsiz soru) incelemeye düşer ve dereceli maçtan çekilir.
4. **Oyuncu bildirimi:** Maç sonunda "Bu soruda hata var" düğmesi bugün de var. Mobilde bildirimler öğretmen ve editör kuyruğuna gider.
5. **Editör onayı:** Yeni sorular önce antrenman modunda kullanılır, dereceli maça yalnızca istatistiği temiz çıkınca girer.
6. **Havuzu büyütmek:**
   - Rekabetçi oyunda havuz hızlı tükenir. Bugün 281 ünitede 10.682 soru var, ünite başına ortalama 38.
   - Hedef, ünite başına en az 120 soru, LGS sınıflarında daha fazlası.
   - Mevcut soru üretim hattı (`scripts/` ve `docs/ICERIK-KONTROLU.md`) bunun için kullanılır.

## 8. Teknik yapı

| Katman | Öneri | Not |
|---|---|---|
| Uygulama | Bugünkü Next.js uygulaması, Capacitor ile Android ve iOS'a sarılır | Sahneler, sesler, soru ekranları aynı kalır; mobil ekranlar yeniden düzenlenir |
| Hesap ve veri | PostgreSQL (ör. Supabase) | Oyuncu, lig, maç geçmişi, soru istatistikleri |
| Canlı maç | WebSocket oyun sunucusu (ör. Colyseus ya da Cloudflare Durable Objects) | Her maç bir "oda"; kurallar bugünkü reducer'lar |
| Sıralı düello | Sunucuda zamanlanmış iş | Canlı bağlantı gerektirmez |
| Soru dağıtımı | Sunucu soruyu cevapsız gönderir, cevabı sunucu değerlendirir | Telefonda doğru cevap hiç bulunmaz |
| Bildirim | Firebase Cloud Messaging | "Rakibin oynadı", "Sezon bitiyor" |
| Videolar | Akış hizmeti (ör. Cloudflare Stream, Mux) | Uyarlanabilir kalite, düşük maliyet |

**Hileye karşı:**
- Cevap ve sonuç sunucuda belirlenir; telefon yalnızca dokunuşu gönderir.
- Kaleci ve şutçu seçimleri aynı anda kilitlenir, kimse ötekini göremez.
- Olağandışı hız ve başarı örüntüleri (ör. her soruyu 0,3 saniyede doğru cevaplamak) işaretlenir.

**Kurallar zaten hazır:** Penaltı, Kule Yıkmaca, Basketbol ve Okçuluk'un mantığı zaman ve rastgelelik içermeyen saf fonksiyonlardır. Rastgelelik oyun tohumundan gelir, zaman eylemle gelir. Aynı fonksiyonlar sunucuda maçın hakemi olur, telefonda da animasyonu önceden oynatmak için çalışır.

## 9. Çocuk güvenliği ve KVKK

- **Kayıt:** 13 yaş altı için veli e-postası ve onayı zorunlu. Gerçek ad yerine takma ad; takma adlar uygunsuz kelime süzgecinden geçer.
- **İletişim:** Açık sohbet yok, yalnızca hazır tepkiler ("İyi oyundu!", emoji). Arkadaşlık yalnızca davet koduyla ya da aynı sınıfta.
- **Veri:** En az veri tutulur: sınıf, il, takma ad, öğrenme istatistikleri. Konum, rehber ve fotoğraf istenmez.
- **Veri işleme belgeleri:** KVKK aydınlatma metni, açık rıza ve veri silme talebi uygulamanın içinden yapılabilir.
- **Mağaza kuralları:** Google Play'in "Families" ve App Store'un çocuk kategorisi kurallarına uyulur. Reklam olmaz ya da yalnızca çocuğa uygun, kişiselleştirilmemiş reklam gösterilir.
- **Sağlıklı kullanım:** Günlük maç sınırı, gece saatlerinde dereceli maçın kapanması ve veli panelinden süre ayarı.

## 10. Aşamalar

Süreler, 1–2 geliştirici ve yarı zamanlı bir içerik editörü varsayımıyla kabadır.

| Aşama | Kapsam | Kabaca süre |
|---|---|---|
| **0. Hazırlık** | Tekrar sorununun düzeltilmesi (yapıldı); soru havuzunu büyütme; mobil ekran taslakları; KVKK danışmanlığı | 3–4 hafta |
| **1. Hesaplar ve sıralı düello** | Kayıt ve veli onayı, profil, arkadaşa meydan okuma, sıralı Penaltı Düellosu, maç sonu çalışma önerisi, Android kapalı beta (2–3 okul) | 8–10 hafta |
| **2. Dereceli ve ligler** | Canlı 1'e 1 Penaltı Düellosu, eşleştirme, MMR, ligler ve ilk sezon, günlük görevler, iOS | 8–10 hafta |
| **3. Bil ve Fethet: Türkiye** | 3–4 kişilik harita modu, kuleler, 2 kişilik sürüm | 8–12 hafta |
| **4. Öğretmen ve videolar** | Sınıf ligi, öğretmen ve veli paneli, video yükleme, ustalık rozetleri | 6–8 hafta |
| **5. Daha çok mod** | Okçuluk ve Basketbol düellosu, 2'ye 2 takım maçı | sürekli |

Kapalı beta en önemli adımdır. Okullarda gerçek çocuklarla oynatıp eşleşme süresine, maç uzunluğuna ve küsme oranına bakmadan dereceli sisteme geçilmemeli.

## 11. Başarı ölçütleri

- **Öğrenme:** Aynı ünitede iki hafta arayla başarı oranının artması; zayıf konu önerisine tıklayıp çalışmayı bitirenlerin oranı.
- **Bağlılık:** Haftada en az 3 gün oynayan oyuncu oranı; ilk haftadan sonra geri gelme oranı.
- **Sağlık:** Eşleşme bekleme süresinin canlı modda 20 saniyenin altında olması; 3 yenilgi sonrası oyunu bırakma oranı; günlük sınıra takılan oyuncu oranı (çok yüksekse sınır düşünülmeli).
- **Kalite:** Bildirilen soru hatası oranı; istatistikle işaretlenen soru sayısı.

## 12. Riskler

| Risk | Önlem |
|---|---|
| Oyuncu az, eşleşme boş kalır | Önce sıralı düello ve okul bazlı beta; bot rakip yalnızca antrenmanda |
| Rekabet zayıf öğrenciyi küstürür | Alt liglerde düşme yok, denk eşleşme, kaybedene çalışma önerisi ve kalkan |
| Soru havuzu çabuk tükenir | Havuzu büyütme hedefi, oyuncu başına tekrar etmeme, istatistikle kalite |
| Hile (cevap arama, ikinci cihaz) | Kısa soru süresi, sunucu hakemliği, örüntü tespiti; dereceli puan yalnızca bir eğlence ölçüsü olarak sunulur, not yerine geçmez |
| KVKK ve mağaza ret riski | Baştan hukuki danışmanlık, en az veri, veli onayı |
| Sunucu maliyeti | Sıralı düello ucuzdur; canlı maç sunucusu oyuncu sayısıyla büyür. Videolar en pahalı kalemdir, son aşamada |

## 13. Karar verilecekler

1. **Hedef kitle:** Ücretsiz mi, okul lisansı mı, aile aboneliği mi? Gelir modeli lig ve ödül tasarımını etkiler.
2. **İlk sınıf aralığı:** Başlangıç için LGS'ye hazırlanan 7–8. sınıflar en güçlü motivasyona sahip; 1–4. sınıflar için rekabet yerine işbirliği modu daha uygun olabilir.
3. **Okul bağlantısı:** Öğrenciler okul ve sınıf koduyla mı girer, serbest kayıtla mı? Okul koduyla girmek güvenlik ve sınıf ligi için kolaylık sağlar.
4. **Videoların kaynağı:** Kendi çekimleriniz, öğretmenlerin yüklemesi ya da lisanslı içerik.
5. **Uygulamanın adı ve marka:** Tahta sürümüyle aynı (OynaBil) mı kalacak?
