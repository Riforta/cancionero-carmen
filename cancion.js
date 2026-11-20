// Página de una canción (cancion.html?id=<id>). Usa comun.js, acordes.js,
// letra.js, firebase-config.js, offline.js, sesion.js y songs.js. Las
// secciones "LÓGICA N" están descriptas en AGENTS.md §4b–§4c y D23. El
// editor de acordes (solo admin) está aparte, en editor.js.

// MODO, urlParams, linkCon, botonModo, ico y ponerConIcono vienen de comun.js;
// seguirDato, suscribirMisa y escribirDato, de firebase-config.js
const esBanco = MODO.banco;
const isAdmin = MODO.admin;
if (esBanco) document.body.classList.add('banco-mode');

// "Volver" conserva modo, admin y categoría activa del índice
document.querySelector('.back-link').href = linkCon('index.html');

// Admin: barra de sesión con Google. Editar requiere un admin autorizado
// (esAdminOk y el evento 'sesion-admin' vienen de sesion.js)
if (isAdmin && !esBanco) panelSesion(document.querySelector('main'));

// Botón "Modo admin" (comun.js): pide confirmación si hay una nota a medio
// escribir (los acordes sin guardar los cuida editor.js)
botonModo(() => document.getElementById('notaForm').hidden ? null : 'Hay una nota sin guardar. ¿Salir igual?');

const idCancion = urlParams.get('id');

if (!idCancion) {
  window.location.replace('index.html');
  throw new Error('Sin ?id=: se vuelve al índice');   // corta el resto del script
}

// Título: de SONGS (songs.js); si la canción no está, el de ?t= o uno armado
// desde el id
// Las canciones cargadas desde la web (D24) están en SONGS con `web: true`
// (comun.js, con la última lista guardada en el celular)
let cancionActual = SONGS.find(s => s.id === idCancion) || null;
const tituloDeRespaldo = urlParams.get('t') ||
  (idCancion || '').replace(/^[a-z]+_/, '').split('-')
    .map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
let tituloCancion = (cancionActual && cancionActual.title) || tituloDeRespaldo;
const esCancionWeb = () => !!(cancionActual && cancionActual.web);

// Si la lista de canciones de la web cambia (o llega por primera vez), el título
if (!MODO.banco) {
  seguirCancionesWeb();
  document.addEventListener('canciones-web', () => {
    cancionActual = SONGS.find(s => s.id === idCancion) || cancionActual;
    tituloCancion = (cancionActual && cancionActual.title) || tituloDeRespaldo;
    if (textoDibujado !== null) {
      document.getElementById('song-title').textContent = tituloCancion;
      document.title = `${tituloCancion} — Coro Virgen del Carmen`;
    }
  });
}

// Solo ids con forma de nombre de archivo (prefijo_slug): nada de rutas ni HTML
const idValido = /^[a-z]+_[a-z0-9-]+$/.test(idCancion || '');

// ─── LÓGICA 0: LA LETRA Y SU CORRECCIÓN (AGENTS.md D23) ───
// La letra sale de letras/<id>.txt. Si un admin la corrigió desde la web
// (editor.js), la corrección guardada en Firebase la pisa: canciones/<id> =
// { letra, por, cuando, anterior }. Se dibuja lo primero que haya (la copia
// local de la corrección o el archivo) y se redibuja si llega otra versión.
// Músicos y admin la siguen en vivo; banco lee una vez por REST solo el texto
// (canciones/<id>/letra, D14)
let textoRepo = null;        // letras/<id>.txt (null mientras no llega)
let faltaRepo = false;       // no se pudo bajar el archivo
let correccion = null;       // { letra, por, cuando, anterior } o null
let textoDibujado = null;    // el texto que está en pantalla
let editandoLetra = false;   // el editor de acordes maneja la letra (editor.js)
let cancionRef = null;       // ref del SDK para guardar la corrección (admin)

const textoVigente = () => correccion ? correccion.letra : textoRepo;

// Lo que llega de Firebase (en banco, solo el texto)
function validarCorreccion(val) {
  if (typeof val === 'string') val = { letra: val };
  if (!val || typeof val.letra !== 'string' || !val.letra.trim()) return null;
  return {
    letra: val.letra,
    por: typeof val.por === 'string' ? val.por : '',
    cuando: typeof val.cuando === 'number' ? val.cuando : 0,
    anterior: typeof val.anterior === 'string' && val.anterior.trim() ? val.anterior : null
  };
}

// letra.js arma el HTML: cada acorde sobre su sílaba, con data-original y
// aria-hidden (los lectores de pantalla leen solo la letra), y el texto
// escapado. También lo usa el editor
function dibujarLetra(texto) {
  letraBox.innerHTML = htmlDeLetra(parsearLetra(texto));
  renderChords();   // con el tono que corresponda (si el del coro llegó antes, ya)
}

// Dibuja la versión vigente si cambió (`forzar`: aunque sea la misma). Mientras
// se edita no toca la letra: al salir del editor se dibuja la vigente
function actualizarLetra(forzar) {
  pintarCorreccion();
  if (editandoLetra) return;
  const texto = textoVigente();
  if (texto === null) {
    if (faltaRepo && textoDibujado === null) mostrarErrorLetra();
    return;
  }
  if (texto === textoDibujado && !forzar) return;
  const primeraVez = textoDibujado === null;
  textoDibujado = texto;
  dibujarLetra(texto);
  if (primeraVez) {
    document.getElementById('song-title').textContent = tituloCancion;
    document.title = `${tituloCancion} — Coro Virgen del Carmen`;
    // Cuando terminan de cargar las fuentes cambian los anchos: se mide de nuevo
    if (document.fonts) document.fonts.ready.then(acomodarAcordes);
  }
  document.dispatchEvent(new Event('letra-cargada'));
}

