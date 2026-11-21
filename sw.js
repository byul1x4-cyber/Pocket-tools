/* 오프라인에서도 열리도록 얇게 캐시합니다. (앱 로직은 전부 로컬 처리) */
const CACHE = 'pocket-tools-v1';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/util.js',
  './js/exif.js',
  './js/url.js',
  './js/pdf.js',
  './js/compress.js',
  './js/qr.js',
  './js/resize.js',
  './js/watermark.js',
  './js/app.js',
  './libs/qrcode.js',
  './libs/jspdf.umd.min.js',
  './libs/pdf.min.js',
  './libs/pdf.worker.min.js',
  './manifest.json',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon.svg'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* 네트워크 우선(항상 최신), 실패하면 캐시 */
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok && new URL(req.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
  );
});
