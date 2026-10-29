/*
 * OynaBil service worker. `npm run build` bu dosyayı out/sw.js olarak yazar ve
 * PRECACHE listesini derlenmiş dosyalarla doldurur. Okul interneti kesilse de
 * bir kez açılmış tahtada oyunlar çalışmaya devam eder.
 */
const VERSION = "__VERSION__";
const PRECACHE = __PRECACHE__;
const CACHE = `oynabil-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("oynabil-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function fromCache(request) {
  const cache = await caches.open(CACHE);
  return (await cache.match(request)) || (await cache.match(request, { ignoreSearch: true }));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Derlenmiş dosyalar adlarında sürüm taşır: önce önbellek.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(fromCache(request).then((hit) => hit || fetch(request)));
    return;
  }

  // Sayfalar ve diğerleri: önce ağ (güncel kalsın), ağ yoksa önbellek.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && url.search === "") {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => (await fromCache(request)) || (request.mode === "navigate" ? fromCache(new Request("/")) : Response.error())),
  );
});
