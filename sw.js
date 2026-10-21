/* Service Worker · Sistema Docente Primaria
 * Estrategia: cache-first para assets locales, network-first para CDNs (fuentes, jsPDF, XLSX, QR).
 * Permite que el sistema funcione sin conexión una vez visitado al menos una vez.
 */
const CACHE_VERSION = "nsf-docente-v1.2";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./principal.html",
  "./estudiantes.html",
  "./horario.html",
  "./asistencia.html",
  "./calificaciones.html",
  "./incidencias.html",
  "./configuracion.html",
  "./css/styles.css",
  "./js/script.js",
  "./manifest.json",
  "./imagenes/fatima.svg",
  "./imagenes/favicon.svg",
  "./imagenes/logo-aip.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      cache.addAll(STATIC_ASSETS).catch(() => {
        /* Si algún asset falla individualmente, seguimos con los que sí cargaron. */
      })
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isLocal = url.origin === self.location.origin;
  const isCdn =
    url.host === "cdnjs.cloudflare.com" ||
    url.host === "cdn.jsdelivr.net" ||
    url.host === "fonts.googleapis.com" ||
    url.host === "fonts.gstatic.com";

  if (isLocal) {
    event.respondWith(cacheFirst(request));
  } else if (isCdn) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

const cacheFirst = async (request) => {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const copy = response.clone();
      caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
    }
    return response;
  } catch (error) {
    return caches.match("./index.html");
  }
};

const staleWhileRevalidate = async (request) => {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  const networkFetch = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })
    .catch(() => null);
  return cached || networkFetch || new Response("Recurso no disponible offline.", { status: 504 });
};
