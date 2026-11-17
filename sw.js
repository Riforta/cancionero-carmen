// Service worker del cancionero: hace que el sitio funcione sin internet
// (AGENTS.md D15). Al instalarse guarda las páginas y TODAS las letras.
//
// Estrategias:
// - Páginas, JS, CSS y letras propios: la copia guardada al instante, y en
//   segundo plano se pide a la red y se actualiza la copia. Así cambiar de
//   página no depende de la señal. Si cambió un archivo que no es una letra,
//   se avisa a las páginas abiertas ('version-nueva', lo atiende offline.js).
// - Imágenes, Google Fonts y SDK de Firebase: la copia guardada si existe.
//   Excepción: assets/iconos.svg se trata como código (cambia con él).
// - La base de Firebase (firebaseio.com) no se toca: cada página guarda su
//   propia copia de los datos en localStorage.
//
// Subir VERSION al cambiar este archivo, para descartar la caché anterior.
const VERSION = 'v14';
const CACHE = 'cancionero-' + VERSION;

// songs.js: la lista de letras a guardar. firebase-config.js: FIREBASE_SDK
// (la versión del SDK en un solo lugar; sus funciones solo se definen, acá no
// se llaman)
importScripts('songs.js', 'firebase-config.js');

const PROPIOS = [
  './', 'index.html', 'cancion.html', 'avisos.html', 'avisos.js', 'songs.js', 'firebase-config.js',
  'comun.js', 'acordes.js', 'letra.js', 'cancion.js', 'editor.js', 'liturgia.js', 'offline.js', 'sesion.js', 'tema.js', 'comun.css',
  'manifest.webmanifest',
  'assets/logo-medallon.png', 'assets/logo-medallon-color.png', 'assets/iconos.svg',
  'assets/icon-192.png', 'assets/icon-512.png', 'assets/apple-touch-icon.png',
  'assets/pantalla-encendida.mp4', 'assets/pantalla-encendida.webm'
];
const LETRAS = SONGS.map(s => `letras/${s.id}.txt`);
const FUENTES_CSS = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=EB+Garamond:ital,wght@0,400;0,500;1,400&display=swap';
const EXTERNOS = [
  FUENTES_CSS,
  FIREBASE_SDK + 'firebase-app-compat.js',
  FIREBASE_SDK + 'firebase-database-compat.js'
];

self.addEventListener('install', event => {
  // De a uno: si un archivo falla (p. ej. una letra que todavía no existe),
  // el resto se guarda igual
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.all([...PROPIOS, ...LETRAS, ...EXTERNOS]
        .map(url => cache.add(url).catch(() => {})))
        .then(() => guardarFuentes(cache)))
      .then(() => self.skipWaiting())
  );
});

// Los archivos de las fuentes (.woff2) que nombra el CSS de Google Fonts.
// Solo el bloque "latin": alcanza para el castellano
async function guardarFuentes(cache) {
  try {
    const css = await cache.match(FUENTES_CSS);
    if (!css) return;
    const urls = [...(await css.text()).matchAll(/\/\* latin \*\/[^}]*?url\((https:\/\/[^)]+)\)/g)].map(m => m[1]);
    await Promise.all(urls.map(url => cache.add(url).catch(() => {})));
  } catch (e) {}
}

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(claves => Promise.all(claves
        .filter(k => k.startsWith('cancionero-') && k !== CACHE)
        .map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Clave de caché sin query string: cancion.html?id=… y cancion.html?id=…
// comparten la misma copia de la página
function claveSinQuery(request) {
  const url = new URL(request.url);
  return url.origin + url.pathname;
}

// ETag o fecha de modificación: para saber si un archivo cambió
const firma = resp => resp.headers.get('etag') || resp.headers.get('last-modified');

// Avisa a las páginas abiertas que hay archivos nuevos. Espera 1,5 s: la
// página que se está abriendo todavía no figura entre los clientes cuando la
// red contesta rápido, y además suelen cambiar varios archivos juntos (un
// solo aviso para todos)
let avisoPendiente = null;
function avisarVersionNueva() {
  if (!avisoPendiente) {
    avisoPendiente = new Promise(ok => setTimeout(ok, 1500))
      .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .then(paginas => paginas.forEach(p => p.postMessage({ tipo: 'version-nueva' })))
      .catch(() => {})
      .then(() => { avisoPendiente = null; });
  }
  return avisoPendiente;
}

// La copia guardada al instante (si no hay, la red). En segundo plano pide a
// la red y actualiza la copia; sin conexión ese pedido falla y no pasa nada.
// Con `avisarCambio`, si la copia nueva es distinta avisa a las páginas
function copiaYActualiza(event, avisarCambio) {
  const clave = claveSinQuery(event.request);
  // Páginas y código: se revalida siempre con el servidor (no-cache), así una
  // versión nueva se detecta en la primera visita. Se pide por URL porque un
  // pedido de navegación no admite opciones
  const red = avisarCambio ? fetch(event.request.url, { cache: 'no-cache' }) : fetch(event.request);
  const guardado = red.then(resp => {
    if (!resp.ok) return;
    const copia = resp.clone();   // clonar ya: después el cuerpo se lee
    return caches.open(CACHE).then(async cache => {
      const vieja = avisarCambio ? await cache.match(clave) : null;
      await cache.put(clave, copia);
      if (vieja && firma(vieja) && firma(resp) && firma(vieja) !== firma(resp)) await avisarVersionNueva();
    });
  }).catch(() => {});
  event.waitUntil(guardado);
  return caches.match(clave).then(c => c || red);
}

function primeroCopia(request) {
  // ignoreVary: Google Fonts varía la respuesta según el tipo de pedido
  return caches.match(request, { ignoreVary: true }).then(c => c || fetch(request).then(resp => {
    if (resp.ok || resp.type === 'opaque') {
      const copia = resp.clone();
      caches.open(CACHE).then(cache => cache.put(request, copia));
    }
    return resp;
  }));
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    // Las pruebas (capturas, etc.) no pasan por la caché
    if (url.pathname.includes('/tests/')) return;
    // iconos.svg cambia con el código (íconos nuevos): se actualiza como él
    if (url.pathname.includes('/assets/') && !url.pathname.endsWith('/iconos.svg')) event.respondWith(primeroCopia(request));
    else event.respondWith(copiaYActualiza(event, !url.pathname.includes('/letras/')));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com' ||
      (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/'))) {
    event.respondWith(primeroCopia(request));
  }
  // Todo lo demás (firebaseio.com, etc.) va directo a la red
});
