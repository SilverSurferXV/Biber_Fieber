export async function handle(request: Request) {
  try {
    const swScript = `
const CACHE_NAME = 'biber-fieber-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') return;
  
  // Do not intercept or cache any API requests
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/_api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache successful responses
        if (networkResponse && networkResponse.ok) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        // Fallback to cache if network fails
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Return a generic fallback response if both network and cache fail
        return new Response("Network error occurred and no cached response available.", {
          status: 408,
          headers: { 'Content-Type': 'text/plain' }
        });
      })
  );
});
`;

    return new Response(swScript, {
      status: 200,
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Service-Worker-Allowed": "/"
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(errorMessage, { status: 500, headers: { "Content-Type": "text/plain" } });
  }
}