// Prueba de herramientas/pasar-web-al-repo.mjs en Node, con datos inventados
// (no lee la base ni escribe archivos):
//   node tests/pasar-al-repo.node.mjs      (Node 22+; ver tests/README.md)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { agregarASongs, quitarDeSongs, leerSongs, planificar, canonica } from '../herramientas/pasar-web-al-repo.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fallas = 0;
const check = (nombre, ok, extra = '') => { if (!ok) fallas++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra ? ' — ' + extra : ''}`); };

const textoSongs = fs.readFileSync(path.join(raiz, 'songs.js'), 'utf8');
const { SONGS, CATS } = leerSongs(textoSongs);
const archivo = id => { try { return fs.readFileSync(path.join(raiz, 'letras', id + '.txt'), 'utf8'); } catch (e) { return null; } };
const TOMA = archivo('ofert_toma');

// ── Qué hay que hacer ──
const plan = planificar({
  SONGS, archivo,
  indice: {
    'nav_noche-de-paz': { titulo: 'Noche de paz', categoria: 'navidad', num: 0 },
    'ent_nueva': { titulo: 'Entrada nueva', categoria: 'entrada', num: 7 },
    'ofert_toma': { titulo: 'Toma', categoria: 'ofertorio' },          // ya está en el repo: se ignora
    'mal id': { titulo: 'x', categoria: 'varias' }
  },
  canciones: {
    'nav_noche-de-paz': { letra: '[DO]Noche de paz  \r\n\r\n', por: 'Mateo', cuando: 1 },
    'ofert_toma': { letra: TOMA.replace('[LA]Toma,', '[RE]Toma,'), anterior: 'x' },   // corregida
    'com_alma-misionera': { letra: archivo('com_alma-misionera') },                  // igual al repo
    'var_huerfana': { letra: 'algo' }
  }
});
check('canciones nuevas: las del índice que no están en el repo', plan.entradas.map(s => s.id).join(',') === 'nav_noche-de-paz,ent_nueva', JSON.stringify(plan.entradas));
check('letras: la nueva en el formato del repo y la corregida', JSON.stringify(plan.letras.map(l => [l.id, l.nueva])) === '[["nav_noche-de-paz",true],["ofert_toma",false],["ent_nueva",true]]' &&
  plan.letras[0].texto === '[DO]Noche de paz\n' && plan.letras[1].texto.startsWith('[RE]Toma,'), JSON.stringify(plan.letras.map(l => l.id)));
check('una canción nueva sin letra queda pendiente', plan.letras.find(l => l.id === 'ent_nueva').texto === '{pendiente}\n');
check('igual al repo: no se escribe, se informa', plan.iguales.join() === 'com_alma-misionera');
check('avisa lo que no puede pasar', plan.avisos.some(a => a.startsWith('mal id')) && plan.avisos.some(a => a.startsWith('var_huerfana')) && plan.avisos.some(a => a.startsWith('ent_nueva')), plan.avisos.join(' | '));
check('canonica: LF y sin espacios al final', canonica('a  \r\nb\r\n\r\n') === 'a\nb\n');

// ── songs.js ──
{
  let t = agregarASongs(textoSongs, { id: 'ent_nueva', num: 7, title: 'Entrada "nueva"', category: 'entrada' }, CATS);
  t = agregarASongs(t, { id: 'nav_noche-de-paz', num: 0, title: 'Noche de paz', category: 'navidad' }, CATS);
  t = agregarASongs(t, { id: 'nav_otra', num: 2, title: 'Otra', category: 'navidad' }, CATS);
  const s = leerSongs(t).SONGS;
  check('songs.js sigue siendo válido, con las 3 nuevas', s.length === SONGS.length + 3);
  const ultimaEntrada = SONGS.filter(x => x.category === 'entrada').pop().id;
  check('la nueva va después de la última de su momento', s.findIndex(x => x.id === 'ent_nueva') === s.findIndex(x => x.id === ultimaEntrada) + 1);
  check('momento sin canciones: bloque nuevo al final, con su comentario', /\n\n  \/\/ --- NAVIDAD \(nav_\) ---\n  \{ "id": "nav_noche-de-paz"/.test(t) && s[s.length - 1].id === 'nav_otra');
  check('título con comillas, escapado', s.find(x => x.id === 'ent_nueva').title === 'Entrada "nueva"');
  check('la última de la lista sin coma, las demás con', /"category": "navidad" \}\n\];/.test(t) && /"title": "Noche de paz", "category": "navidad" \},\n/.test(t));
  check('el resto del archivo no cambia', t.replace(/\n.*"(ent_nueva|nav_noche-de-paz|nav_otra)".*/g, '').replace(/\n\n  \/\/ --- NAVIDAD \(nav_\) ---/, '').replace(/("category": "varias" \}),\n\];/, '$1\n];') === textoSongs);
}

// ── Eliminadas desde la web (D26) ──
{
  const p = planificar({ SONGS, archivo,
    eliminadas: { ofert_toma: { titulo: 'Toma' }, 'nav_x': { titulo: 'X' } },
    indice: { 'nav_x': { titulo: 'X', categoria: 'navidad' } },
    canciones: { ofert_toma: { letra: '[RE]otra\n' }, 'nav_x': { letra: 'x\n' } } });
  check('eliminada del repo: se borra; eliminada de la web: no se pasa', p.borrar.join() === 'ofert_toma' && !p.entradas.length && !p.letras.length, JSON.stringify(p));
  const ultima = SONGS[SONGS.length - 1].id;
  let t = quitarDeSongs(textoSongs, 'ofert_toma');
  t = quitarDeSongs(t, ultima);
  const s = leerSongs(t).SONGS;
  check('quitarDeSongs: songs.js válido, sin las dos', s.length === SONGS.length - 2 && !s.some(x => x.id === 'ofert_toma' || x.id === ultima));
  check('quitarDeSongs: la nueva última queda sin coma', /"category": "varias" \}\n\];/.test(t));
  let b = agregarASongs(textoSongs, { id: 'nav_a', num: 0, title: 'A', category: 'navidad' }, CATS);
  b = quitarDeSongs(b, 'nav_a');
  check('quitarDeSongs: un bloque que queda vacío se va con su comentario', b === textoSongs, JSON.stringify(b.slice(-200)));
}

console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTODO OK');
process.exitCode = fallas ? 1 : 0;
