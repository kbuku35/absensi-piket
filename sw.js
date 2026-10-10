/* ============================================================
   SERVICE WORKER — Absensi Piket BPBD
   Strategi: network-first (selalu ambil versi terbaru bila online),
   fallback ke cache saat offline. API tidak di-cache.
   ============================================================ */

const CACHE_NAME = 'absen-piket-v3';
const ASET = [
  './',
  './index.html',
  './css/style.css',
  './js/config.js',
  './js/api.js',
  './js/app.js',
  './js/fase2.js',
  './manifest.json'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (c) {
      return c.addAll(ASET);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE_NAME) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  const url = e.request.url;
  // Jangan cache permintaan ke Apps Script (API)
  if (url.indexOf('script.google.com') >= 0 || url.indexOf('googleusercontent') >= 0) return;

  e.respondWith(
    fetch(e.request).then(function (resp) {
      // Simpan salinan ke cache untuk mode offline
      const salinan = resp.clone();
      caches.open(CACHE_NAME).then(function (c) { c.put(e.request, salinan); });
      return resp;
    }).catch(function () {
      return caches.match(e.request);
    })
  );
});
