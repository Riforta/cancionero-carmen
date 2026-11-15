// Tema claro / oscuro (AGENTS.md D17), compartido por index.html,
// cancion.html y avisos.html. Va en el <head>, antes de pintar, para que al
// abrir en modo oscuro no haya un destello claro. También marca el modo admin
// (más abajo), por la misma razón: decidir antes de pintar.
//
// Arranca con el tema del celular (prefers-color-scheme). Si la persona toca
// el botón 🌙/☀️, su elección queda guardada en este celular (localStorage).
(function () {
  const raiz = document.documentElement;
  const sistema = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function elegido() {
    try { return localStorage.getItem('tema'); } catch (e) { return null; }
  }
  const temaActual = () => raiz.getAttribute('data-theme');

  function pintarBotones() {
    const oscuro = temaActual() === 'dark';
    document.querySelectorAll('.theme-toggle').forEach(b => {
      b.textContent = oscuro ? '☀️' : '🌙';
      b.setAttribute('aria-label', oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
      b.title = oscuro ? 'Modo claro' : 'Modo oscuro';
    });
  }

  function aplicar(tema) {
    raiz.setAttribute('data-theme', tema);
    pintarBotones();
  }

  aplicar(elegido() || (sistema && sistema.matches ? 'dark' : 'light'));

  // Si no eligió a mano, sigue los cambios del celular (p. ej. modo noche automático)
  if (sistema && sistema.addEventListener) {
    sistema.addEventListener('change', e => { if (!elegido()) aplicar(e.matches ? 'dark' : 'light'); });
  }

  // Modo admin (sesion.js): se marca <html> antes de pintar para reservar el
  // lugar de la barra de sesión y, si la última sesión de este celular fue de
  // un admin (data-admin="ok"), también el de los botones de edición. Así la
  // página no se corre hacia abajo cuando terminan de aparecer (AGENTS.md D16)
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('admin') === 'true' && q.get('modo') !== 'banco') {
      raiz.setAttribute('data-admin', localStorage.getItem('sesion_admin') ? 'ok' : 'si');
    }
  } catch (e) {}

  document.addEventListener('DOMContentLoaded', () => {
    pintarBotones();
    document.querySelectorAll('.theme-toggle').forEach(b => b.addEventListener('click', () => {
      const nuevo = temaActual() === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('tema', nuevo); } catch (e) {}
      aplicar(nuevo);
    }));
  });
})();
