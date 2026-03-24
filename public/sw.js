self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      return self.registration.unregister();
    }).then(() => {
      return clients.claim();
    })
  );
});

self.addEventListener('fetch', (e) => {
  // Do nothing, let the browser handle the request
});
