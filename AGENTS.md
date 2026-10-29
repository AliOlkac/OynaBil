<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## OynaBil

- Arayüz metinleri Türkçedir; kod tanımlayıcıları İngilizce, kullanıcıya görünen rotalar Türkçedir (`/kurulum`, `/oyun/...`, `/sorular`).
- Sorular `src/content/<ders>/sorular/<sınıf>.json` içindedir; her değişiklikten sonra `npm test` çalıştırın (şema ve ünite doğrulaması).
- Oyun mantığı saf reducer'dır (`src/games/<oyun>/logic.ts`): `Date.now()` ya da rastgelelik içermez, zaman eylemle gelir. Bu kural çok cihazlı sürüm için korunmalıdır.
- Renk, süre ve yay değerleri yalnızca `src/app/globals.css` ve `src/lib/motion.ts` belirteçlerinden alınır (bkz. `docs/TASARIM.md`).
- Site durağan dışa aktarılır (`output: "export"`); `npm run build` service worker'ı da üretir.

### Kalite çıtası

Projenin sahibinin isteği: her geliştirme Halat Çekme sahnesi seviyesinde olmalı.

- **Oyun anı her şeyden önemli.** Bir oyun yalnızca çalışan bir arayüz değildir; gerçek bir sahnesi, karakterleri ve efektleri olur. Kazanma ve kaybetme anı bir gösteridir (Halat Çekme: kaybeden çamura düşer, kazanan sevinir).
- **Her olay görünür ve duyulur.** Doğru, yanlış, puan, seri ve bitiş için animasyon ve ses (`src/lib/sound.ts`) birlikte tasarlanır.
- **Tahta için tasarla.** 1920x1080 dokunmatik ekran, 8 metreden okunacak yazı. Eski tahtalarda da akıcı çalışmalı: SVG ya da canvas, tek `requestAnimationFrame` döngüsü, ağır filtre ve bulanıklık yok.
- **Göstermeden bitti sayma.** Her değişiklik derlenmiş sitede tarayıcıyla gerçekten oynatılır. 1920x1080, 1366x768 ve telefon boyutunda ekran görüntüsü alınır; animasyonlu anlar kare kare incelenir.
- **Erişilebilirlik ve belirteçler.** `prefers-reduced-motion` açıkken oyun yine oynanır, efektler sadeleşir. Yeni renk ve süreler önce belirteç olarak eklenir, `docs/TASARIM.md` güncellenir.
- **Temiz push.** `npm test`, `npx eslint .`, `npm run typecheck` ve `npm run build` temiz olmadan push yapılmaz.
