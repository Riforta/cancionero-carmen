// Letras del cancionero (AGENTS.md §3 y D22): el formato de texto con cada
// acorde anclado a su sílaba, su lectura, su escritura y el HTML que lo
// dibuja. Funciones puras, sin tocar la página: las usan cancion.js, la
// búsqueda del índice y (más adelante) el editor. Se prueban en Node con
// tests/letra.node.mjs.
//
// Formato de letras/<id>.txt, un renglón por línea:
//   [SOL]Toma, Señor, y re[MIm]cibe toda mi [DO]libertad,
//       El acorde va justo antes de la letra sobre la que cae.
//   tan cerca de mí,[DO7] tan cerca de mí,[SOL]
//       Pegado al final de una palabra (antes del espacio o al final del
//       renglón): se toca después de esa palabra, mientras se sostiene.
//   Intro: [DO] [FA] [SOL]
//       Renglón de solo acordes: además de los acordes, solo espacios,
//       guiones, barras, puntos, paréntesis o un "Intro:" al principio.
//   [(MI)]                         acorde opcional
//   {estribillo} … {/estribillo}   el estribillo, cada marca en su renglón
//   {titulo: A la tarde}           subtítulo (varias canciones en un archivo)
//   {nota: (Se repite)}            aclaración, en cursiva
//   {pendiente}                    la letra todavía no está cargada
// Un renglón vacío separa estrofas.

const RE_ACORDE = /\[([^\[\]]*)\]/g;
const RE_SOLO_ACORDES = /^\s*(?:intro\s*:)?[\s\-–—|/.()]*$/i;
const RE_DIRECTIVA = /^\{\s*(\/?)\s*([a-záéíóúñ]+)\s*(?::\s*(.*?))?\s*\}$/i;
// Renglón de letra que es solo puntuación: no cuenta para la búsqueda
const RE_SOLO_SIGNOS = /^[\s\-–—|/.():,;×xX]*$/;

