// Página de una canción (cancion.html?id=<id>). Usa comun.js, acordes.js,
// firebase-config.js, offline.js, sesion.js y songs.js. Las secciones
// "LÓGICA N" están descriptas en AGENTS.md §4b–§4c.

// MODO, urlParams, linkCon, botonModo y lineasDeLetra vienen de comun.js;
// seguirDato, suscribirMisa y escribirDato, de firebase-config.js
const esBanco = MODO.banco;
const isAdmin = MODO.admin;
if (esBanco) document.body.classList.add('banco-mode');

// "Volver" conserva modo, admin y categoría activa del índice
document.querySelector('.back-link').href = linkCon('index.html');

// Admin: barra de sesión con Google. Editar requiere un admin autorizado
// (esAdminOk y el evento 'sesion-admin' vienen de sesion.js)
if (isAdmin && !esBanco) panelSesion(document.querySelector('main'));

// Botón "Modo admin" (comun.js): pide confirmación si hay una nota a medio escribir
botonModo(() => document.getElementById('notaForm').hidden ? null : 'Hay una nota sin guardar. ¿Salir igual?');

// Envuelve cada línea compuesta solo por acordes (y espacios/guiones) en un
// span.chord-line, para poder ocultarla entera sin dejar renglones en blanco.
// Una línea "Intro: <c>DO</c> <c>FA</c>" también cuenta como línea de acordes
function wrapChordLines(html) {
  return html.replace(/\s+$/, '').split('\n').map(line => {
    const resto = line.replace(/<c>[^<]*<\/c>/g, '').replace(/^\s*intro:/i, '');
    if (/<c>/.test(line) && /^[\s\-–—|/.()]*$/.test(resto)) {
      return '<span class="chord-line">' + line + '\n</span>';
    }
    return line + '\n';
  }).join('');
}

const idCancion = urlParams.get('id');

if (!idCancion) {
  window.location.replace('index.html');
  throw new Error('Sin ?id=: se vuelve al índice');   // corta el resto del script
}

// Título: de SONGS (songs.js); si la canción no está, el de ?t= o uno armado
// desde el id
const cancionActual = SONGS.find(s => s.id === idCancion) || null;
const tituloCancion = (cancionActual && cancionActual.title) || urlParams.get('t') ||
  (idCancion || '').replace(/^[a-z]+_/, '').split('-')
    .map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');

// Solo ids con forma de nombre de archivo (prefijo_slug): nada de rutas ni HTML
const idValido = /^[a-z]+_[a-z0-9-]+$/.test(idCancion || '');

(idValido ? fetch(`letras/${idCancion}.html`) : Promise.reject(new Error('id inválido')))
  .then(response => {
    if (!response.ok) throw new Error();
    return response.text();
  })
  .then(textoLetra => {
    document.getElementById('letra-box').innerHTML = wrapChordLines(textoLetra);

    document.getElementById('song-title').textContent = tituloCancion;
    document.title = `${tituloCancion} — Coro del Carmen`;

    document.querySelectorAll('pre c').forEach(el => {
      el.setAttribute('data-original', el.textContent.trim());
    });

    // Los lectores de pantalla saltean los acordes: solo leen la letra
    document.querySelectorAll('pre c, pre .chord-line').forEach(el => {
      el.setAttribute('aria-hidden', 'true');
    });

    // Si el tono del coro llegó antes que la letra, se aplica ahora
    renderChords();
    document.dispatchEvent(new Event('letra-cargada'));
  })
  .catch(() => {
    // El id viene de la URL: va con textContent, nunca como HTML (evita XSS)
    const msg = document.createElement('div');
    msg.className = 'error-msg';
    const archivo = document.createElement('b');
    archivo.textContent = `letras/${idCancion}.html`;
    msg.append('No se pudo cargar la letra.', document.createElement('br'), 'Verificá el archivo: ', archivo);
    document.getElementById('letra-box').replaceChildren(msg);
    document.getElementById('song-title').textContent = tituloCancion || "Error";
  });

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
});

