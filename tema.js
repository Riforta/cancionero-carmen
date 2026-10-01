// Tema claro / oscuro (AGENTS.md D17), compartido por index.html y
// cancion.html. Va en el <head>, antes de pintar, para que al abrir en modo
// oscuro no haya un destello claro.
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

  document.addEventListener('DOMContentLoaded', () => {
    pintarBotones();
    document.querySelectorAll('.theme-toggle').forEach(b => b.addEventListener('click', () => {
      const nuevo = temaActual() === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('tema', nuevo); } catch (e) {}
      aplicar(nuevo);
    }));
  });
})();
