// Piezas compartidas por index.html y cancion.html (AGENTS.md D18).
// Se carga después de firebase-config.js y songs.js, y antes del script de
// cada página.

// ── Contexto de navegación (D4): viaja por la URL ──
const urlParams = new URLSearchParams(window.location.search);
const MODO = {
  banco: urlParams.get('modo') === 'banco',
  admin: urlParams.get('admin') === 'true',
  cat: urlParams.get('cat')
};

// Link a otra página que conserva modo, admin y categoría. `extra` agrega
// parámetros (van primero) o pisa alguno de esos tres (p. ej. cat del índice).
function linkCon(pagina, extra = {}) {
  const CONTEXTO = ['modo', 'admin', 'cat'];
  const q = new URLSearchParams();
  Object.entries(extra).forEach(([k, v]) => {
    if (!CONTEXTO.includes(k) && v !== null && v !== undefined) q.set(k, v);
  });
  CONTEXTO.forEach(k => {
    const v = k in extra ? extra[k] : urlParams.get(k);
    if (v) q.set(k, v);
  });
  const qs = q.toString();
  return qs ? `${pagina}?${qs}` : pagina;
}

// Botón "🔧 Modo admin" / "🎵 Salir de admin" del encabezado (no existe en
// banco). Recarga la misma página con o sin admin=true. `avisoAlSalir()`
// devuelve un texto para confirmar si hay algo sin guardar, o null.
function botonModo(avisoAlSalir) {
  if (MODO.banco) return;
  const btn = document.getElementById('modeToggle');
  btn.textContent = MODO.admin ? '🎵 Salir de admin' : '🔧 Modo admin';
  btn.classList.toggle('is-admin', MODO.admin);
  btn.setAttribute('aria-label', MODO.admin ? 'Cambiar a vista de músicos' : 'Cambiar a modo admin');
  btn.hidden = false;
  btn.addEventListener('click', () => {
    const aviso = avisoAlSalir();
    if (aviso && !confirm(aviso)) return;
    const url = new URL(window.location);
    if (MODO.admin) url.searchParams.delete('admin');
    else url.searchParams.set('admin', 'true');
    window.location.href = url;
  });
}

// ── Texto ──
// Minúsculas y sin tildes. Conserva la longitud (solo saca las marcas), así
// que las posiciones sirven sobre el texto original
function normalize(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function escaparHtml(t) {
  return t.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

// Líneas de letra de un fragmento de letras/*.html: sin acordes, sin líneas
// de solo acordes y sin renglones vacíos o de puro signo. La usan la
// búsqueda del índice y el lector de voz de cancion.html
function lineasDeLetra(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  div.querySelectorAll('c, .chord-line, .error-msg').forEach(el => el.remove());
  return div.textContent.split('\n')
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(l => l && !/^[\s\-–—|/.():,;×xX]*$/.test(l));
}

// ── Copias locales en localStorage (D15) ──
// Fallan en silencio (modo privado, sin espacio): la página funciona igual
function leerCopia(clave) {
  try { return JSON.parse(localStorage.getItem(clave)); } catch (e) { return null; }
}
function guardarCopia(clave, valor) {
  try {
    if (valor === null || valor === undefined) localStorage.removeItem(clave);
    else localStorage.setItem(clave, JSON.stringify(valor));
  } catch (e) {}
}