// ─── LÓGICA 2: ALGORITMO DE TRANSPOSICIÓN Y CAPOTRASTE ───
let currentTranspose = 0;
let capoFret = 0;

// Con capo en traste N, la posición a tocar queda N semitonos abajo
// del acorde que suena: mostrado = original + transposición − capo
function renderChords() {
  document.querySelectorAll('pre c').forEach(el => {
    const original = el.getAttribute('data-original');
    el.textContent = transposeChord(original, currentTranspose - capoFret);
  });
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
    capoIndicator.textContent = `🎸 Capotraste en traste ${capoFret} — acordes en posición de tocar`;
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

// ─── LÓGICA 4: LECTOR DE LETRA EN VOZ ALTA (accesibilidad) ───
const btnSpeak = document.getElementById('btnSpeak');

if (!('speechSynthesis' in window)) {
  btnSpeak.parentElement.style.display = 'none';
} else {

  let leyendo = false;

  function detenerLectura() {
    speechSynthesis.cancel();
    leyendo = false;
    btnSpeak.textContent = '🔊 Escuchar letra';
    btnSpeak.classList.remove('active');
    btnSpeak.setAttribute('aria-pressed', 'false');
  }

  btnSpeak.addEventListener('click', () => {
    if (leyendo) {
      detenerLectura();
      return;
    }
    const lineas = lineasDeLetra(letraBox.innerHTML);   // solo la letra (comun.js)
    if (!lineas.length) return;

    speechSynthesis.cancel();
    leyendo = true;
    btnSpeak.textContent = '⏹ Detener lectura';
    btnSpeak.classList.add('active');
    btnSpeak.setAttribute('aria-pressed', 'true');

    const vozEs = speechSynthesis.getVoices()
      .find(v => v.lang && v.lang.toLowerCase().startsWith('es')) || null;

    // Una utterance por línea: evita el corte de Chrome en textos largos
    // y marca una pausa natural al final de cada verso
    lineas.forEach((linea, i) => {
      const u = new SpeechSynthesisUtterance(linea);
      u.lang = 'es-ES';
      if (vozEs) u.voice = vozEs;
      u.rate = 0.95;
      if (i === lineas.length - 1) u.onend = detenerLectura;
      u.onerror = () => { if (leyendo) detenerLectura(); };
      speechSynthesis.speak(u);
    });
  });

  window.addEventListener('pagehide', () => speechSynthesis.cancel());
}

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
    notaEditBtn.textContent = notaActual ? '✏️ Editar' : '➕ Agregar nota';
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
    btnPlay.textContent = activo ? '⏸' : '▶';
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
// sesión lo guarda con "💾 Guardar como tono del coro" (0 y 0 = se borra).
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
    const primero = document.querySelector('pre c[data-original]');
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
      tonoTexto.textContent = '🎼 Tono del coro: ' + describirTono(tonoCoro) + (enTonoCoro ? '' : ' (estás viendo otro tono)');
    } else {
      tonoTexto.textContent = 'Sin tono del coro guardado';
    }
    tonoTexto.classList.toggle('apartado', !enTonoCoro || !tonoCoro);

    tonoUsar.hidden = !tonoCoro;
    tonoUsar.textContent = enTonoCoro ? 'Ver tono original' : 'Volver al tono del coro';
    tonoGuardar.hidden = !puedeGuardarTono() || enTonoCoro;
    tonoGuardar.textContent = mismoTono(actual, ORIGINAL)
      ? '💾 Guardar: tono original, sin capo'
      : '💾 Guardar como tono del coro';

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

function renderMedios(lista) {
  const box = document.getElementById('medios');
  const cont = document.getElementById('mediosLista');
  cont.textContent = '';
  (lista || []).map(crearMedio).filter(Boolean).forEach(el => cont.appendChild(el));
  const hay = cont.children.length > 0;
  const mostrar = () => { box.hidden = !hay || !navigator.onLine; };
  mostrar();
  window.addEventListener('online', mostrar);
  window.addEventListener('offline', mostrar);
}

if (!esBanco && cancionActual && Array.isArray(cancionActual.medios)) {
  renderMedios(cancionActual.medios);
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
