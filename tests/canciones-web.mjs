// Canciones cargadas desde la web y pestaña "Texto" del editor (AGENTS.md
// D24): "Nueva canción" en el índice, el editor que abre solo en "Texto",
// "Pegar con acordes arriba", la canción nueva en la lista, la misa, la
// búsqueda y banco, y las reglas de la base.
import fs from 'fs';
import { connect, check, done, wait, OUT, FAKE_FIREBASE } from './cdp.mjs';
const c = await connect();
const ADMIN = { email: 'test@gmail.com', displayName: 'Admin Prueba' };
const ID = 'nav_noche-de-paz';
const ENTRADA = { titulo: 'Noche de paz', categoria: 'navidad', num: 0 };
const LETRA = '[DO]Noche de paz, [SOL7]noche de a[DO]mor,\ntodo duerme en derredor.\n';
const es = async (p, expr) => (await p.ev(expr)) === true;
const foto = async (p, nombre) => { const r = await p.s('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${OUT}/${nombre}.png`, Buffer.from(r.result.data, 'base64')); };
const limpiar = p => p.ev(`['canciones_indice', 'cancion_${ID}', 'misa_cache', 'misa_borrador'].forEach(k => localStorage.removeItem(k))`);

// ── 1. Nueva canción desde el índice ──
{
  const p = await c.newPage({ fake: FAKE_FIREBASE({ 'admins/test@gmail,com': true, misa_actual: [] }, ADMIN), width: 390, height: 800 });
  await p.go('/index.html?admin=true&cat=navidad', 2500);
  if (!(await es(p, 'Array.isArray(window.__writes)'))) throw new Error('Firebase falso no cargado: aborto');
  check('admin: "Nueva canción" al final de la lista', await es(p, `!document.getElementById('nueva').hidden && document.getElementById('nuevaForm').hidden`));
  await p.ev(`nuevaAbrir.click()`);
  check('el formulario arranca en la categoría elegida', (await p.ev('nuevaCategoria.value')) === 'navidad');
  await p.ev(`nuevaTitulo.value = 'toma'; nuevaCategoria.value = 'ofertorio'; nuevaForm.requestSubmit()`); await wait(200);
  check('título que ya existe: avisa y no crea', (await p.ev('nuevaAviso.textContent')).startsWith('Ya existe «Toma»') && (await p.ev('__writes.length')) === 0, await p.ev('nuevaAviso.textContent'));
  await foto(p, 'web-nueva');
  await p.ev(`nuevaTitulo.value = '  Noche   de paz '; nuevaCategoria.value = 'navidad'; nuevaNum.value = ''; nuevaForm.requestSubmit()`); await wait(1200);
  // (Lo que escribe se mira abajo: al navegar, el Firebase falso arranca vacío)
  const url = await p.ev('location.pathname + location.search');
  check('va a la canción nueva, a abrir el editor de texto', url.startsWith(`/cancion.html?id=${ID}&editar=texto`), url);
  await limpiar(p);
  await p.close();
}
{ // Lo que escribe "Crear" (sin navegar: se frena la salida)
  const p = await c.newPage({ fake: FAKE_FIREBASE({ 'admins/test@gmail,com': true, misa_actual: [] }, ADMIN), width: 390, height: 800 });
  await p.go('/index.html?admin=true&cat=navidad', 2500);
  await p.ev(`window.linkCon = () => '#creada'`);   // que no navegue: se mira lo escrito
  await p.ev(`nuevaAbrir.click(); nuevaTitulo.value = 'Noche de paz'; nuevaCategoria.value = 'navidad'; nuevaForm.requestSubmit()`); await wait(500);
  const w = JSON.parse(await p.ev('JSON.stringify(__writes)'));
  check('la lista guardada en el celular ya la tiene (abre sin esperar a la base)', JSON.stringify(JSON.parse(await p.ev(`localStorage.getItem('canciones_indice')`) || '{}')[ID]) === JSON.stringify(ENTRADA));
  check('Crear: índice y letra pendiente en una sola operación', w.length === 2 && w[0][0] === 'update' && w[0][1] === `canciones_indice/${ID}` &&
    JSON.stringify(w[0][2]) === JSON.stringify(ENTRADA) && w[1][1] === `canciones/${ID}` && w[1][2].letra === '{pendiente}\n' && typeof w[1][2].cuando === 'number', JSON.stringify(w));
  check('sin errores', p.errors.length === 0, p.errors.join(' | '));
  await limpiar(p);
  await p.close();
}

// ── 2. La canción nueva abre en el editor, pestaña "Texto" ──
const DB_WEB = { 'admins/test@gmail,com': true, [`canciones_indice/${ID}`]: ENTRADA,
  [`canciones/${ID}`]: { letra: '{pendiente}\n', por: 'Admin Prueba', cuando: Date.now() } };
{
  const p = await c.newPage({ fake: FAKE_FIREBASE(DB_WEB, ADMIN), dialogAccept: true, width: 390, height: 800 });
  await p.go('/index.html?admin=true', 500);   // como al venir del índice: la lista queda en el celular
  for (let t = 0; t < 60 && !(await p.ev(`(localStorage.getItem('canciones_indice') || '').includes('${ID}')`)); t++) await wait(100);
  await p.go(`/cancion.html?id=${ID}&admin=true&cat=navidad&editar=texto`, 2500);
  if (!(await es(p, 'Array.isArray(window.__writes)'))) throw new Error('Firebase falso no cargado: aborto');
  check('título de la canción de la web', (await p.ev(`document.getElementById('song-title').textContent`)) === 'Noche de paz');
  check('no pide un archivo que no existe', !p.requests.some(u => u.includes(`letras/${ID}`)));
  check('el editor abre solo, en "Texto"', await es(p, `!document.getElementById('editor-barra').hidden && !document.getElementById('editorTexto').hidden && ebModo.textContent === 'Acordes'`));
  check('sin "editar=texto" en la dirección (no se abre otra vez al recargar)', !(await p.ev('location.search')).includes('editar'));
  // Pegar con acordes arriba
  await p.ev(`etPegar.click(); etFuente.value = ${JSON.stringify('Intro: C G\n\nC            G7        C\nNoche de paz, noche de amor,\nla la la\n\n  F\nTodo duerme')}; etConvertir.click()`); await wait(400);
  const area = await p.ev('etArea.value');
  check('Pegar con acordes arriba: convierte a corchetes y notación latina', area === 'Intro: [DO] [SOL]\n\n[DO]Noche de paz, [SOL7]noche de [DO]amor,\nla la la\n\nTo[FA]do duerme\n', JSON.stringify(area));
  check('lo dudoso queda marcado', (await p.ev('etDudas.textContent')).includes('¿acordes o letra?'), await p.ev('etDudas.textContent'));
  check('vista previa: la letra con sus acordes', (await p.ev(`letraBox.querySelectorAll('c').length`)) === 6 && (await es(p, `letraBox.classList.contains('solo-vista')`)));
  await foto(p, 'web-texto');
  // Escribir a mano: avisa la notación americana y la corrige al pasar a "Acordes"
  await p.ev(`etArea.value += '[Am]Fin'; etArea.dispatchEvent(new Event('input'))`); await wait(400);
  check('escrito a mano: avisa que «Am» queda LAm', (await p.ev('etDudas.textContent')).includes('«Am» queda LAm'));
  await p.ev('ebModo.click()'); await wait(200);
  check('pasar a "Acordes": los nombres en notación latina y se pueden tocar', (await p.ev(`[...letraBox.querySelectorAll('c')].map(c => c.dataset.original).join(' ')`)).endsWith('LAm') && (await es(p, `document.getElementById('editorTexto').hidden`)));
  await p.ev(`letraBox.querySelector('c').click()`);
  check('en "Acordes" se elige un acorde', (await p.ev(`letraBox.querySelector('c.sel')?.textContent`)) === 'DO');
  await p.ev('ebListo.click()');
  // Guardar
  await p.ev('ebGuardar.click()'); await wait(300);
  const w = JSON.parse(await p.ev('JSON.stringify(__writes)'));
  check('Guardar: la letra cargada, sin guardar la pendiente para deshacer', w.length === 1 && w[0][1] === `canciones/${ID}` && w[0][2].letra.startsWith('Intro: [DO] [SOL]') && w[0][2].letra.endsWith('[LAm]Fin\n') && !('anterior' in w[0][2]), JSON.stringify(w).slice(0, 300));
  check('"Cargada por …", sin "Volver a la versión original"', (await p.ev('correccionTexto.textContent')).startsWith('Cargada por Admin Prueba') && (await es(p, 'correccionOriginal.hidden')));
  check('sin errores', p.errors.length === 0, p.errors.join(' | '));
  await limpiar(p);
  await p.close();
}
{ // Corregir el texto de una canción del repo
  const p = await c.newPage({ fake: FAKE_FIREBASE({ 'admins/test@gmail,com': true }, ADMIN), dialogAccept: true, width: 390, height: 800 });
  await p.go('/cancion.html?id=ofert_toma&admin=true', 2500);
  await p.ev('editarAcordes.click()');
  check('canción del repo: el editor abre en "Acordes"', await es(p, `document.getElementById('editorTexto').hidden && ebModo.textContent === 'Texto'`));
  await p.ev('ebModo.click()');
  await p.ev(`etArea.value = etArea.value.replace('Toma, que tu', 'Tómame, que tu'); etArea.dispatchEvent(new Event('input'))`); await wait(400);
  check('vista previa en vivo', (await p.ev(`letraBox.querySelector('.renglon').textContent`)).includes('Tómame'));
  await p.ev('ebGuardar.click()'); await wait(300);
  const w = JSON.parse(await p.ev('JSON.stringify(__writes)'));
  check('Guardar: el texto corregido', w.length === 1 && w[0][2].letra.startsWith('[LA]Tómame, que tu [DO#m]Cuerpo'), JSON.stringify(w).slice(0, 200));
  check('sin errores', p.errors.length === 0, p.errors.join(' | '));
  await p.ev(`localStorage.removeItem('cancion_ofert_toma')`);
  await p.close();
}

// ── 3. Músicos: lista, misa, búsqueda y título escapado ──
{
  const db = { misa_actual: ['ent_bendecire', ID], [`canciones_indice/${ID}`]: ENTRADA, [`canciones/${ID}`]: { letra: LETRA, por: 'Mateo', cuando: Date.now() },
    'canciones_indice/var_x': { titulo: '<img src=x onerror="window.__xss=1">', categoria: 'varias', num: 0 }, 'canciones_indice/ent_bendecire': { titulo: 'Pisada', categoria: 'entrada' } };
  const p = await c.newPage({ fake: FAKE_FIREBASE(db), rest: { [`canciones/${ID}`]: db[`canciones/${ID}`], [`canciones/${ID}/letra`]: LETRA }, width: 390, height: 800 });
  await p.go('/index.html', 2500);
  check('Misa de Hoy con la canción nueva', (await p.ev(`[...document.querySelectorAll('.song-name')].map(e => e.textContent).join('|')`)) === 'Bendeciré|Noche de paz');
  check('aparece la categoría Navidad, con 1', (await p.ev(`document.querySelector('.cat-chip[data-cat="navidad"] .chip-count')?.textContent`)) === '1');
  check('una canción del repo no se pisa desde la web', (await p.ev(`SONGS.find(s => s.id === 'ent_bendecire').title`)) === 'Bendeciré');
  check('título de la web escapado', await es(p, `!document.querySelector('.song-name img') && window.__xss === undefined`));
  await wait(500);
  check('la letra queda en el celular para abrirla sin conexión', JSON.parse(await p.ev(`localStorage.getItem('cancion_${ID}')`))?.letra === LETRA);
  await p.ev(`{ const i = document.getElementById('si'); i.value = 'duerme en derredor'; i.dispatchEvent(new Event('input')); }`); await wait(1500);
  check('búsqueda por letra encuentra la canción nueva', (await p.ev(`document.querySelector('.song-snippet')?.textContent`)) === '«todo duerme en derredor.»', await p.ev(`document.querySelector('.song-snippet')?.textContent`));
  await p.go(`/cancion.html?id=${ID}&cat=misa`, 2500);
  check('canción nueva: letra, "Cargada por" y anterior / siguiente', (await p.ev(`letraBox.querySelectorAll('c').length`)) === 3 &&
    (await p.ev('correccionTexto.textContent')).startsWith('Cargada por Mateo') && (await p.ev(`misaPrev.querySelector('.mn-title').textContent`)) === 'Bendeciré');
  check('sin errores', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}
{ // Sin conexión: la lista y la letra guardadas en el celular
  const p = await c.newPage({ blockFirebase: true, width: 390, height: 800 });
  await p.go(`/cancion.html?id=${ID}`, 2000);
  check('sin Firebase: la canción nueva abre con la copia', (await p.ev(`document.getElementById('song-title').textContent`)) === 'Noche de paz' && (await p.ev(`letraBox.querySelectorAll('c').length`)) === 3);
  await limpiar(p);
  await p.ev(`localStorage.removeItem('cancion_${ID}')`);
  await p.close();
}

// ── 4. Banco: todo por REST ──
{
  const p = await c.newPage({ rest: { misa_actual: [ID], canciones_indice: { [ID]: ENTRADA }, [`canciones/${ID}/letra`]: LETRA }, width: 390, height: 800 });
  await p.go('/index.html?modo=banco', 2500);
  check('banco: la canción nueva en la misa', (await p.ev(`[...document.querySelectorAll('.song-name')].map(e => e.textContent).join('|')`)) === 'Noche de paz');
  await wait(300);
  check('banco: su letra queda en el celular', (await p.ev(`localStorage.getItem('cancion_${ID}')`)) === JSON.stringify(LETRA));
  await p.go(`/cancion.html?id=${ID}&modo=banco&cat=misa`, 2500);
  check('banco: se lee la letra, sin el SDK', (await p.ev(`letraBox.querySelector('.renglon').innerText`)) === 'Noche de paz, noche de amor,' && !p.requests.some(u => u.includes('firebasejs')));
  check('sin errores', p.errors.length === 0, p.errors.join(' | '));
  await limpiar(p);
  await p.close();
}

// ── 5. Lo que ya pasó al repo se saca de la web (D25) ──
{
  const TOMA = fs.readFileSync(new URL('../letras/ofert_toma.txt', import.meta.url), 'utf8');
  const rest = {
    canciones: { ofert_toma: { letra: TOMA.replace(/\n/g, '\r\n') + '\n', por: 'Mateo', cuando: 1 }, 'com_alma-misionera': { letra: 'Otra letra\n' }, [ID]: { letra: LETRA } },
    canciones_indice: { ofert_toma: { titulo: 'Toma', categoria: 'ofertorio' }, [ID]: ENTRADA }
  };
  const p = await c.newPage({ fake: FAKE_FIREBASE({ 'admins/test@gmail,com': true, misa_actual: [] }, ADMIN), rest, width: 390, height: 800 });
  await p.go('/index.html?admin=true', 3000);
  if (!(await es(p, 'Array.isArray(window.__writes)'))) throw new Error('Firebase falso no cargado: aborto');
  const w = JSON.parse(await p.ev('JSON.stringify(__writes)'));
  check('admin: saca de la web lo que quedó igual al repo, en una operación', JSON.stringify(w.map(x => [x[0], x[1], x[2]]).sort()) ===
    JSON.stringify([['update', 'canciones/ofert_toma', null], ['update', 'canciones_indice/ofert_toma', null]]), JSON.stringify(w));
  check('deja la corrección distinta y la canción que sigue siendo de la web', !w.some(x => x[1].includes('alma-misionera') || x[1].includes(ID)));
  check('sin errores', p.errors.length === 0, p.errors.join(' | '));
  await limpiar(p);
  await p.close();
  const m = await c.newPage({ fake: FAKE_FIREBASE({ misa_actual: [] }), rest, width: 390, height: 800 });
  await m.go('/index.html', 3000);
  check('músicos: no limpia nada', (await m.ev('__writes.length')) === 0);
  await limpiar(m);
  await m.ev(`localStorage.removeItem('cancion_${ID}')`);
  await m.close();
}

// ── 6. Reglas de la base ──
{
  const r = JSON.parse(fs.readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8')).rules.canciones_indice;
  check('reglas: índice de la web con lectura pública y escritura de admins', r['.read'] === true && r.$id['.write'].includes("root.child('admins')"));
  check('reglas: título hasta 120, categoría de CATS, número 0–999, nada más',
    r.$id.titulo['.validate'].includes('<= 120') && r.$id.categoria['.validate'].includes('navidad') && !r.$id.categoria['.validate'].includes('misa') &&
    r.$id.num['.validate'].includes('<= 999') && r.$id.$otro['.validate'] === false);
}
done(); c.close();
