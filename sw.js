// Service worker: rede primeiro, cópia guardada quando estiver sem internet.
// Os dados do Supabase nunca passam pelo cache.
const CACHE = 'pp-v1.0.0';
const BASE = ['./', 'index.html', 'app.html', 'css/estilo.css', 'js/config.js', 'js/supa.js', 'js/ui.js',
  'js/login.js', 'js/app.js', 'js/dados.js', 'js/calendario.js', 'manifest.webmanifest', 'assets/icone-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co')) return;
  const mesmaOrigem = url.origin === location.origin;
  const cdn = url.hostname === 'cdn.jsdelivr.net';
  if (!mesmaOrigem && !cdn) return;
  e.respondWith(
    fetch(req).then((r) => {
      if (r.ok) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
      return r;
    }).catch(() => caches.match(req, { ignoreSearch: true }))
  );
});
