// ============================================================
// CHATGRID — sw.js  (Service Worker)
// ============================================================

const CACHE = 'chatgrid-v4';
const STATIC = [
  '/',
  '/index.html',
  '/chat.html',
  '/style.css',
  '/config.js',
  '/app.js',
  '/chat.js',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js'
];

// Install: cache static assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(STATIC).catch(() => {}))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for static, network-first for API
self.addEventListener('fetch', e => {
  const url = e.request.url;
  // Skip supabase API calls (always fresh)
  if (url.includes('supabase.co')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        // Cache successful GET responses for static assets
        if (e.request.method === 'GET' && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached || new Response('Offline', { status: 503 }));
    })
  );
});

// Push notification handler (for future VAPID push)
self.addEventListener('push', e => {
  const data = e.data?.json() || {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'Chatgrid', {
      body:  data.body  || 'You have a new message',
      icon:  '/icon-192.png',
      badge: '/icon-72.png',
      data:  { url: data.url || '/chat.html' }
    })
  );
});

// Notification click → open app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wcs => {
      const url = e.notification.data?.url || '/chat.html';
      const matched = wcs.find(w => w.url.includes(url));
      if (matched) return matched.focus();
      return clients.openWindow(url);
    })
  );
});