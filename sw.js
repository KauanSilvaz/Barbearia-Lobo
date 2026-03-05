const CACHE_NAME = 'lobo-da-bahia-v1';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(resposta => {
        const respostaClonada = resposta.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, respostaClonada);
        });
        return resposta;
      })
      .catch(() => caches.match(event.request))
  );
});