const V = 'skyplan-v1';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'lib/leaflet.js', 'lib/leaflet.css', 'lib/suncalc.js',
  'icons/icon-192.png', 'icons/icon-512.png',
  'fonts/sarabun-thai-400-normal.woff2', 'fonts/sarabun-thai-600-normal.woff2', 'fonts/sarabun-thai-700-normal.woff2',
  'fonts/sarabun-latin-400-normal.woff2', 'fonts/sarabun-latin-600-normal.woff2', 'fonts/sarabun-latin-700-normal.woff2'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k !== 'skyplan-tiles').map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.hostname === 'tile.openstreetmap.org') {
    // แผนที่: ใช้เน็ตก่อน แล้วเก็บไว้ดูออฟไลน์ภายหลัง
    e.respondWith(caches.open('skyplan-tiles').then(c => fetch(e.request).then(r => { if (r.ok || r.type === 'opaque') c.put(e.request, r.clone()); return r; }).catch(() => c.match(e.request))));
    return;
  }
  if (url.origin === location.origin) e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request)));
});
