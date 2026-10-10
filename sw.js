// Service worker: file milik sendiri = network-first (update langsung masuk, offline pakai cache);
// SDK Firebase & font = stale-while-revalidate. Firestore/Storage tidak di-cache.
const V = 'dixz-v4';
const SHELL = ['./', 'index.html', 'style.css', 'manifest.json', 'icons/icon-192.png', 'icons/icon-512.png', 'js/app.js', 'js/auth.js', 'js/chat.js', 'js/firebase.js', 'js/media.js', 'js/profile.js', 'js/receipt.js', 'js/sfx.js', 'js/status.js', 'js/ui.js'];
const CDN = ['www.gstatic.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
self.addEventListener('install', e => e.waitUntil(caches.open(V).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim())));
const save = (r, res) => { if (res.ok || res.type === 'opaque') { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); } return res; };
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url), same = u.origin === location.origin;
  if (!same && !CDN.includes(u.hostname)) return;
  if (same) {
    e.respondWith(fetch(r).then(res => save(r, res)).catch(() => caches.match(r).then(h => h || (r.mode === 'navigate' ? caches.match('index.html') : undefined))));
  } else {
    e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(res => save(r, res))));
  }
});
