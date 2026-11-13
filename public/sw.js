// Service Worker de Se7en.
//
// - Solo maneja peticiones GET del MISMO origen (la app). Las llamadas a
//   Firebase/Google (Firestore, Auth) pasan directo a la red: cachearlas puede
//   devolver datos viejos o romper las conexiones de Firestore.
// - Los archivos de /assets/ llevan hash en el nombre (inmutables): cache primero.
// - El resto (index.html, manifest, logo): red primero, cache si no hay conexión.
// - Cambiar CACHE_VERSION en cada cambio de este archivo para limpiar caches viejos.

const CACHE_VERSION = 'v4';
const CACHE_NAME = `se7en-${CACHE_VERSION}`;

// Rutas relativas al scope del SW (p. ej. https://cassdev.com.ar/se7en/).
const scopeUrl = (path) => new URL(path, self.registration.scope).toString();
const STATIC_CACHE_URLS = ['./', './manifest.json', './logo-se7en.jpeg'].map(scopeUrl);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_CACHE_URLS))
      .catch((error) => console.warn('[SW] Error durante la instalación:', error))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

const putInCache = (request, response) => {
  if (response && response.status === 200 && response.type === 'basic') {
    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
  }
  return response;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Firebase, Google y cualquier otro dominio: no interceptar.
  if (url.origin !== self.location.origin) return;
  // Fuera del scope de la app: no interceptar.
  if (!request.url.startsWith(self.registration.scope)) return;

  // Assets con hash: cache primero.
  if (url.pathname.includes('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((res) => putInCache(request, res)))
    );
    return;
  }

  // Resto: red primero, cache como respaldo sin conexión.
  event.respondWith(
    fetch(request)
      .then((res) => putInCache(request, res))
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          if (request.mode === 'navigate') return caches.match(scopeUrl('./'));
          return new Response('Contenido no disponible sin conexión', {
            status: 503,
            statusText: 'Service Unavailable',
          });
        })
      )
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
