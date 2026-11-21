// Pasa al repo lo cargado desde la web (AGENTS.md D25, etapa 4 del plan de
// canciones editables). Lee Firebase por REST, sin sesión (la lectura es
// pública), y escribe:
// - letras/<id>.txt de cada letra corregida o cargada desde la web;
// - la entrada en SONGS (songs.js) de cada canción nueva, en el bloque de su
//   momento (si el bloque no existe, lo crea al final).
// No borra nada de Firebase (escribir necesita sesión de admin): cuando el
// cambio ya está publicado, el índice abierto por un admin con sesión saca
// de la web lo que quedó igual al repo (index.html, D25).
//
// Uso (Node 22+, sin dependencias):
//   node herramientas/pasar-web-al-repo.mjs            pasa todo
//   node herramientas/pasar-web-al-repo.mjs --probar   muestra qué haría, sin escribir
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { parsearLetra, escribirLetra } = require(path.join(raiz, 'letra.js'));

// El texto como queda en el repo: LF, sin espacios al final ni renglones vacíos en las puntas
export const canonica = t => escribirLetra(parsearLetra(String(t || '')));

// SONGS y CATS de songs.js
export function leerSongs(texto) {
  return vm.runInNewContext(texto + '\n;({ SONGS, CATS })');
}

// songs.js con una canción más, después de la última de su momento. Si el
// momento no tiene ninguna, en un bloque nuevo al final de la lista
export function agregarASongs(texto, s, CATS) {
  const lineas = texto.split('\n');
  const fin = lineas.findIndex(l => /^\];/.test(l));
  const entrada = `  { "id": ${JSON.stringify(s.id)}, "num": ${s.num}, "title": ${JSON.stringify(s.title)}, "category": ${JSON.stringify(s.category)} }`;
  let despues = -1;
  for (let i = 0; i < fin; i++) if (lineas[i].includes(`"category": ${JSON.stringify(s.category)}`)) despues = i;
  const nuevas = [];
  if (despues < 0) {
    const cat = CATS.find(([id]) => id === s.category);
    nuevas.push('', `  // --- ${(cat ? cat[1] : s.category).toUpperCase()} (${s.id.split('_')[0]}_) ---`);
    despues = fin - 1;
    while (despues > 0 && !lineas[despues].trim()) despues--;
  }
  nuevas.push(entrada);
  // La última de la lista va sin coma; las demás, con
  const esUltima = lineas.slice(despues + 1, fin).every(l => !l.trim() || l.trim().startsWith('//'));
  if (esUltima && !lineas[despues].trimEnd().endsWith(',') && lineas[despues].trim().startsWith('{')) lineas[despues] = lineas[despues].trimEnd() + ',';
  if (!esUltima) nuevas[nuevas.length - 1] += ',';
  lineas.splice(despues + 1, 0, ...nuevas);
  return lineas.join('\n');
}

// songs.js sin una canción (la eliminada, D26). Si era la última de la lista,
// la anterior queda sin coma; si su bloque queda vacío, se va el comentario
export function quitarDeSongs(texto, id) {
  const lineas = texto.split('\n');
  const i = lineas.findIndex(l => l.includes(`"id": ${JSON.stringify(id)}`));
  if (i < 0) return texto;
  lineas.splice(i, 1);
  const esEntrada = l => l.trim().startsWith('{');
  const fin = lineas.findIndex(l => /^\];/.test(l));
  // Bloque vacío: comentario seguido de nada (renglón vacío, otro comentario o el final)
  const anterior = i - 1;
  if (anterior >= 0 && lineas[anterior].trim().startsWith('// ---') && !esEntrada(lineas[i] || '')) {
    lineas.splice(anterior, 1);
    if (lineas[anterior - 1] !== undefined && !lineas[anterior - 1].trim()) lineas.splice(anterior - 1, 1);
  }
  // La última entrada de la lista va sin coma
  const cierre = lineas.findIndex(l => /^\];/.test(l));
  let ultima = cierre - 1;
  while (ultima > 0 && !esEntrada(lineas[ultima])) ultima--;
  if (fin >= 0 && esEntrada(lineas[ultima])) lineas[ultima] = lineas[ultima].replace(/,\s*$/, '');
  return lineas.join('\n');
}