function mostrarErrorLetra() {
  // El id viene de la URL: va con textContent, nunca como HTML (evita XSS)
  const msg = document.createElement('div');
  msg.className = 'error-msg';
  if (esCancionWeb()) {
    msg.append('No se pudo cargar la letra.', document.createElement('br'), 'Hace falta conexión la primera vez que se abre.');
  } else {
    const archivo = document.createElement('b');
    archivo.textContent = `letras/${idCancion}.txt`;
    msg.append('No se pudo cargar la letra.', document.createElement('br'), 'Verificá el archivo: ', archivo);
  }
  document.getElementById('letra-box').replaceChildren(msg);
  document.getElementById('song-title').textContent = tituloCancion || "Error";
}

// "Corregida por Mateo · 17/11" (músicos y admin; en banco no se ve). El
// admin con sesión ve además "Deshacer el último cambio" (si se guardó la
// versión anterior) y "Volver a la versión original" (editor.js)
function pintarCorreccion() {
  const box = document.getElementById('correccion');
  box.hidden = !correccion;
  if (!correccion) return;
  // Una canción cargada desde la web no tiene versión original (archivo)
  let texto = esCancionWeb() ? 'Cargada' : 'Corregida';
  if (correccion.por) texto += ' por ' + correccion.por;
  if (correccion.cuando) {
    const d = new Date(correccion.cuando);
    texto += ` · ${d.getDate()}/${d.getMonth() + 1}` + (d.getFullYear() !== new Date().getFullYear() ? '/' + d.getFullYear() : '');
  }
  ponerConIcono(document.getElementById('correccionTexto'), 'lapiz', texto);
  const admin = isAdmin && !esBanco && esAdminOk && !editandoLetra;
  document.getElementById('correccionAcciones').hidden = !admin;
  document.getElementById('correccionDeshacer').hidden = !correccion.anterior;
  document.getElementById('correccionOriginal').hidden = esCancionWeb();
  document.getElementById('correccionAcciones').hidden = !admin || (!correccion.anterior && esCancionWeb());
}

if (idValido) {
  // Una canción cargada desde la web no tiene archivo: su letra es la de canciones/<id>
  if (!esCancionWeb()) {
    fetch(`letras/${idCancion}.txt`)
      .then(response => {
        if (!response.ok) throw new Error();
        return response.text();
      })
      .then(texto => { textoRepo = texto; actualizarLetra(); })
      .catch(() => { faltaRepo = true; actualizarLetra(); });
  }
  seguirDato(esBanco ? `canciones/${idCancion}/letra` : `canciones/${idCancion}`, 'cancion_' + idCancion, val => {
    correccion = validarCorreccion(val);
    if (esCancionWeb() && !correccion) faltaRepo = true;   // la base no la tiene
    actualizarLetra();
    document.dispatchEvent(new Event('correccion-cambio'));
  }).then(ref => {
    cancionRef = ref;
    // Sin conexión y sin copia: no hay de dónde sacar la letra
    if (!ref && !esBanco && esCancionWeb() && !correccion) { faltaRepo = true; actualizarLetra(); }
  });
} else {
  faltaRepo = true;
  mostrarErrorLetra();
}

// ─── LÓGICA 1: MOSTRAR/OCULTAR ACORDES ───
const btnToggle = document.getElementById('toggleChords');
const letraBox = document.getElementById('letra-box');

btnToggle.addEventListener('click', () => {
  const chordsHidden = letraBox.classList.toggle('no-chords');
  if (chordsHidden) {
    btnToggle.textContent = 'Acordes: Ocultos';
    btnToggle.classList.remove('active');
  } else {
    btnToggle.textContent = 'Acordes: Visibles';
    btnToggle.classList.add('active');
  }
  acomodarAcordes();
});

