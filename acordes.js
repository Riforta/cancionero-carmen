// Acordes del cancionero (AGENTS.md D18): escala, transposición, diagramas
// de guitarra y su dibujo en SVG. Funciones puras, sin tocar la página: las
// usa cancion.js y se prueban en Node con tests/acordes.node.mjs.
// Solo notación latina (DO, RE, MI…); ver AGENTS.md §3 y D9.

const SCALE = ['DO', 'DO#', 'RE', 'RE#', 'MI', 'FA', 'FA#', 'SOL', 'SOL#', 'LA', 'LA#', 'SI'];

// Bemoles → sostenidos (las letras usan notación latina; ver AGENTS.md §3)
const NOTE_MAP = {
  'REb': 'DO#', 'MIb': 'RE#', 'SOLb': 'FA#', 'LAb': 'SOL#', 'SIb': 'LA#'
};

function transposeNote(noteText, semitones) {
  if (semitones === 0) return noteText;
  const regex = /^(DO#|RE#|FA#|SOL#|LA#|DO|RE|MI|FA|SOL|LA|SI)(b?)(.*)$/;
  const parts = noteText.match(regex);
  if (!parts) return noteText;
  let baseNote = parts[1] + parts[2];
  const suffix = parts[3];
  if (NOTE_MAP[baseNote]) baseNote = NOTE_MAP[baseNote];
  let index = SCALE.indexOf(baseNote);
  if (index === -1) return noteText;
  let newIndex = (index + semitones) % 12;
  if (newIndex < 0) newIndex += 12;
  return SCALE[newIndex] + suffix;
}

// Transpone también el bajo de los acordes con barra (RE/FA#)
function transposeChord(chordText, semitones) {
  return chordText.split('/').map(p => transposeNote(p, semitones)).join('/');
}

// Diagramas: cuerdas de la 6.ª (grave) a la 1.ª; 'x' = no se toca, 0 = al aire
const CHORD_DICTIONARY = {
  /* Mayores */
  'DO':   ['x', 3, 2, 0, 1, 0],   'DO#':  ['x', 4, 3, 1, 2, 1],
  'RE':   ['x', 'x', 0, 2, 3, 2], 'RE#':  ['x', 'x', 1, 3, 4, 3],
  'MI':   [0, 2, 2, 1, 0, 0],     'FA':   [1, 3, 3, 2, 1, 1],
  'FA#':  [2, 4, 4, 3, 2, 2],     'SOL':  [3, 2, 0, 0, 0, 3],
  'SOL#': [4, 6, 6, 5, 4, 4],     'LA':   ['x', 0, 2, 2, 2, 0],
  'LA#':  ['x', 1, 3, 3, 3, 1],   'SI':   ['x', 2, 4, 4, 4, 2],
  /* Menores */
  'DOm':  ['x', 3, 5, 5, 4, 3],   'DO#m': ['x', 4, 6, 6, 5, 4],
  'REm':  ['x', 'x', 0, 2, 3, 1], 'RE#m': ['x', 'x', 1, 3, 4, 2],
  'MIm':  [0, 2, 2, 0, 0, 0],     'FAm':  [1, 3, 3, 1, 1, 1],
  'FA#m': [2, 4, 4, 2, 2, 2],     'SOLm': [3, 5, 5, 3, 3, 3],
  'SOL#m':[4, 6, 6, 4, 4, 4],     'LAm':  ['x', 0, 2, 2, 1, 0],
  'LA#m': ['x', 1, 3, 3, 2, 1],   'SIm':  ['x', 2, 4, 4, 3, 2],
  /* Séptimas dominantes */
  'DO7':  ['x', 3, 2, 3, 1, 0],   'DO#7': ['x', 4, 6, 4, 6, 4],
  'RE7':  ['x', 'x', 0, 2, 1, 2], 'RE#7': ['x', 'x', 1, 3, 2, 3],
  'MI7':  [0, 2, 0, 1, 0, 0],     'FA7':  [1, 3, 1, 2, 1, 1],
  'FA#7': [2, 4, 2, 3, 2, 2],     'SOL7': [3, 2, 0, 0, 0, 1],
  'SOL#7':[4, 6, 4, 5, 4, 4],     'LA7':  ['x', 0, 2, 0, 2, 0],
  'LA#7': ['x', 1, 3, 1, 3, 1],   'SI7':  ['x', 2, 1, 2, 0, 2],
  /* Menores con séptima */
  'DOm7': ['x', 3, 5, 3, 4, 3],   'DO#m7':['x', 4, 6, 4, 5, 4],
  'REm7': ['x', 'x', 0, 2, 1, 1], 'RE#m7':['x', 'x', 1, 3, 2, 2],
  'MIm7': [0, 2, 0, 0, 0, 0],     'FAm7': [1, 3, 1, 1, 1, 1],
  'FA#m7':[2, 4, 2, 2, 2, 2],     'SOLm7':[3, 5, 3, 3, 3, 3],
  'SOL#m7':[4, 6, 4, 4, 4, 4],    'LAm7': ['x', 0, 2, 0, 1, 0],
  'LA#m7':['x', 1, 3, 1, 2, 1],   'SIm7': ['x', 2, 4, 2, 3, 2],
  /* Mayores con séptima mayor */
  'DOmaj7': ['x', 3, 2, 0, 0, 0],   'DO#maj7':['x', 4, 6, 5, 6, 4],
  'REmaj7': ['x', 'x', 0, 2, 2, 2], 'RE#maj7':['x', 6, 8, 7, 8, 6],
  'MImaj7': [0, 2, 1, 1, 0, 0],     'FAmaj7': ['x', 'x', 3, 2, 1, 0],
  'FA#maj7':[2, 4, 3, 3, 2, 2],     'SOLmaj7':[3, 2, 0, 0, 0, 2],
  'SOL#maj7':[4, 6, 5, 5, 4, 4],    'LAmaj7': ['x', 0, 2, 1, 2, 0],
  'LA#maj7':['x', 1, 3, 2, 3, 1],   'SImaj7': ['x', 2, 4, 3, 4, 2],
  /* Suspendidas */
  'DOsus4': ['x', 3, 3, 0, 1, 1],   'DO#sus4':['x', 4, 6, 6, 7, 4],
  'REsus4': ['x', 'x', 0, 2, 3, 3], 'RE#sus4':['x', 6, 8, 8, 9, 6],
  'MIsus4': [0, 2, 2, 2, 0, 0],     'FAsus4': [1, 3, 3, 3, 1, 1],
  'FA#sus4':[2, 4, 4, 4, 2, 2],     'SOLsus4':[3, 3, 0, 0, 1, 3],
  'SOL#sus4':[4, 6, 6, 6, 4, 4],    'LAsus4': ['x', 0, 2, 2, 3, 0],
  'LA#sus4':['x', 1, 3, 3, 4, 1],   'SIsus4': ['x', 2, 4, 4, 5, 2],
  /* Novenas agregadas */
  'DOadd9': ['x', 3, 2, 0, 3, 0], 'REadd9': ['x', 'x', 0, 2, 3, 0],
  'MIadd9': [0, 2, 4, 1, 0, 0],   'FAadd9': ['x', 'x', 3, 2, 1, 3],
  'SOLadd9':[3, 2, 0, 0, 0, 5],   'LAadd9': ['x', 0, 2, 4, 2, 0]
};

// Normaliza el nombre para buscar el diagrama:
// bemoles → sostenidos, RE4 → REsus4, DO9 → DOadd9, RE/FA# → RE
function chordLookup(name) {
  let n = name.trim().split('/')[0];
  const flat = n.match(/^(DO|RE|MI|FA|SOL|LA|SI)b/);
  if (flat && NOTE_MAP[flat[0]]) n = NOTE_MAP[flat[0]] + n.slice(flat[0].length);
  n = n.replace(/^((?:DO|RE|FA|SOL|LA)#?|MI|SI)4$/, '$1sus4');
  n = n.replace(/^((?:DO|RE|FA|SOL|LA)#?|MI|SI)9$/, '$1add9');
  if (CHORD_DICTIONARY[n]) return CHORD_DICTIONARY[n];
  // add9 sin voicing propio → diagrama del acorde mayor (compatible)
  const add9 = n.match(/^(.+)add9$/);
  if (add9) return CHORD_DICTIONARY[add9[1]];
  return undefined;
}

// SVG del diagrama (viewBox 0 0 100 120). Los colores también van por clase
// (cd-*) para que el modo oscuro los cambie (tema.css)
function drawChordSVG(positions) {
  if (!positions) return '';
  let frets = positions.filter(p => typeof p === 'number' && p > 0);
  let minFret = frets.length ? Math.min(...frets) : 1;
  let startFret = minFret > 3 ? minFret : 1;
  let svgHtml = `<line class="cd-cejuela" x1="20" y1="15" x2="80" y2="15" stroke="#3E2415" stroke-width="${startFret === 1 ? 4 : 1}" />`;
  for (const y of [40, 65, 90, 115]) {
    svgHtml += `<line class="cd-traste" x1="20" y1="${y}" x2="80" y2="${y}" stroke="#ccc" stroke-width="1" />`;
  }
  for (let i = 0; i < 6; i++) {
    let x = 20 + i * 12;
    svgHtml += `<line class="cd-cuerda" x1="${x}" y1="15" x2="${x}" y2="115" stroke="#aaa" stroke-width="1" />`;
  }
  if (startFret > 1) {
    svgHtml += `<text class="cd-fr" x="5" y="32" font-family="system-ui" font-size="10" fill="#7A5638">${startFret}fr</text>`;
  }
  positions.forEach((fret, stringIndex) => {
    let x = 20 + stringIndex * 12;
    if (fret === 'x' || fret === 'X') {
      svgHtml += `<text class="cd-muda" x="${x-3}" y="10" font-family="system-ui" font-size="9" fill="#bbb" font-weight="bold">×</text>`;
    } else if (fret === 0) {
      svgHtml += `<circle cx="${x}" cy="8" r="3" fill="none" stroke="#B8862E" stroke-width="1.5" />`;
    } else if (typeof fret === 'number') {
      let relativeFret = fret - startFret + 1;
      let y = 15 + (relativeFret * 25) - 12.5;
      svgHtml += `<circle cx="${x}" cy="${y}" r="4.5" fill="#B8862E" />`;
    }
  });
  return svgHtml;
}

// Para Node (tests/acordes.node.mjs); en el navegador no hace nada
if (typeof module !== 'undefined') {
  module.exports = { SCALE, NOTE_MAP, transposeNote, transposeChord, CHORD_DICTIONARY, chordLookup, drawChordSVG };
}
