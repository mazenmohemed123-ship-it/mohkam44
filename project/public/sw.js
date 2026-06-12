const CACHE_NAME = 'mohkam-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  if (url.origin !== self.location.origin) {
    return fetch(e.request);
  }

  // Network-only for API, Supabase, and realtime, strictly excluding sensitive user data from cache
  if (
    url.origin.includes('supabase') || 
    url.pathname.includes('/api/') || 
    url.pathname.includes('/v1/') ||
    e.request.headers.get('Authorization')
  ) {
    e.respondWith(
      fetch(e.request).catch(() => {
        return new Response(JSON.stringify({ error: "Offline - Connection Lost" }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Cache-first for static local assets
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(e.request).then((networkResponse) => {
        // Only cache static local files, excluding any non-GET requests or dynamic routes
        if (
          networkResponse && 
          networkResponse.status === 200 && 
          e.request.method === 'GET' &&
          !url.pathname.includes('/private/')
        ) {
          const cacheCopy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, cacheCopy);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Return index.html as fallback for SPA routing
        if (e.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      });
    })
  );
});
