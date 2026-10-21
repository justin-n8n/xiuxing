/* 離線快取：有網路時先抓最新版（順便更新快取），沒網路時用快取。
   新增檔案時把它加進 FILES，並把 VERSION 加一。
   v0.6.3：一律先跟網站確認有沒有新版（cache: 'no-cache'），不再沿用手機瀏覽器留著的舊檔（GitHub Pages 會讓舊檔留 10 分鐘）。 */
const VERSION = 'xiuxing-v0.8.1';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'sutras.js', 'quotes.js', 'monk.svg', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'assets/river.ogg', 'assets/copyfont.woff2'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION)
    .then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))) // 裝新版時直接從網站抓，不拿瀏覽器快取裡的舊檔
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(new Request(e.request.url, { cache: 'no-cache' })).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(hit => hit || caches.match('index.html')))
  );
});