// Los acordes van arriba de su sílaba sin ocupar lugar en la letra (CSS), así
// la letra se lee de corrido. Esto abre espacio solo donde hace falta:
// - un acorde sin sílaba (entre palabras o al final del renglón) ocupa su
//   ancho: es el hueco de la palabra que se sostiene;
// - si dos acordes del mismo renglón quedarían encimados, se corre el
//   segundo: más espacio entre palabras o, dentro de una palabra, un guion
//   ("a- mor");
// - si el acorde de una palabra se sale por la derecha, la palabra pasa al
//   renglón de abajo.
// Depende de los anchos: se repite al transponer, al mostrar los acordes, al
// cambiar el tamaño de letra o el ancho de la pantalla y al cargar las fuentes.
// Para que sea rápido en un celular trabaja por pasadas: cada una mide toda
// la letra de una vez, calcula sin tocar la página (cada espacio agregado corre
// lo que le sigue en ese renglón de pantalla) y escribe todo junto. La
// siguiente arregla lo que cambió si algún renglón se cortó en otro lugar
const SEPARACION_ACORDES = 0.3;   // em, entre un acorde y el siguiente
function acomodarAcordes() {
  letraBox.querySelectorAll('.salto').forEach(el => el.remove());
  letraBox.querySelectorAll('.sil[style], .palabra[style]').forEach(el => el.removeAttribute('style'));
  letraBox.querySelectorAll('.tramo.estirado').forEach(el => el.classList.remove('estirado'));
  if (esBanco || letraBox.classList.contains('no-chords')) return;
  const renglones = [...letraBox.querySelectorAll('.renglon.con-acordes')];
  if (!renglones.length) return;
  const cs = getComputedStyle(letraBox);
  const fs = parseFloat(cs.fontSize);
  const sep = SEPARACION_ACORDES * fs;
  const sangria = parseFloat(getComputedStyle(renglones[0]).paddingLeft);
  const limite = letraBox.getBoundingClientRect().right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth);
  // ¿Sigue la palabra después de este tramo?
  const sigue = tramo => {
    for (let n = tramo.nextSibling; n; n = n.nextSibling) {
      if ((n.nodeType === 1 ? n.lastElementChild.textContent : n.textContent) !== '') return true;
    }
    return false;
  };
  // Espacio agregado (px): margen antes de una .palabra o relleno después de
  // una .sil. Se anota y se escribe todo junto (escribir)
  const agregado = new Map(), tocados = new Set(), guiones = [], conAncho = new Set();
  const agregar = (el, px) => { agregado.set(el, (agregado.get(el) || 0) + px); tocados.add(el); };
  const escribir = () => {
    const habia = tocados.size > 0 || guiones.length > 0;
    tocados.forEach(el => {
      const prop = el.classList.contains('palabra') ? 'marginLeft' : 'paddingRight';
      el.style[prop] = agregado.has(el) ? (agregado.get(el) / fs).toFixed(3) + 'em' : '';
    });
    guiones.forEach(t => t.classList.add('estirado'));
    tocados.clear();
    guiones.length = 0;
    return habia;
  };
  // Para separar el acorde `b` del anterior `a`: más espacio antes de la
  // palabra de `b` si `b` está al principio de ella; si no, después de la
  // sílaba de `a`, con guion si la palabra sigue
  const separar = (a, b, px) => {
    if (b.palabra.firstChild === b.tramo && a.palabra !== b.palabra) return agregar(b.palabra, px);
    if (a.sil.textContent && sigue(a.tramo)) guiones.push(a.tramo);
    agregar(a.sil, px);
  };

  // Mide un renglón y anota lo que hace falta. Si una palabra tiene que pasar
  // al renglón de abajo (su acorde se saldría por la derecha), la devuelve: lo
  // que sigue no se puede calcular sin cortar y volver a medir
  function medirRenglon(renglon) {
    const inicio = renglon.getBoundingClientRect().left + sangria;
    let ant = null, corrimiento = 0;
    for (const c of renglon.querySelectorAll('.tramo > c')) {
      const tramo = c.parentElement;
      const d = { c, tramo, sil: tramo.lastElementChild, palabra: tramo.parentElement };
      const b = c.getBoundingClientRect();
      if (ant && Math.abs(ant.arriba - b.top) >= 2) { ant = null; corrimiento = 0; }
      let izq = b.left + corrimiento;
      // Una palabra que quedó al principio de un renglón ya no necesita el
      // margen que la separaba de la anterior
      const margen = d.palabra.firstChild === tramo ? agregado.get(d.palabra) : 0;
      if (margen && d.palabra.getBoundingClientRect().left - margen <= inicio + 1) {
        agregado.delete(d.palabra);
        tocados.add(d.palabra);
        corrimiento -= margen;
        izq -= margen;
      }
      let falta = ant ? ant.der + sep - izq : 0;
      if (falta <= 0.5) falta = 0;
      if (izq + falta + b.width > limite + 0.5 && d.palabra.getBoundingClientRect().left > inicio + 1) return d.palabra;
      if (falta) { separar(ant, d, falta); corrimiento += falta; izq += falta; }
      // Acorde sin sílaba: ocupa su ancho (una sola vez)
      if (!d.sil.textContent && !conAncho.has(d.sil)) {
        conAncho.add(d.sil);
        agregar(d.sil, b.width + sep);
        corrimiento += b.width + sep;
      }
      ant = Object.assign(d, { arriba: b.top, der: izq + b.width });
    }
    return null;
  }

  for (let pasada = 0; pasada < 6; pasada++) {
    for (const renglon of renglones) {
      // Un corte: se escribe lo anotado, la palabra pasa abajo (sin el margen
      // que la separaba de antes) y se vuelve a medir solo este renglón
      for (let p = medirRenglon(renglon), cortes = 0; p && cortes < 50; p = medirRenglon(renglon), cortes++) {
        agregado.delete(p);
        tocados.add(p);
        escribir();
        const salto = document.createElement('br');
        salto.className = 'salto';
        p.before(salto);
      }
    }
    if (!escribir()) break;   // nada nuevo: ya está
  }
}
// Al girar el celular o cambiar el ancho de la ventana (no el alto: en el
// celular cambia al desplazarse, cuando aparece o se va la barra de direcciones)
let anchoAnterior = window.innerWidth, relojAcomodar = null;
window.addEventListener('resize', () => {
  if (window.innerWidth === anchoAnterior) return;
  anchoAnterior = window.innerWidth;
  clearTimeout(relojAcomodar);
  relojAcomodar = setTimeout(acomodarAcordes, 150);
});

// ─── LÓGICA 2: ALGORITMO DE TRANSPOSICIÓN Y CAPOTRASTE ───
let currentTranspose = 0;
let capoFret = 0;

// Con capo en traste N, la posición a tocar queda N semitonos abajo
// del acorde que suena: mostrado = original + transposición − capo.
// Mientras se editan los acordes se ven en el tono original (como se guardan)
function renderChords() {
  const semitonos = editandoLetra ? 0 : currentTranspose - capoFret;
  letraBox.querySelectorAll('c').forEach(el => {
    const original = el.getAttribute('data-original');
    el.textContent = transposeChord(original, semitonos);
  });
  acomodarAcordes();
}

