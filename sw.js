// ============================================================
// PULSESHIP — sw.js  (Push Notifications + Caching)
// ============================================================

const CACHE = 'pulseship-v5';
const STATIC = [
  '/index.html','/chat.html','/style.css','/config.js',
  '/app.js','/chat.js','/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(STATIC).catch(()=>{})));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if(e.request.url.includes('supabase.co')||e.request.method!=='GET') return;
  e.respondWith(caches.match(e.request).then(cached=>{
    const net=fetch(e.request).then(res=>{if(res.status===200){const cl=res.clone();caches.open(CACHE).then(c=>c.put(e.request,cl));}return res;}).catch(()=>cached);
    return cached||net;
  }));
});

// ── Background push notification ──────────────────────────────
self.addEventListener('push', e => {
  const d = e.data ? e.data.json() : {};
  e.waitUntil(self.registration.showNotification(d.title||'Pulseship 💬', {
    body:    d.body    || 'You have a new message',
    icon:    '/icon-192.png',
    badge:   '/icon-192.png',
    tag:     d.tag     || 'ps-msg',
    vibrate: [200,100,200],
    data:    { url: d.url||'/chat.html', senderId: d.senderId||null },
    actions: [{ action:'open', title:'Open' },{ action:'dismiss', title:'Dismiss' }]
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  if(e.action==='dismiss') return;
  const url = e.notification.data?.url || '/chat.html';
  e.waitUntil(
    clients.matchAll({type:'window',includeUncontrolled:true}).then(wcs=>{
      const m = wcs.find(w=>w.url.includes('chat.html'));
      if(m){m.focus();m.postMessage({type:'open-chat',...e.notification.data});}
      else clients.openWindow(url);
    })
  );
});