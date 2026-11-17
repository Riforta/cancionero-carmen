// Prueba de letra.js en Node puro (sin navegador):
//   node tests/letra.node.mjs      (Node 22+; ver tests/README.md)
// El formato de las letras: lectura, escritura, búsqueda, HTML (escapado) y
// que todas las letras de letras/ se lean y se vuelvan a escribir iguales.
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const L = require(path.join(raiz, 'letra.js'));
const { CHORD_DICTIONARY } = require(path.join(raiz, 'acordes.js'));

let fallas = 0;
const check = (nombre, ok, extra = '') => { if (!ok) fallas++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra ? ' — ' + extra : ''}`); };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── Lectura ──
{
  const r = L.parsearLetra('[SOL]Toma, Señor, y re[MIm]cibe toda mi [DO]libertad,');
  check('renglón con acordes: tramos', igual(r, [{ tipo: 'letra', tramos: [
    { acorde: { nombre: 'SOL', opcional: false }, texto: 'Toma, Señor, y re' },
    { acorde: { nombre: 'MIm', opcional: false }, texto: 'cibe toda mi ' },
    { acorde: { nombre: 'DO', opcional: false }, texto: 'libertad,' }], estribillo: false }]), JSON.stringify(r));
}
{
  const r = L.parsearLetra('Tan sólo [DO]quieres')[0];
  check('texto antes del primer acorde: tramo sin acorde', r.tramos[0].acorde === null && r.tramos[0].texto === 'Tan sólo ');
}
check('acorde opcional [(MI)]', igual(L.parsearLetra('Él es [(MI)]todo')[0].tramos[1].acorde, { nombre: 'MI', opcional: true }));
check('acorde con bajo y séptima', igual(L.acordesDeLetra(L.parsearLetra('[RE/FA#]a [FA#m7]b [SOLmaj7]c')).map(a => a.nombre), ['RE/FA#', 'FA#m7', 'SOLmaj7']));
for (const [linea, tipo] of [
  ['Intro: [DO]   [FA]  [SOL7]', 'acordes'], ['[SOL]  [RE]  [MIm]', 'acordes'],
  ['([MIm]  [LAm]  [RE7]', 'acordes'], ['[LA] - [LA7] | [RE]', 'acordes'], ['[(MI)]', 'acordes'],
  ['[DO](bis)', 'letra'], ['Sin acordes', 'letra'], ['[DO]', 'acordes']
]) check(`"${linea}" es de tipo ${tipo}`, L.parsearLetra(linea)[0].tipo === tipo, L.parsearLetra(linea)[0].tipo);
{
  const r = L.parsearLetra('Uno\n\n{estribillo}\n[SOL]Dos\n\nTres\n{/estribillo}\n\nCuatro');
  check('estribillo: marca sus renglones (y el vacío de adentro)', igual(r.map(x => [x.tipo, x.estribillo]),
    [['letra', false], ['vacio', false], ['letra', true], ['vacio', true], ['letra', true], ['vacio', false], ['letra', false]]), JSON.stringify(r.map(x => [x.tipo, x.estribillo])));
}
check('{titulo: …}, {título: …} y {nota: …}', igual(L.parsearLetra('{titulo: A la tarde}\n{título: Amor}\n{nota: (Se repite)}').map(r => [r.tipo, r.texto]),
  [['titulo', 'A la tarde'], ['titulo', 'Amor'], ['nota', '(Se repite)']]));
check('{pendiente}', L.parsearLetra('{pendiente}')[0].tipo === 'pendiente');
check('llaves desconocidas quedan como texto', igual(L.parsearLetra('{coro}')[0].tramos, [{ acorde: null, texto: '{coro}' }]));
check('corchetes vacíos quedan como texto', L.parsearLetra('a [] b')[0].tramos[0].texto === 'a [] b');
check('sin renglones vacíos en las puntas, CRLF y espacios al final', igual(L.parsearLetra('\r\n\r\nUno  \r\n\r\n').map(r => r.tipo), ['letra']) && L.parsearLetra('Uno  \r\n')[0].tramos[0].texto === 'Uno');

// ── Escritura: lo inverso de la lectura ──
for (const t of [
  '[DO]Tú has [SOL]venido a la or[LAm]illa,[DO7]\n',
  'Intro: [DO]   [FA]\n\n{estribillo}\n[SOL]Señor,\n\nme has\n{/estribillo}\n\n{titulo: Amor}\n{nota: (bis)}\n[(MI)]a\n',
  '{pendiente}\n'
]) check(`leer y escribir: ${JSON.stringify(t.slice(0, 30))}`, L.escribirLetra(L.parsearLetra(t)) === t, JSON.stringify(L.escribirLetra(L.parsearLetra(t))));

// ── Búsqueda ──
check('lineasDeTexto: sin acordes ni renglones de solo acordes ni signos', igual(
  L.lineasDeTexto('Intro: [DO] [FA]\n[SOL]Toma,  Señor, y re[MIm]cibe\n\n- - -\n{titulo: Amor}\n{pendiente}'),
  ['Toma, Señor, y recibe', 'Amor']));

// ── Para armar renglones ──
{
  const c = L.colapsarEspacios('  Así     en  marcha  ', [2, 4, 9, 10, 14, 21]);
  check('colapsarEspacios: texto', c.texto === 'Así en marcha', JSON.stringify(c.texto));
  // "A"→0, "í"→2, hueco después de "Así"→3 (el espacio), "e"→4, "m"→7, espacio final→13
  check('colapsarEspacios: posiciones', igual(c.posiciones, [0, 2, 3, 4, 7, 13]), JSON.stringify(c.posiciones));
}
check('armarRenglon: acordes en orden y en la misma posición', L.armarRenglon('Amén, a mén.', [
  { nombre: 'FA#', opcional: false, pos: 0 }, { nombre: 'MIm', opcional: false, pos: 6 },
  { nombre: 'LA', opcional: false, pos: 7 }, { nombre: 'RE', opcional: false, pos: 8 }, { nombre: 'FA#', opcional: false, pos: 8 },
  { nombre: 'SI', opcional: true, pos: 99 }]) === '[FA#]Amén, [MIm]a[LA] [RE][FA#]mén.[(SI)]');

// ── HTML ──
{
  const h = L.htmlDeLetra(L.parsearLetra('[SOL]Toma, Señor, y re[MIm]cibe'));
  check('HTML: el acorde va con su sílaba y la palabra no se corta',
    h.includes('<span class="palabra"><span class="tramo"><c data-original="SOL" aria-hidden="true">SOL</c><span class="sil">Toma,</span></span></span> Señor, y ') &&
    h.includes('<span class="palabra">re<span class="tramo"><c data-original="MIm" aria-hidden="true">MIm</c><span class="sil">cibe</span></span></span>'), h);
}
{
  const h = L.htmlDeLetra(L.parsearLetra('mí,[DO7] tan cerca de mí,[SOL][SOL7]'));
  check('HTML: acorde después de la palabra y al final del renglón',
    h.includes('mí,<span class="tramo"><c data-original="DO7" aria-hidden="true">DO7</c><span class="sil"></span></span></span> tan') &&
    /mí,<span class="tramo"><c data-original="SOL"[^>]*>SOL<\/c><span class="sil"><\/span><\/span><span class="tramo"><c data-original="SOL7"/.test(h), h);
}
check('HTML: un acorde sobre un espacio va después de la palabra anterior', L.htmlDeLetra(L.parsearLetra('Toma  [SOL] Señor')).includes('Toma<span class="tramo"><c data-original="SOL"'));
check('HTML: un acorde antes de la primera palabra va con ella', L.htmlDeLetra(L.parsearLetra(' [SOL] Señor')).includes('<span class="palabra"><span class="tramo"><c data-original="SOL" aria-hidden="true">SOL</c><span class="sil">Señor</span>'));
check('HTML: opcional, renglón de solo acordes, estribillo, título, nota y vacío', (() => {
  const h = L.htmlDeLetra(L.parsearLetra('Intro: [DO] [(MI)]\n\n{estribillo}\nUno\n{/estribillo}\n{titulo: T}\n{nota: N}'));
  return h.includes('<div class="renglon solo-acordes" aria-hidden="true">Intro: <c data-original="DO" aria-hidden="true">DO</c> <c class="opcional" data-original="MI"') &&
    h.includes('<div class="renglon vacio"></div><div class="estribillo"><div class="renglon">Uno</div></div><h3 class="subtitulo">T</h3><div class="renglon aclaracion">N</div>');
})());
{
  const h = L.htmlDeLetra(L.parsearLetra('<img src=x onerror=alert(1)>[<b>"x"</b>]a\n{titulo: <script>}\n[DO" onclick="x]b'));
  check('HTML: todo escapado (letra, acordes, títulos)', !/<img|<b>|<script|" onclick/.test(h) && h.includes('&lt;img') && h.includes('data-original="DO&quot; onclick=&quot;x"'), h);
}

// ── Las letras de letras/ ──
const dir = path.join(raiz, 'letras');
const archivos = fs.readdirSync(dir).filter(f => f.endsWith('.txt'));
const songs = fs.readFileSync(path.join(raiz, 'songs.js'), 'utf8');
const ids = [...songs.matchAll(/"id":\s*"([^"]+)"/g)].map(m => m[1]);
check('cada canción de songs.js tiene su letras/<id>.txt', ids.every(id => archivos.includes(id + '.txt')), ids.filter(id => !archivos.includes(id + '.txt')).join(', '));
let distintas = [], conCorchetes = [], total = 0;
for (const f of archivos) {
  const t = fs.readFileSync(path.join(dir, f), 'utf8');
  if (L.escribirLetra(L.parsearLetra(t)) !== t) distintas.push(f);
  const r = L.parsearLetra(t);
  total += L.acordesDeLetra(r).length;
  // Un corchete o una llave suelta en la letra sería un acorde o una marca mal escrita
  if (r.some(x => (x.tramos || x.partes || []).some(p => /[\[\]{}]/.test(p.texto || '')))) conCorchetes.push(f);
}
check(`las ${archivos.length} letras se leen y se escriben iguales (LF, sin espacios al final)`, !distintas.length, distintas.join(', '));
check('ninguna letra tiene corchetes o llaves sueltos', !conCorchetes.length, conCorchetes.join(', '));
check(`hay acordes en las letras (${total})`, total > 5000);
check('el diccionario de acordes está cargado', Object.keys(CHORD_DICTIONARY).length > 50);

console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTODO OK');
process.exitCode = fallas ? 1 : 0;
