/* Retires any historical Renaiss service worker that may still control iOS home-screen clients. */
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    await self.registration.unregister();
    const controlledClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    await Promise.all(controlledClients.map((client) => client.navigate(client.url)));
  })());
});