function escaparLetra(t) {
  return String(t).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// "SOL" → { nombre: 'SOL', opcional: false }; "(MI)" → opcional. Vacío: null
function leerAcorde(interior) {
  const t = interior.trim();
  const m = t.match(/^\((.*)\)$/);
  const nombre = (m ? m[1] : t).trim();
  return nombre ? { nombre, opcional: !!m } : null;
}

function escribirAcorde(a) {
  return '[' + (a.opcional ? '(' + a.nombre + ')' : a.nombre) + ']';
}

// Un renglón en orden: [{ texto }, { acorde }, …]. Unos corchetes vacíos
// quedan como texto
function partesDe(linea) {
  const partes = [];
  let ultimo = 0;
  for (const m of linea.matchAll(RE_ACORDE)) {
    const acorde = leerAcorde(m[1]);
    if (!acorde) continue;
    if (m.index > ultimo) partes.push({ texto: linea.slice(ultimo, m.index) });
    partes.push({ acorde });
    ultimo = m.index + m[0].length;
  }
  if (ultimo < linea.length) partes.push({ texto: linea.slice(ultimo) });
  return partes;
}

// Texto → renglones. Cada renglón lleva `estribillo` (true/false) y es uno de:
//   { tipo: 'vacio' }
//   { tipo: 'letra', tramos: [{ acorde: null | { nombre, opcional }, texto }] }
//       Cada tramo empieza con su acorde; el primero puede no tener.
//   { tipo: 'acordes', partes: [{ texto } | { acorde }] }   (solo acordes)
//   { tipo: 'titulo', texto } | { tipo: 'nota', texto } | { tipo: 'pendiente' }
// Una marca entre llaves que no se reconoce queda como texto.
function parsearLetra(texto) {
  const renglones = [];
  let estribillo = false;
  for (const crudo of String(texto || '').replace(/\r\n?/g, '\n').split('\n')) {
    const linea = crudo.replace(/\s+$/, '');
    const d = linea.trim().match(RE_DIRECTIVA);
    if (d) {
      const cierre = !!d[1];
      const nombre = d[2].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const valor = d[3];
      if (nombre === 'estribillo' && valor === undefined) { estribillo = !cierre; continue; }
      if (!cierre && valor !== undefined && (nombre === 'titulo' || nombre === 'nota')) {
        renglones.push({ tipo: nombre, texto: valor, estribillo });
        continue;
      }
      if (!cierre && valor === undefined && nombre === 'pendiente') {
        renglones.push({ tipo: 'pendiente', estribillo });
        continue;
      }
    }
    if (!linea.trim()) { renglones.push({ tipo: 'vacio', estribillo }); continue; }
    const partes = partesDe(linea);
    const resto = partes.filter(p => !p.acorde).map(p => p.texto).join('');
    if (partes.some(p => p.acorde) && RE_SOLO_ACORDES.test(resto)) {
      renglones.push({ tipo: 'acordes', partes, estribillo });
      continue;
    }
    const tramos = [];
    for (const p of partes) {
      if (p.acorde) tramos.push({ acorde: p.acorde, texto: '' });
      else if (tramos.length) tramos[tramos.length - 1].texto += p.texto;
      else tramos.push({ acorde: null, texto: p.texto });
    }
    renglones.push({ tipo: 'letra', tramos, estribillo });
  }
  while (renglones.length && renglones[0].tipo === 'vacio') renglones.shift();
  while (renglones.length && renglones[renglones.length - 1].tipo === 'vacio') renglones.pop();
  return renglones;
}

// Renglones → texto (lo inverso de parsearLetra). Las marcas del estribillo
// van en su propio renglón, donde empieza y donde termina
function escribirLetra(renglones) {
  const lineas = [];
  let estribillo = false;
  for (const r of renglones) {
    const e = !!r.estribillo;
    if (e !== estribillo) { lineas.push(e ? '{estribillo}' : '{/estribillo}'); estribillo = e; }
    if (r.tipo === 'vacio') lineas.push('');
    else if (r.tipo === 'titulo' || r.tipo === 'nota') lineas.push(`{${r.tipo}: ${r.texto}}`);
    else if (r.tipo === 'pendiente') lineas.push('{pendiente}');
    else if (r.tipo === 'acordes') lineas.push(r.partes.map(p => p.acorde ? escribirAcorde(p.acorde) : p.texto).join(''));
    else lineas.push(r.tramos.map(t => (t.acorde ? escribirAcorde(t.acorde) : '') + t.texto).join(''));
  }
  if (estribillo) lineas.push('{/estribillo}');
  return lineas.join('\n') + '\n';
}

// Los acordes de los renglones, en orden: [{ nombre, opcional }]
function acordesDeLetra(renglones) {
  const acordes = [];
  for (const r of renglones) {
    if (r.tipo === 'letra') r.tramos.forEach(t => { if (t.acorde) acordes.push(t.acorde); });
    else if (r.tipo === 'acordes') r.partes.forEach(p => { if (p.acorde) acordes.push(p.acorde); });
  }
  return acordes;
}

// Los renglones de letra, sin acordes ni renglones vacíos o de puro signo.
// Los usa la búsqueda por letra del índice
function lineasDeTexto(texto) {
  const lineas = [];
  for (const r of parsearLetra(texto)) {
    let t = '';
    if (r.tipo === 'letra') t = r.tramos.map(x => x.texto).join('');
    else if (r.tipo === 'titulo' || r.tipo === 'nota') t = r.texto;
    t = t.replace(/\s+/g, ' ').trim();
    if (t && !RE_SOLO_SIGNOS.test(t)) lineas.push(t);
  }
  return lineas;
}

// ── Para armar renglones (conversión y editor) ──

// Deja un solo espacio entre palabras y ninguno en las puntas. Las
// `posiciones` (índices en `texto`) se corren para seguir apuntando al mismo
// carácter. Una que cae en un hueco entre palabras queda en el espacio que
// sobrevive (después de la palabra anterior); en los espacios del principio,
// al principio, y en los del final, al final
function colapsarEspacios(texto, posiciones = []) {
  let nuevo = '';
  const mapa = new Array(texto.length + 1);
  for (let i = 0; i < texto.length; i++) {
    if (/\s/.test(texto[i])) {
      if (nuevo && !nuevo.endsWith(' ')) nuevo += ' ';
      mapa[i] = nuevo ? nuevo.length - 1 : 0;
    } else {
      mapa[i] = nuevo.length;
      nuevo += texto[i];
    }
  }
  if (nuevo.endsWith(' ')) nuevo = nuevo.slice(0, -1);
  mapa[texto.length] = nuevo.length;
  const pos = p => Math.min(nuevo.length, mapa[Math.max(0, Math.min(texto.length, p))]);
  return { texto: nuevo, posiciones: posiciones.map(pos) };
}

// Inserta los acordes ([{ nombre, opcional, pos }]) en el texto. Dos en la
// misma posición quedan en el orden en que vienen
function armarRenglon(texto, acordes) {
  const orden = acordes.map((a, i) => ({ a, i, pos: Math.max(0, Math.min(texto.length, a.pos)) }))
    .sort((x, y) => x.pos - y.pos || x.i - y.i);
  let linea = '', desde = 0;
  for (const { a, pos } of orden) {
    linea += texto.slice(desde, pos) + escribirAcorde(a);
    desde = pos;
  }
  return linea + texto.slice(desde);
}

// ── HTML ──
// Cada palabra con acordes va en un .palabra (no se corta), y cada acorde
// con su sílaba en un .tramo: el acorde arriba (<c>) y la sílaba abajo
// (.sil). Las palabras sin acordes son texto común, así el renglón puede
// seguir abajo en un celular angosto. Todo el texto va escapado.

function htmlAcorde(a) {
  const n = escaparLetra(a.nombre);
  return `<c${a.opcional ? ' class="opcional"' : ''} data-original="${n}" aria-hidden="true">${n}</c>`;
}

function htmlTramo(acorde, silaba) {
  return `<span class="tramo">${htmlAcorde(acorde)}<span class="sil">${escaparLetra(silaba)}</span></span>`;
}

function htmlRenglonLetra(tramos) {
  let s = '';
  const acordes = [];
  for (const t of tramos) {
    if (t.acorde) acordes.push({ acorde: t.acorde, pos: s.length });
    s += t.texto;
  }
  if (!acordes.length) return `<div class="renglon">${escaparLetra(s)}</div>`;
  const n = s.length;
  // Un acorde entre palabras (sobre un espacio, o al final) va después de la
  // palabra anterior: "mí,[DO7] tan" se toca al terminar "mí,". Si no hay
  // palabra antes, va con la primera
  for (const a of acordes) {
    if (a.pos < n && !/\s/.test(s[a.pos])) continue;
    let q = a.pos - 1;
    while (q >= 0 && /\s/.test(s[q])) q--;
    if (q >= 0) a.pos = q + 1;
    else while (a.pos < n && /\s/.test(s[a.pos])) a.pos++;
  }
  let html = '', i = 0, k = 0;
  while (i < n) {
    let j = i;
    if (/\s/.test(s[i])) {
      while (j < n && /\s/.test(s[j])) j++;
      html += ' ';
      i = j;
      continue;
    }
    while (j < n && !/\s/.test(s[j])) j++;
    // Los acordes de esta palabra, incluidos los que van justo después
    const desde = k;
    while (k < acordes.length && acordes[k].pos <= j) k++;
    const mios = acordes.slice(desde, k);
    if (!mios.length) { html += escaparLetra(s.slice(i, j)); i = j; continue; }
    html += '<span class="palabra">' + escaparLetra(s.slice(i, mios[0].pos));
    mios.forEach((a, m) => {
      const fin = Math.min(m + 1 < mios.length ? mios[m + 1].pos : j, j);
      html += htmlTramo(a.acorde, s.slice(Math.min(a.pos, j), fin));
    });
    html += '</span>';
    i = j;
  }
  // Por las dudas (no debería quedar ninguno): al final del renglón
  if (k < acordes.length) html += '<span class="palabra">' + acordes.slice(k).map(a => htmlTramo(a.acorde, '')).join('') + '</span>';
  return `<div class="renglon con-acordes">${html}</div>`;
}

function htmlRenglon(r) {
  if (r.tipo === 'vacio') return '<div class="renglon vacio"></div>';
  if (r.tipo === 'titulo') return `<h3 class="subtitulo">${escaparLetra(r.texto)}</h3>`;
  if (r.tipo === 'nota') return `<div class="renglon aclaracion">${escaparLetra(r.texto)}</div>`;
  if (r.tipo === 'pendiente') {
    return '<div class="letra-pendiente"><svg class="ico" aria-hidden="true"><use href="assets/iconos.svg#nota"/></svg>' +
      'Letra pendiente de carga.<br><br>Esta canción todavía no tiene la letra cargada en el cancionero.</div>';
  }
  if (r.tipo === 'acordes') {
    return '<div class="renglon solo-acordes" aria-hidden="true">' +
      r.partes.map(p => p.acorde ? htmlAcorde(p.acorde) : escaparLetra(p.texto)).join('') + '</div>';
  }
  return htmlRenglonLetra(r.tramos);
}

// Renglones → HTML de la letra. El estribillo va en un .estribillo
function htmlDeLetra(renglones) {
  let html = '', enEstribillo = false;
  for (const r of renglones) {
    if (!!r.estribillo !== enEstribillo) {
      html += enEstribillo ? '</div>' : '<div class="estribillo">';
      enEstribillo = !enEstribillo;
    }
    html += htmlRenglon(r);
  }
  return html + (enEstribillo ? '</div>' : '');
}

// Para Node (tests/letra.node.mjs y la conversión); en el navegador no hace nada
if (typeof module !== 'undefined') {
  module.exports = { parsearLetra, escribirLetra, acordesDeLetra, lineasDeTexto, colapsarEspacios, armarRenglon, htmlDeLetra, escaparLetra };
}
