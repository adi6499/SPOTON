const CACHE_NAME = 'musicflow-v10';
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
    fetch(event.request).then(response => {
      // If network fetch succeeds, update the cache asynchronously
      const resClone = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
      return response;
    }).catch(() => {
      // If network fails (offline), return from cache
      return caches.match(event.request, { ignoreSearch: true });
    })
  );
});
