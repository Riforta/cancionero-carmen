// Piezas compartidas por index.html y cancion.html (AGENTS.md D18).
// Se carga después de firebase-config.js y songs.js, y antes del script de
// cada página.

// ── Contexto de navegación (D4): viaja por la URL ──
const urlParams = new URLSearchParams(window.location.search);
const MODO = {
  banco: urlParams.get('modo') === 'banco',
  admin: urlParams.get('admin') === 'true',
  cat: urlParams.get('cat'),
  misa: urlParams.get('misa')    // misa preparada elegida (sin parámetro: Misa de Hoy)
};

// Link a otra página que conserva modo, admin, categoría y misa elegida.
// `extra` agrega parámetros (van primero) o pisa alguno de esos (p. ej. cat
// del índice; null lo saca).
function linkCon(pagina, extra = {}) {
  const CONTEXTO = ['modo', 'admin', 'cat', 'misa'];
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

// ── Íconos (assets/iconos.svg, AGENTS.md D21) ──
// ico('caliz') devuelve el <svg> para meter en un innerHTML; toma el color
// del texto. `solo` = ícono sin texto al lado (sin espacio a la derecha)
function ico(nombre, solo) {
  return `<svg class="ico${solo ? ' ico-solo' : ''}" aria-hidden="true"><use href="assets/iconos.svg#${nombre}"/></svg>`;
}
// Ícono + texto en un elemento, con el texto escapado
function ponerConIcono(el, nombre, texto) {
  el.innerHTML = ico(nombre) + escaparHtml(texto);
}

// Botón "Modo admin" / "Salir de admin" del encabezado (no existe en
// banco). Recarga la misma página con o sin admin=true. `avisoAlSalir()`
// devuelve un texto para confirmar si hay algo sin guardar, o null.
function botonModo(avisoAlSalir) {
  if (MODO.banco) return;
  const btn = document.getElementById('modeToggle');
  // .mt-largo se oculta en pantallas angostas (comun.css): queda "Salir" / "admin"
  btn.innerHTML = MODO.admin
    ? ico('nota') + 'Salir<span class="mt-largo"> de admin</span>'
    : ico('llave') + '<span class="mt-largo">Modo </span>admin';
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

// iPhone: sin un listener de toque, Safari no aplica :active a los botones
document.addEventListener('touchstart', () => {}, { passive: true });

// ── Texto ──
// Minúsculas y sin tildes. Conserva la longitud (solo saca las marcas), así
// que las posiciones sirven sobre el texto original
function normalize(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function escaparHtml(t) {
  return t.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
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

// ── Canciones cargadas desde la web (AGENTS.md D24) ──
// canciones_indice/<id> = { titulo, categoria, num } en Firebase; la letra va
// en canciones/<id> (D23). Se suman a SONGS con `web: true`, así la lista, la
// búsqueda, la misa y anterior / siguiente las tratan como a las del repo.
// La última lista conocida queda en localStorage.canciones_indice y se suma
// al cargar este archivo, antes de que la página use SONGS.

// Prefijo del id según la categoría (§3)
const PREFIJOS = {
  entrada: 'ent', gloria: 'glo', aleluya: 'ale', ofertorio: 'ofert', santo: 'snt',
  comunion: 'com', adoracion: 'ador', carmelitanos: 'ador', marianos: 'mar', varias: 'var',
  sanjose: 'sjose', adviento: 'adv', navidad: 'nav', cuaresma: 'cuar', pascua: 'pasc'
};

// "Oración del alma enamorada" → "oracion-del-alma-enamorada"
function slugDe(titulo) {
  return String(titulo || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
}

const RE_ID = /^[a-z]+_[a-z0-9-]+$/;

// Las canciones de songs.js tal como vienen (antes de sumar o sacar nada)
const SONGS_REPO = typeof SONGS !== 'undefined' ? SONGS.slice() : [];

// Lo que llega de Firebase → canciones válidas (las del repo ganan si el id se repite)
function cancionesWebDe(val) {
  if (!val || typeof val !== 'object') return [];
  return Object.entries(val)
    .filter(([id, c]) => RE_ID.test(id) && c && typeof c.titulo === 'string' && c.titulo.trim() &&
      PREFIJOS[c.categoria] && !SONGS_REPO.some(s => s.id === id))
    .map(([id, c]) => ({ id, num: Number.isInteger(c.num) ? c.num : 0, title: c.titulo.trim(), category: c.categoria, web: true }));
}

// Canciones eliminadas desde la web (D26): eliminadas/<id> = { titulo, por,
// cuando }. No se ven en ningún lado hasta que se recuperan
let cancionesEliminadas = {};
function eliminadasDe(val) {
  if (!val || typeof val !== 'object') return {};
  return Object.fromEntries(Object.entries(val).filter(([id, e]) => RE_ID.test(id) && e && typeof e === 'object'));
}

// SONGS = las del repo + las de la web, sin las eliminadas. Se toca solo si
// cambió el resultado. Devuelve true si cambió
let indiceWeb = null, firmaCanciones = null;
function armarCanciones() {
  const lista = [...SONGS_REPO, ...cancionesWebDe(indiceWeb)].filter(s => !cancionesEliminadas[s.id]);
  const firma = JSON.stringify(lista.map(s => [s.id, s.title, s.category, s.num]));
  if (firma === firmaCanciones) return false;
  firmaCanciones = firma;
  SONGS.splice(0, SONGS.length, ...lista);
  return true;
}
function mezclarCancionesWeb(val) { indiceWeb = val; return armarCanciones(); }
function mezclarEliminadas(val) { cancionesEliminadas = eliminadasDe(val); return armarCanciones(); }
if (typeof SONGS !== 'undefined') {
  indiceWeb = leerCopia('canciones_indice');
  cancionesEliminadas = eliminadasDe(leerCopia('eliminadas'));
  armarCanciones();
}

// Sigue la lista de la web y las eliminadas (en banco, una lectura por REST
// de cada una, D14). Cada vez que cambia SONGS dispara 'canciones-web'
function seguirCancionesWeb() {
  const avisar = cambio => { if (cambio) document.dispatchEvent(new Event('canciones-web')); };
  seguirDato('eliminadas', 'eliminadas', val => avisar(mezclarEliminadas(val)));
  return seguirDato('canciones_indice', 'canciones_indice', val => avisar(mezclarCancionesWeb(val)));
}

// ── Misa de Hoy: orden y borrador (index.html y cancion.html) ──
const mismaLista = (a, b) => a.length === b.length && a.every((id, i) => id === b[i]);

// Posición del momento litúrgico de una canción según el orden de CATS
function momentoDe(songId) {
  const s = SONGS.find(x => x.id === songId);
  const i = s ? CATS.findIndex(([id]) => id === s.category) : -1;
  return i < 0 ? CATS.length : i;
}

// Lista nueva con la canción en su momento (entrada → gloria → … → marianos),
// después de las que ya estén en ese momento
function insertarEnMisa(ids, songId) {
  if (ids.includes(songId)) return ids;
  const nueva = ids.slice();
  const pos = nueva.findIndex(id => momentoDe(id) > momentoDe(songId));
  if (pos < 0) nueva.push(songId);
  else nueva.splice(pos, 0, songId);
  return nueva;
}

// Borrador de la misa (localStorage.misa_borrador): lo que el admin armó y
// todavía no publicó. `base` es la misa publicada sobre la que empezó; sirve
// para saber si después alguien publicó otra. Se guarda en el celular para
// que no se pierda al entrar a ver una canción
function leerBorradorMisa() {
  const b = leerCopia('misa_borrador');
  if (!b || !Array.isArray(b.ids) || !Array.isArray(b.base)) return null;
  return { ids: normalizarMisa(b.ids), base: normalizarMisa(b.base) };
}
// Devuelve true si quedó un borrador. Si la lista volvió a ser igual a la
// publicada, no hay nada que publicar y el borrador se borra
function guardarBorradorMisa(ids, base) {
  const hayCambios = !mismaLista(ids, base);
  guardarCopia('misa_borrador', hayCambios ? { ids, base } : null);
  return hayCambios;
}
function borrarBorradorMisa() {
  guardarCopia('misa_borrador', null);
}

// ── Misas preparadas (AGENTS.md D27) ──
// misas/<clave> = { nombre, canciones, por, cuando }: misas armadas que los
// fieles todavía no ven. La que ven es siempre la Misa de Hoy (misa_actual,
// con su nombre en misa_meta.nombre). Se ordenan por clave (la de push() sigue
// el orden en que se crearon)
const RE_CLAVE_MISA = /^-[A-Za-z0-9_-]{2,30}$/;
function misasDe(val) {
  if (!val || typeof val !== 'object') return [];
  return Object.keys(val).sort()
    .filter(k => RE_CLAVE_MISA.test(k) && val[k] && typeof val[k].nombre === 'string')
    .map(k => ({ id: k, nombre: val[k].nombre, canciones: normalizarMisa(val[k].canciones), por: val[k].por, cuando: val[k].cuando }));
}

// ── Aviso flotante: confirma una acción sin frenar (a diferencia de alert) ──
// `link` opcional: { texto, href }
let avisoFlotanteReloj = null;
function avisar(texto, link) {
  let caja = document.getElementById('aviso-flotante');
  if (!caja) {
    caja = document.createElement('div');
    caja.id = 'aviso-flotante';
    caja.className = 'aviso-flotante';
    caja.setAttribute('role', 'status');
    document.body.appendChild(caja);
  }
  caja.textContent = texto;
  if (link) {
    const a = document.createElement('a');
    a.href = link.href;
    a.textContent = link.texto;
    caja.append(' ', a);
  }
  caja.classList.remove('visible');
  void caja.offsetWidth;            // reinicia la animación si ya estaba a la vista
  caja.classList.add('visible');
  clearTimeout(avisoFlotanteReloj);
  avisoFlotanteReloj = setTimeout(() => caja.classList.remove('visible'), link ? 4500 : 2500);
}

// ── Fechas y avisos del coro (index.html y avisos.html) ──
// window.FECHA_PRUEBA ('AAAA-MM-DD') solo lo usan las pruebas, para fijar el día
function fechaHoy() {
  return window.FECHA_PRUEBA ? new Date(window.FECHA_PRUEBA + 'T12:00') : new Date();
}
function isoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre'];
const TIPOS_AVISO = {
  ensayo: { icono: 'notas', nombre: 'Ensayo' },
  celebracion: { icono: 'iglesia', nombre: 'Celebración' },
  aviso: { icono: 'megafono', nombre: 'Aviso' },
  liturgia: { icono: 'cruz', nombre: 'Fiesta litúrgica' }
};

// "jue 8/10" a partir de 'AAAA-MM-DD'
function fechaCorta(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return `${DIAS_CORTOS[new Date(a, m - 1, d).getDay()]} ${d}/${m}`;
}

// Avisos cargados (avisos/<id> de Firebase) desde hoy, más las fiestas
// litúrgicas de los próximos `diasFiestas` días (liturgia.js), ordenados por
// fecha y hora. Lo que ya pasó no aparece
function proximosEventos(avisos, diasFiestas) {
  const hoy = fechaHoy();
  const desde = isoLocal(hoy);
  const propios = Object.entries(avisos || {})
    .filter(([, a]) => a && typeof a.fecha === 'string' && a.fecha >= desde)
    .map(([id, a]) => ({ id, fecha: a.fecha, hora: a.hora || '', titulo: a.titulo || '', tipo: TIPOS_AVISO[a.tipo] ? a.tipo : 'aviso', lugar: a.lugar || '', detalle: a.detalle || '' }));
  const fiestas = typeof proximasFiestas === 'function'
    ? proximasFiestas(hoy, diasFiestas).map(f => ({ id: null, fecha: f.fecha, hora: '', titulo: f.nombre, tipo: 'liturgia', lugar: '', detalle: '' }))
    : [];
  return [...propios, ...fiestas].sort((x, y) => (x.fecha + x.hora).localeCompare(y.fecha + y.hora));
}
