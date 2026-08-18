const CACHE_NAME = 'musicflow-v7';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/api.js',
  './js/storage.js',
  './js/player.js',
  './js/ui.js',
  './js/download.js',
  './js/app.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/')) return;
  if (event.request.url.includes('.mp4') || event.request.url.includes('.m4a') || event.request.url.includes('.mp3')) return;
  if (event.request.url.includes('images') || event.request.url.includes('c.saavncdn.com')) return;

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});
