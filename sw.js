const CACHE_NAME = 'lobo-da-bahia-v2';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', event => {
  // 1. NÃO CACHEAR requisições que não sejam GET
  // 2. NÃO CACHEAR requisições para o Firebase/Google APIs (Causa erro de login intermitente)
  if (
    event.request.method !== 'GET' || 
    event.request.url.includes('googleapis.com') || 
    event.request.url.includes('firebase')
  ) {
    return;
  }

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