// Qué hay que hacer: { letras: [{ id, texto, nueva }], entradas: [canción],
// borrar: [id], iguales: [id], avisos: [texto] }. `archivo(id)` = texto de
// letras/<id>.txt o null. `eliminadas`: las canciones eliminadas desde la web
export function planificar({ canciones, indice, eliminadas, SONGS, archivo }) {
  const plan = { letras: [], entradas: [], borrar: [], iguales: [], avisos: [] };
  const enRepo = id => SONGS.some(s => s.id === id);
  const eliminada = id => !!(eliminadas && eliminadas[id]);
  plan.borrar = Object.keys(eliminadas || {}).filter(enRepo);
  for (const [id, c] of Object.entries(indice || {})) {
    if (enRepo(id) || eliminada(id)) continue;
    if (!/^[a-z]+_[a-z0-9-]+$/.test(id) || !c || typeof c.titulo !== 'string' || !c.titulo.trim()) { plan.avisos.push(`${id}: entrada del índice inválida, no se pasa`); continue; }
    plan.entradas.push({ id, num: Number.isInteger(c.num) ? c.num : 0, title: c.titulo.trim(), category: c.categoria });
  }
  for (const [id, c] of Object.entries(canciones || {})) {
    if (!c || typeof c.letra !== 'string' || !c.letra.trim() || eliminada(id)) continue;
    const nueva = plan.entradas.some(s => s.id === id);
    if (!nueva && !enRepo(id)) { plan.avisos.push(`${id}: tiene letra en la web pero no está en el índice; no se pasa`); continue; }
    const texto = canonica(c.letra);
    const actual = archivo(id);
    if (actual !== null && canonica(actual) === texto) { plan.iguales.push(id); continue; }
    plan.letras.push({ id, texto, nueva });
  }
  for (const s of plan.entradas) {
    if (!plan.letras.some(l => l.id === s.id)) {
      plan.letras.push({ id: s.id, texto: '{pendiente}\n', nueva: true });
      plan.avisos.push(`${s.id}: no tiene letra en la web; queda como pendiente`);
    }
  }
  return plan;
}

async function main() {
  const probar = process.argv.includes('--probar');
  const config = fs.readFileSync(path.join(raiz, 'firebase-config.js'), 'utf8');
  const base = config.match(/databaseURL:\s*"([^"]+)"/)[1];
  const leer = async ruta => {
    const r = await fetch(`${base}/${ruta}.json`);
    // Sin las reglas de database.rules.json pegadas en la consola, esa ruta no se puede leer
    if (r.status === 401) { console.log(`! ${ruta}: sin permiso de lectura. ¿Están pegadas en la consola las reglas de database.rules.json? Se sigue sin eso.`); return null; }
    if (!r.ok) throw new Error(`No se pudo leer ${ruta} (HTTP ${r.status})`);
    return r.json();
  };
  const [canciones, indice, eliminadas] = await Promise.all([leer('canciones'), leer('canciones_indice'), leer('eliminadas')]);
  const rutaSongs = path.join(raiz, 'songs.js');
  let textoSongs = fs.readFileSync(rutaSongs, 'utf8');
  const { SONGS, CATS } = leerSongs(textoSongs);
  const archivo = id => {
    try { return fs.readFileSync(path.join(raiz, 'letras', id + '.txt'), 'utf8'); } catch (e) { return null; }
  };
  const plan = planificar({ canciones, indice, eliminadas, SONGS, archivo });
  const hayAlgo = plan.letras.length || plan.entradas.length || plan.borrar.length;

  if (!hayAlgo) {
    console.log('No hay nada nuevo en la web para pasar al repo.');
  }
  for (const id of plan.borrar) {
    console.log(`- eliminada desde la web: ${id} (se saca de songs.js y se borra letras/${id}.txt)`);
    textoSongs = quitarDeSongs(textoSongs, id);
    if (!probar) { try { fs.unlinkSync(path.join(raiz, 'letras', id + '.txt')); } catch (e) {} }
  }
  for (const s of plan.entradas) {
    console.log(`+ canción nueva: ${s.id} — "${s.title}" (${s.category}${s.num ? ', n.º ' + s.num : ''})`);
    textoSongs = agregarASongs(textoSongs, s, CATS);
  }
  for (const l of plan.letras) {
    console.log(`${l.nueva ? '+' : '~'} letras/${l.id}.txt${l.nueva ? '' : ' (corregida desde la web)'}`);
    if (!probar) fs.writeFileSync(path.join(raiz, 'letras', l.id + '.txt'), l.texto);
  }
  if ((plan.entradas.length || plan.borrar.length) && !probar) {
    leerSongs(textoSongs);   // que siga siendo un songs.js válido antes de escribirlo
    fs.writeFileSync(rutaSongs, textoSongs);
  }
  if (plan.iguales.length) console.log(`= ya iguales al repo (se limpian solas de la web): ${plan.iguales.join(', ')}`);
  plan.avisos.forEach(a => console.log('! ' + a));
  if (probar) console.log('\n(--probar: no se escribió nada)');
  else if (hayAlgo) {
    console.log('\nListo. Ahora: node tests/letra.node.mjs y node tests/acordes.node.mjs, commit y push.');
    console.log('Cuando esté publicado, abrir el índice como admin con sesión: saca de la web lo que ya está en el repo.');
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(err => { console.error('Error: ' + err.message); process.exitCode = 1; });
}
