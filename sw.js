const CACHE_NAME = 'musicflow-v139';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/haptics.js',
  './js/ambience.js',
  './js/api.js',
  './js/storage.js',
  './js/player.js',
  './js/ui.js',
  './js/recommendations.js',
  './js/smart-downloads.js',
  './js/moods.js',
  './js/mix-suite.js',
  './js/language-hubs.js',
  './js/podcasts.js',
  './js/radio-tuner.js',
  './js/samples.js',
  './js/playlist-sharing.js',
  './js/video-switcher.js',
  './js/settings.js',
  './js/download.js',
  './js/recap.js',
  './js/search.js',
  './js/app.js',
  './assets/logo.jpg',
  './assets/logo.png',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const asset of ASSETS) {
        try {
          await cache.add(asset);
        } catch (_) {}
      }
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = event.request.url;
  if (url.includes('/api/') || url.includes('.mp4') || url.includes('.m4a') || url.includes('.mp3') || url.includes('saavncdn.com')) {
    return;
  }

  // Network-first with cache fallback
  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .then((response) => {
        if (response && response.status === 200) {
          const resClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request, { ignoreSearch: true });
      })
  );
});
