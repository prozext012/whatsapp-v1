// Service worker: cache app shell + SDK/font (stale-while-revalidate). Firestore/Storage tidak di-cache.
const V = 'dixz-v2';
const SHELL = ['./', 'index.html', 'style.css', 'manifest.json', 'icons/icon-192.png', 'icons/icon-512.png', 'js/app.js', 'js/auth.js', 'js/chat.js', 'js/firebase.js', 'js/media.js', 'js/profile.js', 'js/sfx.js', 'js/status.js', 'js/ui.js'];
const CDN = ['www.gstatic.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
self.addEventListener('install', e => e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url); if (u.origin !== location.origin && !CDN.includes(u.hostname)) return;
  if (r.mode === 'navigate') return e.respondWith(fetch(r).catch(() => caches.match('index.html')));
  e.respondWith(caches.match(r).then(hit => {
    const net = fetch(r).then(res => { if (res.ok || res.type === 'opaque') { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); } return res; }).catch(() => hit);
    return hit || net;
  }));
});
