// Caches the app shell so SIDLNE opens instantly and works on flaky
// connections. Data always comes from Supabase over the network.
const CACHE_NAME = 'sidlne-__BUILD__';
const SHELL = ['./', './index.html', './config.js', './assets/app.js', './assets/styles.css', './manifest.webmanifest', './icons/apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // Only handle our own static files; never cache API or auth traffic
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // Network first so a new deploy shows up immediately; fall back to cache offline
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then((hit) => hit || caches.match('./index.html')))
  );
});