// Los cambios hechos a mano (botones o selector) disparan 'tono-cambio'
// para que el bloque del tono del coro sepa que el músico se apartó de él
function applyTransposition(semitones) {
  currentTranspose += semitones;
  // 12 semitonos = una octava: suena igual y queda dentro de lo que aceptan
  // las reglas de la base al guardar el tono del coro (−11 a 11)
  if (currentTranspose > 11) currentTranspose -= 12;
  if (currentTranspose < -11) currentTranspose += 12;
  renderChords();
  document.dispatchEvent(new Event('tono-cambio'));
}

document.getElementById('btnBajarTono').addEventListener('click', () => applyTransposition(-1));
document.getElementById('btnSubirTono').addEventListener('click', () => applyTransposition(1));

const capoSelect = document.getElementById('capoSelect');
const capoIndicator = document.getElementById('capo-indicator');

function ponerCapo(traste) {
  capoFret = traste;
  capoSelect.value = String(traste);
  capoSelect.classList.toggle('active', capoFret > 0);
  if (capoFret > 0) {
    ponerConIcono(capoIndicator, 'guitarra', `Capotraste en traste ${capoFret}: acordes en posición de tocar`);
    capoIndicator.classList.add('visible');
  } else {
    capoIndicator.classList.remove('visible');
  }
  renderChords();
}

capoSelect.addEventListener('change', () => {
  ponerCapo(parseInt(capoSelect.value, 10) || 0);
  document.dispatchEvent(new Event('tono-cambio'));
});

// ─── LÓGICA 3: DICCIONARIO Y DIBUJO DE ACORDES ───
const popover = document.getElementById('chord-popover');
const popoverSvg = document.getElementById('popover-svg');
const popoverTitle = document.getElementById('popover-title');

document.addEventListener('click', (e) => {
  if (editandoLetra) return;   // en el editor, tocar un acorde lo elige (editor.js)
  if (e.target.tagName === 'C') {
    e.stopPropagation();
    let chordName = e.target.textContent.trim();
    let positions = chordLookup(chordName);
    popoverTitle.textContent = capoFret > 0 ? `${chordName} · capo ${capoFret}` : chordName;
    if (positions) {
      popoverSvg.style.display = 'block';
      popoverSvg.innerHTML = drawChordSVG(positions);
      const errorText = popover.querySelector('.popover-error');
      if (errorText) errorText.remove();
    } else {
      popoverSvg.style.display = 'none';
      if (!popover.querySelector('.popover-error')) {
        let msg = document.createElement('div');
        msg.className = 'popover-error';
        msg.style.cssText = "font-family:system-ui;font-size:0.75rem;color:#999;text-align:center;padding:20px 10px;font-style:italic;";
        msg.textContent = "Diagrama no disponible";
        popover.appendChild(msg);
      }
    }
    // Posicionar después de armar el contenido, clampeado al viewport
    popover.style.display = 'block';
    const rect = e.target.getBoundingClientRect();
    const pw = popover.offsetWidth;
    const ph = popover.offsetHeight;
    const vw = document.documentElement.clientWidth;
    let left = rect.left + rect.width / 2 - pw / 2;
    left = Math.max(8, Math.min(left, vw - pw - 8));
    let top = rect.top - ph - 10;
    if (top < 8) top = rect.bottom + 10; // sin lugar arriba → debajo del acorde
    popover.style.left = `${left + window.scrollX}px`;
    popover.style.top = `${top + window.scrollY}px`;
  } else {
    popover.style.display = 'none';
    const errorText = popover.querySelector('.popover-error');
    if (errorText) errorText.remove();
  }
});

window.addEventListener('scroll', () => { popover.style.display = 'none'; });

// ─── LÓGICA 5: NOTA PARA MÚSICOS (Firebase notas/<id>) ───
// Se ve en la vista de músicos y en admin; solo la edita un admin con sesión.
// En modo banco ni se consulta. Si Firebase no cargó, la página sigue igual.
if (!esBanco && idCancion) {
  let notaRef = null;
  const notaBox = document.getElementById('nota');
  const notaTexto = document.getElementById('notaTexto');
  const notaEditBtn = document.getElementById('notaEditBtn');
  const notaForm = document.getElementById('notaForm');
  const notaInput = document.getElementById('notaInput');
  const notaSave = document.getElementById('notaSave');
  let notaActual = '';

  function renderNota() {
    const editando = !notaForm.hidden;
    notaTexto.textContent = notaActual;
    notaTexto.hidden = !notaActual || editando;
    notaEditBtn.hidden = !puedeEditar() || editando;
    notaEditBtn.innerHTML = notaActual ? ico('lapiz') + 'Editar' : ico('mas') + 'Agregar nota';
    notaBox.hidden = !notaActual && !puedeEditar();
  }
  const puedeEditar = () => isAdmin && esAdminOk;
  document.addEventListener('sesion-admin', () => {
    if (!puedeEditar()) notaForm.hidden = true;
    renderNota();
  });

  // Copia local y después la nota publicada, en vivo
  seguirDato('notas/' + idCancion, 'nota_' + idCancion, val => {
    notaActual = typeof val === 'string' ? val : '';
    renderNota();
  }).then(ref => { notaRef = ref; });

  if (isAdmin) {
    notaEditBtn.addEventListener('click', () => {
      notaInput.value = notaActual;
      notaForm.hidden = false;
      renderNota();
      notaInput.focus();
    });
    document.getElementById('notaCancel').addEventListener('click', () => {
      notaForm.hidden = true;
      renderNota();
    });
    // Guardar vacío borra la nota
    notaSave.addEventListener('click', () => {
      escribirDato(notaRef, notaInput.value.trim(), notaSave, 'guardar la nota')
        .then(() => { notaForm.hidden = true; renderNota(); })
        .catch(() => {});
    });
  }
}

