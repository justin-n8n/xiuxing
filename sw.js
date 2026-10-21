/* 離線快取：有網路時先抓最新版（順便更新快取），沒網路時用快取。
   新增檔案時把它加進 FILES，並把 VERSION 加一。 */
const VERSION = 'xiuxing-v0.3.0';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'sutras.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'assets/river.ogg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(hit => hit || caches.match('index.html')))
  );
});
