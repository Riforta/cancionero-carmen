// Funcionamiento sin internet (AGENTS.md D15), compartido por index.html y
// cancion.html: registra el service worker (sw.js), muestra el aviso "Sin
// conexión" y el de "Listo para usar sin internet". Las copias locales de los
// datos (leerCopia/guardarCopia) están en comun.js.

// Texto con ícono (comun.js). Sin comun.js, solo el texto: el aviso de versión
// nueva tiene que funcionar aunque la página en caché sea de otra versión
function textoConIcono(el, nombre, texto) {
  if (typeof ponerConIcono === 'function') ponerConIcono(el, nombre, texto);
  else el.textContent = texto;
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });

  // "Listo para usar sin internet" (pie del índice, #estado-offline):
  // aparece cuando la caché del service worker ya tiene todas las letras
  navigator.serviceWorker.ready.then(async () => {
    const estado = document.getElementById('estado-offline');
    if (!estado || typeof SONGS === 'undefined' || !window.caches) return;
    let guardadas = 0;
    for (const clave of (await caches.keys()).filter(k => k.startsWith('cancionero-'))) {
      const urls = (await (await caches.open(clave)).keys()).map(r => r.url);
      guardadas = Math.max(guardadas, urls.filter(u => u.includes('/letras/')).length);
    }
    if (guardadas >= SONGS.length) {
      textoConIcono(estado, 'descarga', 'Listo para usar sin internet');
      estado.hidden = false;
    }
  }).catch(() => {});
}

// ── Versión nueva del sitio ──
// El service worker muestra la copia guardada al instante y la actualiza en
// segundo plano. Si encontró un archivo cambiado, avisa ('version-nueva'):
// - recién abierta y sin tocar nada: la página se recarga sola (una vez);
// - si no: aviso en el encabezado con el botón "Actualizar".
if ('serviceWorker' in navigator) {
  let tocada = false;
  ['pointerdown', 'keydown'].forEach(ev =>
    window.addEventListener(ev, () => { tocada = true; }, { capture: true, passive: true }));

  function versionNueva() {
    let recargadaHace = Infinity;
    try { recargadaHace = Date.now() - (Number(sessionStorage.getItem('recarga_version')) || 0); } catch (e) {}
    if (!tocada && performance.now() < 4000 && recargadaHace > 30000) {
      try { sessionStorage.setItem('recarga_version', String(Date.now())); } catch (e) {}
      location.reload();
      return;
    }
    const header = document.querySelector('header');
    if (!header || header.querySelector('.aviso-version')) return;
    const aviso = document.createElement('div');
    aviso.className = 'aviso-version';
    aviso.setAttribute('role', 'status');
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.textContent = 'Actualizar';
    boton.addEventListener('click', () => location.reload());
    textoConIcono(aviso, 'actualizar', 'Hay una versión nueva');
    aviso.append(boton);
    header.appendChild(aviso);
    window.dispatchEvent(new Event('resize'));   // el buscador del índice se reacomoda
  }

  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data && e.data.tipo === 'version-nueva') versionNueva();
  });
}

// Aviso dentro del encabezado (que es sticky), así se ve siempre
(function () {
  const aviso = document.createElement('div');
  aviso.className = 'aviso-offline';
  aviso.setAttribute('role', 'status');
  textoConIcono(aviso, 'sin-red', 'Sin conexión: mostrando lo último guardado');
  const header = document.querySelector('header');
  if (header) header.appendChild(aviso);

  const actualizar = () => {
    aviso.hidden = navigator.onLine;
    // index.html recalcula la posición del buscador con el alto del encabezado
    window.dispatchEvent(new Event('resize'));
  };
  window.addEventListener('online', actualizar);
  window.addEventListener('offline', actualizar);
  aviso.hidden = navigator.onLine;
})();