// ─── LÓGICA 6: ANTERIOR / SIGUIENTE DENTRO DE MISA DE HOY ───
// Solo si se llegó desde Misa de Hoy (cat=misa). Todos los modos, banco
// incluido. Muestra primero la copia local y después la lista publicada:
// músicos y admin en vivo (SDK), banco por REST (AGENTS.md D14)
if (MODO.cat === 'misa' && idCancion) {
  const nav = document.getElementById('misa-nav');

  function pintarLink(el, id) {
    const s = id && SONGS.find(x => x.id === id);
    el.classList.toggle('vacio', !s);
    el.querySelector('.mn-title').textContent = s ? s.title : '';
    if (s) el.href = linkCon('cancion.html', { id });
    else el.removeAttribute('href');
  }

  function renderMisaNav(lista) {
    const i = lista.indexOf(idCancion);
    nav.hidden = i < 0;
    if (i < 0) return;
    document.getElementById('misaPos').textContent = `${i + 1} / ${lista.length}`;
    pintarLink(document.getElementById('misaPrev'), lista[i - 1]);
    pintarLink(document.getElementById('misaNext'), lista[i + 1]);
  }

  suscribirMisa(renderMisaNav);   // copia local, después la publicada
}

// ─── LÓGICA 7: PANTALLA SIEMPRE ENCENDIDA (músicos y admin) ───
// Dos mecanismos (AGENTS.md §4c):
// 1. Wake Lock API: se pide al abrir y se renueva al volver a la pestaña (el
//    navegador lo suelta al ocultarla) y con cada toque si no está activo.
// 2. Respaldo para iPhone: un video mudo e invisible en bucle, porque iOS no
//    bloquea la pantalla mientras se reproduce un video. Se usa si no hay Wake
//    Lock, si el pedido falla (bajo consumo, ahorro de batería) o si se abrió
//    desde el ícono de inicio en iPhone (hasta iOS 18.4 el Wake Lock ahí no
//    hace nada). iOS solo deja reproducirlo tras un toque.
//    Videos de NoSleep.js v0.12.0 (Rich Tibbett, licencia MIT).
if (!esBanco) {
  const esIOS = /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let usarVideo = !('wakeLock' in navigator) || (esIOS && navigator.standalone === true);
  let wakeLock = null;
  let video = null;

  function prepararVideo() {
    if (video) return video;
    video = document.createElement('video');
    video.muted = true;
    video.loop = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('aria-hidden', 'true');
    video.style.cssText = 'position:fixed;left:0;bottom:0;width:1px;height:1px;opacity:0;pointer-events:none;';
    [['assets/pantalla-encendida.webm', 'video/webm'], ['assets/pantalla-encendida.mp4', 'video/mp4']]
      .forEach(([src, type]) => {
        const s = document.createElement('source');
        s.src = src;
        s.type = type;
        video.appendChild(s);
      });
    document.body.appendChild(video);
    return video;
  }

  function mantenerEncendida() {
    if (document.visibilityState !== 'visible') return;
    if (!usarVideo && (!wakeLock || wakeLock.released)) {
      navigator.wakeLock.request('screen')
        .then(l => { wakeLock = l; })
        .catch(() => { usarVideo = true; prepararVideo(); });
    }
    // Sin toque previo iOS rechaza play(); se reintenta en el próximo toque
    if (usarVideo && prepararVideo().paused) video.play().catch(() => {});
  }

  if (usarVideo) prepararVideo();
  mantenerEncendida();
  document.addEventListener('visibilitychange', mantenerEncendida);
  ['click', 'touchend'].forEach(ev => document.addEventListener(ev, mantenerEncendida, { passive: true }));
}

// ─── LÓGICA 8: DESPLAZAMIENTO AUTOMÁTICO (músicos y admin) ───
// 10 velocidades (6 a 60 px/s). Se detiene al tocar o desplazar a mano fuera
// del control, o al llegar al final. La velocidad se recuerda en el celular
if (!esBanco) {
  const box = document.getElementById('autoscroll');
  const btnPlay = document.getElementById('asPlay');
  const velEl = document.getElementById('asVel');
  let nivel = 3;
  try { nivel = Math.min(10, Math.max(1, parseInt(localStorage.getItem('autoscroll_nivel'), 10) || 3)); } catch (e) {}
  let activo = false, ultimoT = 0, acumulado = 0;

  function pintarAutoscroll() {
    velEl.textContent = nivel;
    box.classList.toggle('playing', activo);
    btnPlay.innerHTML = ico(activo ? 'pausa' : 'play', true);
    btnPlay.setAttribute('aria-label', activo ? 'Detener desplazamiento' : 'Desplazamiento automático');
  }
  const alFinal = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;

  function paso(t) {
    if (!activo) return;
    if (ultimoT) {
      acumulado += 6 * nivel * (t - ultimoT) / 1000;
      const px = Math.floor(acumulado);
      if (px > 0) { window.scrollBy(0, px); acumulado -= px; }
    }
    ultimoT = t;
    if (alFinal()) { detenerAutoscroll(); return; }
    requestAnimationFrame(paso);
  }
  function iniciarAutoscroll() {
    if (alFinal()) return;
    activo = true; ultimoT = 0; acumulado = 0;
    pintarAutoscroll();
    requestAnimationFrame(paso);
  }
  function detenerAutoscroll() {
    activo = false;
    pintarAutoscroll();
  }
  function cambiarNivel(delta) {
    nivel = Math.min(10, Math.max(1, nivel + delta));
    try { localStorage.setItem('autoscroll_nivel', String(nivel)); } catch (e) {}
    pintarAutoscroll();
  }

  btnPlay.addEventListener('click', () => activo ? detenerAutoscroll() : iniciarAutoscroll());
  document.getElementById('asMenos').addEventListener('click', () => cambiarNivel(-1));
  document.getElementById('asMas').addEventListener('click', () => cambiarNivel(1));
  ['touchstart', 'wheel', 'mousedown', 'keydown'].forEach(ev => {
    window.addEventListener(ev, e => {
      if (activo && !box.contains(e.target)) detenerAutoscroll();
    }, { passive: true });
  });

  box.hidden = false;
  pintarAutoscroll();
}

