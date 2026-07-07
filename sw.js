const CACHE_NAME = 'inventario-pos-v1';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './ico.png'
];

// Instalación: Guarda los archivos estáticos en caché
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Archivos cacheados exitosamente');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activación: Limpia cachés antiguos si hay una actualización
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Borrando caché antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Peticiones: Intercepta y responde desde caché si aplica
self.addEventListener('fetch', event => {
  // Ignora peticiones POST (API de GAS) o de otros dominios para mantener la lógica de base de datos en vivo
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Retorna la respuesta en caché si existe, si no, realiza la petición a la red
        return response || fetch(event.request);
      })
  );
});
