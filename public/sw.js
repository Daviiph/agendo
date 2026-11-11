const CACHE = 'agendo-v2';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  e.respondWith(fetch(request).then((r) => {
    const copia = r.clone();
    caches.open(CACHE).then((c) => c.put(request, copia));
    return r;
  }).catch(() => caches.match(request)));
});
