// RishtaOS service worker — offline-friendly app shell caching.
const CACHE_NAME = 'rishtaos-cache-v1';
const APP_SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './assets/onboard-uptime.jpg',
  './assets/onboard-special-dates.jpg',
  './assets/onboard-support-mode.jpg',
  './assets/banner-hero.jpg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Network-first for navigation requests, fallback to cached shell when offline.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Cache-first for same-origin static assets.
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return (
          cached ||
          fetch(event.request)
            .then((res) => {
              const resClone = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
              return res;
            })
            .catch(() => cached)
        );
      })
    );
  }
});