// ─── LÓGICA 9: TONO DEL CORO (Firebase tonos/<id>) ───
// { transponer, capo } en semitonos y traste. Al abrir la canción se aplica
// solo; el músico puede cambiarlo en su celular sin guardar. Un admin con
// sesión lo guarda con "Guardar como tono del coro" (0 y 0 = se borra).
// No existe en modo banco (no hay acordes)
if (!esBanco && idCancion) {
  const tonoBox = document.getElementById('tono-coro');
  const tonoTexto = document.getElementById('tonoTexto');
  const tonoUsar = document.getElementById('tonoUsar');
  const tonoGuardar = document.getElementById('tonoGuardar');
  const ORIGINAL = { transponer: 0, capo: 0 };
  let tonoCoro = null;      // null = el coro la canta en el tono original, sin capo
  let tonoRef = null;
  let tocadoAMano = false;  // el músico cambió el tono: no pisarlo con datos nuevos

  const puedeGuardarTono = () => isAdmin && esAdminOk;

  function validarTono(t) {
    if (!t || !Number.isInteger(t.transponer) || !Number.isInteger(t.capo)) return null;
    if (t.transponer === 0 && t.capo === 0) return null;
    return { transponer: t.transponer, capo: t.capo };
  }
  const tonoActual = () => ({ transponer: currentTranspose, capo: capoFret });
  const mismoTono = (a, b) => a.transponer === b.transponer && a.capo === b.capo;

  // "empieza en RE · capo 2": el primer acorde tal como suena en ese tono
  function describirTono(t) {
    const primero = letraBox.querySelector('c[data-original]');
    const partes = [];
    if (primero) partes.push('empieza en ' + transposeChord(primero.getAttribute('data-original'), t.transponer));
    else if (t.transponer) partes.push((t.transponer > 0 ? '+' : '') + t.transponer + ' semitonos');
    if (t.transponer === 0) partes.push('tono original');
    if (t.capo) partes.push('capo ' + t.capo);
    return partes.join(' · ');
  }

  function aplicarTono(t) {
    currentTranspose = t.transponer;
    ponerCapo(t.capo);   // también llama a renderChords()
    pintarTono();
  }

  function pintarTono() {
    const actual = tonoActual();
    const referencia = tonoCoro || ORIGINAL;
    const enTonoCoro = mismoTono(actual, referencia);

    if (tonoCoro) {
      ponerConIcono(tonoTexto, 'diapason', 'Tono del coro: ' + describirTono(tonoCoro) + (enTonoCoro ? '' : ' (estás viendo otro tono)'));
    } else {
      tonoTexto.textContent = 'Sin tono del coro guardado';
    }
    tonoTexto.classList.toggle('apartado', !enTonoCoro || !tonoCoro);

    tonoUsar.hidden = !tonoCoro;
    tonoUsar.textContent = enTonoCoro ? 'Ver tono original' : 'Volver al tono del coro';
    tonoGuardar.hidden = !puedeGuardarTono() || enTonoCoro;
    tonoGuardar.innerHTML = ico('diapason') + (mismoTono(actual, ORIGINAL)
      ? 'Guardar: tono original, sin capo'
      : 'Guardar como tono del coro');

    tonoBox.hidden = !tonoCoro && tonoGuardar.hidden;
  }

  function recibirTono(val) {
    tonoCoro = validarTono(val);
    if (!tocadoAMano) aplicarTono(tonoCoro || ORIGINAL);
    else pintarTono();
  }

  tonoUsar.addEventListener('click', () => {
    const enTonoCoro = mismoTono(tonoActual(), tonoCoro || ORIGINAL);
    tocadoAMano = enTonoCoro;   // ver el original es apartarse del tono del coro
    aplicarTono(enTonoCoro ? ORIGINAL : tonoCoro);
  });

  tonoGuardar.addEventListener('click', () => {
    escribirDato(tonoRef, validarTono(tonoActual()), tonoGuardar, 'guardar el tono')
      .then(() => { tocadoAMano = false; })
      .catch(() => {});
  });

  document.addEventListener('tono-cambio', () => { tocadoAMano = true; pintarTono(); });
  document.addEventListener('letra-cargada', pintarTono);
  document.addEventListener('sesion-admin', pintarTono);

  // Copia local y después el tono publicado, en vivo
  seguirDato('tonos/' + idCancion, 'tono_' + idCancion, recibirTono)
    .then(ref => { tonoRef = ref; });
}
// ─── LÓGICA 10: AUDIOS Y LINKS (campo `medios` de la canción en songs.js) ───
// [{ url, etiqueta?, tipo? }]. El tipo se deduce de la URL: YouTube, Spotify,
// Google Drive, archivo de audio (mp3, m4a…) o, si no, un link común.
// Solo músicos y admin; sin conexión se ocultan (los reproductores necesitan red)
// (La sección sigue más abajo, después de crearMedio)
function crearMedio(m) {
  const url = String(m.url || '');
  const cont = document.createElement('div');
  cont.className = 'medio';
  if (m.etiqueta) {
    const et = document.createElement('div');
    et.className = 'medio-etiqueta';
    et.textContent = m.etiqueta;
    cont.appendChild(et);
  }
  const iframe = (clase, src, titulo) => {
    const f = document.createElement('iframe');
    f.className = clase;
    f.src = src;
    f.title = titulo;
    f.loading = 'lazy';
    f.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
    f.allowFullscreen = true;
    return f;
  };
  let r;
  if (m.tipo === 'youtube' || (r = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([\w-]{11})/))) {
    r = r || url.match(/([\w-]{11})/);
    if (!r) return null;
    cont.appendChild(iframe('youtube', 'https://www.youtube-nocookie.com/embed/' + r[1], m.etiqueta || 'Video de YouTube'));
  } else if (r = url.match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(track|album|playlist|episode|show)\/([A-Za-z0-9]+)/)) {
    cont.appendChild(iframe('spotify', `https://open.spotify.com/embed/${r[1]}/${r[2]}`, m.etiqueta || 'Spotify'));
  } else if (r = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]+)/)) {
    cont.appendChild(iframe('drive', `https://drive.google.com/file/d/${r[1]}/preview`, m.etiqueta || 'Audio en Google Drive'));
  } else if (m.tipo === 'audio' || /\.(mp3|m4a|ogg|wav|aac)(\?|#|$)/i.test(url)) {
    const a = document.createElement('audio');
    a.controls = true;
    a.preload = 'none';
    a.src = url;
    cont.appendChild(a);
  } else if (/^https?:\/\//.test(url)) {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = m.etiqueta ? 'Abrir link' : url;
    cont.appendChild(a);
  } else {
    return null;
  }
  return cont;
}

