// Funcionamiento sin internet (AGENTS.md D15), compartido por index.html y
// cancion.html: registra el service worker (sw.js), muestra un aviso cuando no
// hay conexión y guarda copias locales de los datos de Firebase.

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// Copias locales en localStorage. Fallan en silencio (modo privado, sin
// espacio): la página funciona igual, solo sin copia
function leerCopia(clave) {
  try { return JSON.parse(localStorage.getItem(clave)); } catch (e) { return null; }
}
function guardarCopia(clave, valor) {
  try {
    if (valor === null || valor === undefined) localStorage.removeItem(clave);
    else localStorage.setItem(clave, JSON.stringify(valor));
  } catch (e) {}
}

// Aviso dentro del encabezado (que es sticky), así se ve siempre
(function () {
  const estilo = document.createElement('style');
  estilo.textContent = `
    .aviso-offline {
      background: #DDB45E; color: #2C1A0D; text-align: center;
      font-family: 'EB Garamond', Georgia, serif; font-size: 0.9rem;
      padding: 0.3rem 0.8rem;
    }
    .aviso-offline[hidden] { display: none; }`;
  document.head.appendChild(estilo);

  const aviso = document.createElement('div');
  aviso.className = 'aviso-offline';
  aviso.setAttribute('role', 'status');
  aviso.textContent = '📴 Sin conexión: mostrando lo último guardado';
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
