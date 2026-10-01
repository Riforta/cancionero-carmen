// Service worker del cancionero: hace que el sitio funcione sin internet
// (AGENTS.md D15). Al instalarse guarda las páginas y TODAS las letras.
//
// Estrategias:
// - Páginas, JS y manifest propios: primero la red (si tarda más de 3 s o no
//   hay conexión, la copia guardada). Así nadie queda con una versión vieja.
// - Letras: la copia guardada al instante y se actualiza en segundo plano.
// - Imágenes, Google Fonts y SDK de Firebase: la copia guardada si existe.
// - La base de Firebase (firebaseio.com) no se toca: cada página guarda su
//   propia copia de los datos en localStorage.
//
// Subir VERSION al cambiar este archivo, para descartar la caché anterior.
const VERSION = 'v4';
const CACHE = 'cancionero-' + VERSION;

importScripts('songs.js');

const PROPIOS = [
  './', 'index.html', 'cancion.html', 'songs.js', 'firebase-config.js',
  'offline.js', 'sesion.js', 'tema.js', 'tema.css',
  'manifest.webmanifest',
  'assets/logo-medallon.png', 'assets/logo-medallon-color.png',
  'assets/icon-192.png', 'assets/icon-512.png', 'assets/apple-touch-icon.png',
  'assets/pantalla-encendida.mp4', 'assets/pantalla-encendida.webm'
];
const LETRAS = SONGS.map(s => `letras/${s.id}.html`);
const EXTERNOS = [
  'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=EB+Garamond:ital,wght@0,400;0,500;1,400&display=swap',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js'
];

self.addEventListener('install', event => {
  // De a uno: si un archivo falla (p. ej. una letra que todavía no existe),
  // el resto se guarda igual
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.all([...PROPIOS, ...LETRAS, ...EXTERNOS]
        .map(url => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

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

function primeroRed(request) {
  const clave = claveSinQuery(request);
  const red = fetch(request).then(resp => {
    if (resp.ok) {
      const copia = resp.clone();   // clonar antes de devolver: después el cuerpo ya se leyó
      caches.open(CACHE).then(c => c.put(clave, copia));
    }
    return resp;
  });
  red.catch(() => {});
  const copia = caches.match(clave);
  const plazo = new Promise(ok => setTimeout(ok, 3000));
  // Gana la red; si falla o tarda más de 3 s, la copia (si hay)
  return Promise.race([red, plazo.then(() => copia.then(c => c || red))])
    .catch(() => copia.then(c => c || Response.error()));
}

function copiaYActualiza(request) {
  const clave = claveSinQuery(request);
  const red = fetch(request).then(resp => {
    if (resp.ok) {
      const copia = resp.clone();   // clonar antes de devolver: después el cuerpo ya se leyó
      caches.open(CACHE).then(c => c.put(clave, copia));
    }
    return resp;
  });
  red.catch(() => {});
  return caches.match(clave).then(c => c || red).catch(() => red);
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
    if (url.pathname.includes('/letras/')) event.respondWith(copiaYActualiza(request));
    else if (url.pathname.includes('/assets/')) event.respondWith(primeroCopia(request));
    else event.respondWith(primeroRed(request));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com' ||
      (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/'))) {
    event.respondWith(primeroCopia(request));
  }
  // Todo lo demás (firebaseio.com, etc.) va directo a la red
});