//
// Además de los de songs.js, un admin con sesión puede agregar links desde la
// página: se guardan en Firebase (medios/<id>, lista de hasta 5
// { url, etiqueta }) y se muestran después de los de songs.js. Los de
// songs.js no se editan desde la web
const MAX_MEDIOS = 5;
let mediosFijos = [];       // de songs.js
let mediosAgregados = [];   // de Firebase
let mediosRef = null;
const puedeEditarMedios = () => isAdmin && esAdminOk && !esBanco;

// Lo que llega de Firebase: solo links https, sin campos de más
function validarMedios(val) {
  const lista = Array.isArray(val) ? val : (val ? Object.values(val) : []);
  return lista
    .filter(m => m && typeof m.url === 'string' && /^https:\/\//.test(m.url))
    .slice(0, MAX_MEDIOS)
    .map(m => (typeof m.etiqueta === 'string' && m.etiqueta ? { url: m.url, etiqueta: m.etiqueta } : { url: m.url }));
}

function guardarMedios(lista, boton, accion) {
  return escribirDato(mediosRef, lista.length ? lista : null, boton, accion);
}

// `fijos` reemplaza la lista de songs.js; sin argumento, solo redibuja
function renderMedios(fijos) {
  if (fijos) mediosFijos = fijos;
  const box = document.getElementById('medios');
  const cont = document.getElementById('mediosLista');
  cont.textContent = '';
  mediosFijos.map(crearMedio).filter(Boolean).forEach(el => cont.appendChild(el));
  const yaEstan = new Set(mediosFijos.map(m => m.url));
  mediosAgregados.forEach(m => {
    if (yaEstan.has(m.url)) return;
    const el = crearMedio(m);
    if (!el) return;
    if (puedeEditarMedios()) {
      const quitar = document.createElement('button');
      quitar.type = 'button';
      quitar.className = 'nota-edit medio-btn';
      quitar.innerHTML = ico('papelera') + 'Quitar';
      quitar.addEventListener('click', () => {
        if (!confirm('¿Quitar este audio o link?')) return;
        guardarMedios(mediosAgregados.filter(x => x !== m), quitar, 'quitar el audio').catch(() => {});
      });
      el.appendChild(quitar);
    }
    cont.appendChild(el);
  });
  const form = document.getElementById('medioForm');
  if (!puedeEditarMedios()) form.hidden = true;
  document.getElementById('medioAgregar').hidden = !puedeEditarMedios() || !form.hidden;
  // Sin conexión se oculta todo: los reproductores necesitan red
  box.hidden = !(cont.children.length > 0 || puedeEditarMedios()) || !navigator.onLine;
}

if (!esBanco && cancionActual) {
  const form = document.getElementById('medioForm');
  const inputUrl = document.getElementById('medioUrl');
  const inputEtiqueta = document.getElementById('medioEtiqueta');
  const btnGuardar = document.getElementById('medioSave');

  renderMedios(Array.isArray(cancionActual.medios) ? cancionActual.medios : []);
  window.addEventListener('online', () => renderMedios());
  window.addEventListener('offline', () => renderMedios());
  document.addEventListener('sesion-admin', () => renderMedios());

  // Copia local y después lo publicado, en vivo. Solo se redibuja si cambió
  // (redibujar recarga los reproductores)
  seguirDato('medios/' + idCancion, 'medios_' + idCancion, val => {
    const nuevos = validarMedios(val);
    if (JSON.stringify(nuevos) === JSON.stringify(mediosAgregados)) return;
    mediosAgregados = nuevos;
    renderMedios();
  }).then(ref => { mediosRef = ref; });

  document.getElementById('medioAgregar').addEventListener('click', () => {
    inputUrl.value = '';
    inputEtiqueta.value = '';
    form.hidden = false;
    renderMedios();
    inputUrl.focus();
  });
  document.getElementById('medioCancel').addEventListener('click', () => {
    form.hidden = true;
    renderMedios();
  });
  btnGuardar.addEventListener('click', () => {
    const url = inputUrl.value.trim();
    const etiqueta = inputEtiqueta.value.trim().slice(0, 60);
    if (!/^https:\/\/\S+$/.test(url) || url.length > 300) {
      alert('Pegá el link completo: tiene que empezar con https://');
      return;
    }
    if (mediosFijos.concat(mediosAgregados).some(m => m.url === url)) {
      alert('Ese link ya está cargado en esta canción.');
      return;
    }
    if (mediosAgregados.length >= MAX_MEDIOS) {
      alert(`Se pueden agregar hasta ${MAX_MEDIOS} links por canción. Quitá uno primero.`);
      return;
    }
    guardarMedios(mediosAgregados.concat(etiqueta ? { url, etiqueta } : { url }), btnGuardar, 'guardar el audio')
      .then(() => { form.hidden = true; renderMedios(); avisar('✓ Audio agregado'); })
      .catch(() => {});
  });
}

// ─── LÓGICA 12: AGREGAR A LA MISA DE HOY (admin con sesión) ───
// Suma o quita la canción del borrador de la misa (comun.js), igual que el +
// del índice: no publica. Se publica desde Misa de Hoy, en el índice
if (isAdmin && !esBanco && cancionActual) {
  const caja = document.getElementById('misa-agregar');
  const btn = document.getElementById('misaAgregarBtn');
  const pendiente = document.getElementById('misaPendiente');
  const irAPublicar = linkCon('index.html', { cat: 'misa' });
  let publicada = [];
  document.getElementById('misaIrPublicar').href = irAPublicar;

  // La lista sobre la que se trabaja: el borrador o, si no hay, la publicada
  const listaDeTrabajo = () => leerBorradorMisa() || { ids: publicada, base: publicada };

  function pintarMisaAgregar() {
    const esta = listaDeTrabajo().ids.includes(idCancion);
    btn.innerHTML = esta ? ico('check') + 'En la Misa de Hoy · Quitar' : ico('mas') + 'Agregar a la Misa de Hoy';
    btn.classList.toggle('active', esta);
    btn.setAttribute('aria-pressed', String(esta));
    pendiente.classList.toggle('oculta', !leerBorradorMisa());
    caja.hidden = !esAdminOk;
  }

  btn.addEventListener('click', () => {
    const { ids, base } = listaDeTrabajo();
    const esta = ids.includes(idCancion);
    const nueva = esta ? ids.filter(id => id !== idCancion) : insertarEnMisa(ids, idCancion);
    const faltaPublicar = guardarBorradorMisa(nueva, base);
    pintarMisaAgregar();
    avisar(esta ? `Quitada de la Misa de Hoy (${nueva.length})` : `✓ Agregada a la Misa de Hoy (${nueva.length})`,
      faltaPublicar ? { texto: 'Ir a publicar ›', href: irAPublicar } : null);
    if (navigator.vibrate) navigator.vibrate(10);
  });

  // Si la misa publicada ya es igual al borrador, no queda nada por publicar
  suscribirMisa(ids => {
    publicada = ids;
    const b = leerBorradorMisa();
    if (b && mismaLista(ids, b.ids)) borrarBorradorMisa();
    pintarMisaAgregar();
  });
  document.addEventListener('sesion-admin', pintarMisaAgregar);
  pintarMisaAgregar();   // ya, con el borrador y la sesión recordada
  window.addEventListener('storage', e => { if (e.key === 'misa_borrador') pintarMisaAgregar(); });
  window.addEventListener('pageshow', e => { if (e.persisted) pintarMisaAgregar(); });
}

// ─── LÓGICA 11: TAMAÑO DE LETRA (todos los modos, también banco) ───
// 6 tamaños; el elegido se recuerda en el celular. Excepción a D10: es el
// único control que ven los fieles (AGENTS.md §4c)
{
  const ESCALAS = [0.85, 1, 1.15, 1.3, 1.45, 1.6];
  const menos = document.getElementById('letraMenos');
  const mas = document.getElementById('letraMas');
  let nivel = 1;
  try {
    const guardado = parseInt(localStorage.getItem('tam_letra'), 10);
    if (guardado >= 0 && guardado < ESCALAS.length) nivel = guardado;
  } catch (e) {}

  function aplicarTamano() {
    letraBox.style.setProperty('--escala-letra', ESCALAS[nivel]);
    menos.disabled = nivel === 0;
    mas.disabled = nivel === ESCALAS.length - 1;
    acomodarAcordes();   // con otro tamaño cambian los renglones
  }
  function cambiarTamano(delta) {
    nivel = Math.min(ESCALAS.length - 1, Math.max(0, nivel + delta));
    try { localStorage.setItem('tam_letra', String(nivel)); } catch (e) {}
    aplicarTamano();
  }
  menos.addEventListener('click', () => cambiarTamano(-1));
  mas.addEventListener('click', () => cambiarTamano(1));
  aplicarTamano();
}
