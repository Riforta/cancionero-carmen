// Prueba de acordes.js en Node puro (sin navegador):
//   node tests/acordes.node.mjs      (Node 22+; ver tests/README.md)
// Transposición, bemoles, acordes con bajo, búsqueda de diagramas y que todos
// los acordes de letras/ tengan diagrama.
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { transposeChord, chordLookup, drawChordSVG, CHORD_DICTIONARY } = require(path.join(raiz, 'acordes.js'));

let fallas = 0;
const check = (nombre, ok, extra = '') => { if (!ok) fallas++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra ? ' — ' + extra : ''}`); };

// Transposición
for (const [acorde, semitonos, esperado] of [
  ['DO', 2, 'RE'], ['SI', 1, 'DO'], ['DO', -1, 'SI'], ['LAm', -2, 'SOLm'],
  ['FA#m7', 1, 'SOLm7'], ['SIb', 2, 'DO'], ['MIb', 0, 'MIb'], ['RE/FA#', 2, 'MI/SOL#'],
  ['SOLmaj7', 12, 'SOLmaj7'], ['REsus4', 5, 'SOLsus4'], ['...', 3, '...'], ['Am', 2, 'Am']
]) {
  const r = transposeChord(acorde, semitonos);
  check(`${acorde} ${semitonos >= 0 ? '+' : ''}${semitonos} = ${esperado}`, r === esperado, r);
}

// Diagramas
check('SIb usa el diagrama de LA#', chordLookup('SIb') === CHORD_DICTIONARY['LA#']);
check('RE4 → REsus4', chordLookup('RE4') === CHORD_DICTIONARY['REsus4']);
check('DO9 → DOadd9', chordLookup('DO9') === CHORD_DICTIONARY['DOadd9']);
check('SIadd9 sin voicing → SI', chordLookup('SIadd9') === CHORD_DICTIONARY['SI']);
check('RE/FA# → RE', chordLookup('RE/FA#') === CHORD_DICTIONARY['RE']);
check('acorde inexistente → undefined', chordLookup('XYZ') === undefined);

// SVG
const svg = drawChordSVG(CHORD_DICTIONARY['DO']);
check('SVG: cejuela, 4 trastes y 6 cuerdas', (svg.match(/cd-cejuela/g) || []).length === 1 && (svg.match(/cd-traste/g) || []).length === 4 && (svg.match(/cd-cuerda/g) || []).length === 6);
check('SVG: posición alta muestra "fr"', drawChordSVG(CHORD_DICTIONARY['SOL#7']).includes('4fr'));

// Todos los acordes de las letras, en cualquier tono, tienen diagrama
const dir = path.join(raiz, 'letras');
const sinDiagrama = new Set();
let total = 0;
for (const archivo of fs.readdirSync(dir).filter(f => f.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(dir, archivo), 'utf8');
  for (const [, acorde] of html.matchAll(/<c>([^<]*)<\/c>/g)) {
    const a = acorde.trim();
    if (!a || a === '...') continue;
    total++;
    for (let t = -11; t <= 11; t++) {
      if (!chordLookup(transposeChord(a, t))) sinDiagrama.add(`${a} (${t >= 0 ? '+' : ''}${t}) en ${archivo}`);
    }
  }
}
check(`los ${total} acordes de letras/ tienen diagrama en los 23 tonos`, sinDiagrama.size === 0, [...sinDiagrama].slice(0, 5).join(', '));

console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTODO OK');
process.exitCode = fallas ? 1 : 0;
