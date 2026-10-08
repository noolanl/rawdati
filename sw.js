// Kidora — service worker (push notifications)
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('kidora-shell-') && k !== SHELL).map(k => caches.delete(k))))
    .then(() => self.clients.claim())));

// offline app shell: always try the network first (so updates show at once),
// fall back to the last copy when the connection drops. API calls are never cached.
const SHELL = 'kidora-shell-v1';
function cacheable(req){
  if (req.method !== 'GET') return false;
  const u = new URL(req.url);
  if (u.origin === self.location.origin) return req.mode === 'navigate' || /\.(png|json|css|woff2|js)$/.test(u.pathname);
  return /^https:\/\/(cdn\.jsdelivr\.net\/npm\/@supabase|fonts\.(googleapis|gstatic)\.com)/.test(req.url);
}
self.addEventListener('fetch', event => {
  const req = event.request;
  if (!cacheable(req)) return;
  event.respondWith(
    fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) {
        const copy = res.clone();
        const key = req.mode === 'navigate' ? new URL('./', self.location).href : req;
        caches.open(SHELL).then(c => c.put(key, copy)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(req.mode === 'navigate' ? new URL('./', self.location).href : req)
                    .then(r => r || Response.error()))
  );
});

self.addEventListener('push', event => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; }
  catch (_) { d = { title: 'Kidora', body: event.data ? event.data.text() : '' }; }
  const title = d.title || 'Kidora';
  const options = {
    body: d.body || '',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    dir: 'rtl',
    lang: 'ar',
    tag: d.tag || 'kidora',
    renotify: true,
    data: { url: d.url || './' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      return self.clients.openWindow(url);
    })
  );
});
