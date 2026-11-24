// Month Ahead service worker: serves the app's own files from a local cache so it
// works offline. It never touches your data (that lives in IndexedDB) and never
// contacts any other website.
// When the app's code changes, bump CACHE_VERSION so phones pick up the update.
const CACHE_VERSION = 'month-ahead-v1.1.0';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './js/app.js',
  './js/calc.js',
  './js/store.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((c) => c.addAll(ASSETS.map((a) => new Request(a, { cache: 'reload' })))));
  // First install takes over right away; later versions wait for the user to tap "Update now".
  if (!self.registration.active) self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('month-ahead-') && k !== CACHE_VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never handle (or make) outside requests
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    if (req.mode === 'navigate') {
      return (await cache.match('./index.html')) || fetch(req);
    }
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok && url.pathname.startsWith(new URL('./', self.location).pathname)) cache.put(req, res.clone());
    return res;
  })());
});
