const CACHE_NAME = "laburapp-pwa-v1";

self.addEventListener("install", (event) => {
   
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
   
    event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {

    event.respondWith(
        fetch(event.request).catch(() => {
           
            return new Response("Estás sin conexión y este recurso no está cacheado.", {
                status: 503,
                statusText: "Service Unavailable"
            });
        })
    );
});
