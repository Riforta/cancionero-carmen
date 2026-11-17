// Editor de acordes (editor.js) y corrección de la letra desde la web
// (Firebase canciones/<id>, AGENTS.md D23): el admin con sesión elige, corre,
// lleva, cambia, borra y agrega acordes, guarda, deshace y vuelve a la versión
// original; músicos ven la corrección (también sin conexión, por la copia);
// banco la lee por REST; reglas de la base.
// Ojo: en la página, `correccion` es la variable de cancion.js (los datos);
// el elemento se pide con getElementById.
import fs from 'fs';
import { connect, check, done, wait, OUT, FAKE_FIREBASE } from './cdp.mjs';
const c = await connect();
const ADMIN = { email: 'test@gmail.com', displayName: 'Admin Prueba' };
const ID = 'ofert_toma';
const ORIGINAL = fs.readFileSync(new URL(`../letras/${ID}.txt`, import.meta.url), 'utf8');
const L0 = '[LA]Toma, que tu [DO#m]Cuerpo sea mi cu[FA#m]erpo,';
const L1 = 'que tu [DO#m]Sangre sea mi san[FA#m]gre,';
const hoy = new Date();
const FECHA = `${hoy.getDate()}/${hoy.getMonth() + 1}`;
const CAJA = `document.getElementById('correccion')`;
const foto = async (p, nombre) => { const r = await p.s('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${OUT}/${nombre}.png`, Buffer.from(r.result.data, 'base64')); };
// Una expresión que tiene que dar true (un error en la página no cuenta como OK)
const es = async (p, expr) => (await p.ev(expr)) === true;

// Cada renglón de la letra, escrito de nuevo desde la página (acordes entre corchetes)
const LINEAS = `[...letraBox.querySelectorAll('.renglon, .subtitulo, .letra-pendiente')].map(div => {
  let s = '';
  const w = document.createTreeWalker(div, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (n.nodeType === 1) { if (n.tagName === 'C') s += '[' + (n.classList.contains('opcional') ? '(' + n.dataset.original + ')' : n.dataset.original) + ']'; }
    else if (!n.parentElement.closest('c')) s += n.data;
  }
  return s;
})`;
const lineas = p => p.ev(LINEAS);
const ESTADO = `(() => {
  const fila = ['ebNada', 'ebAcorde', 'ebSilaba', 'ebCampo'].find(id => !document.getElementById(id).hidden);
  return { abierta: !document.getElementById('editor-barra').hidden, fila, info: ebInfo.textContent, letra: ebInfo.querySelector('u')?.textContent,
    sel: [...letraBox.querySelectorAll('c.sel')].map(c => c.textContent).join(','), aviso: ebAviso.hidden ? '' : ebAviso.textContent,
    estado: ebEstado.textContent, salir: ebSalir.textContent, guardar: !ebGuardar.disabled };
})()`;
const estado = p => p.ev(ESTADO);

async function clic(p, x, y) {
  await p.s('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await p.s('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  await wait(150);
}
// Toca (con un clic de verdad, en su lugar en pantalla) la letra `i` de la
// primera aparición de `palabra` en el renglón `r`
async function tocarLetra(p, r, palabra, i = 0) {
  const pt = await p.ev(`(() => {
    const div = [...letraBox.querySelectorAll('.renglon, .subtitulo, .letra-pendiente')][${r}];
    div.scrollIntoView({ block: 'center' });
    const nodos = []; let todo = '';
    const w = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) { if (n.parentElement.closest('c')) continue; nodos.push([n, todo.length]); todo += n.data; }
    const pos = todo.indexOf(${JSON.stringify(palabra)}) + ${i};
    const [n, d] = nodos.find(([n, d]) => d <= pos && pos < d + n.data.length);
    const rg = document.createRange(); rg.setStart(n, pos - d); rg.setEnd(n, pos - d + 1);
    const b = rg.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  })()`);
  await clic(p, pt.x, pt.y);
}
const escribirNombre = (p, nombre) => p.ev(`{ ebNombre.value = ${JSON.stringify(nombre)}; ebNombre.dispatchEvent(new Event('input')); }`);
const escrituras = async p => JSON.parse(await p.ev('JSON.stringify(__writes)'));

// ── 1. Admin con sesión: editar, guardar, deshacer y volver al original ──
{
  const p = await c.newPage({ fake: FAKE_FIREBASE({ 'admins/test@gmail,com': true, [`tonos/${ID}`]: { transponer: 2, capo: 0 } }, ADMIN), dialogAccept: true, width: 390, height: 800 });
  await p.go(`/cancion.html?id=${ID}&admin=true`, 2500);
  if (!(await es(p, 'Array.isArray(window.__writes)'))) throw new Error('Firebase falso no cargado: aborto');
  await p.ev('document.fonts.ready.then(() => true)');
  check('admin: se ve el lápiz para editar', await es(p, '!editarAcordes.hidden'));
  check('admin: la letra en el tono del coro (LA + 2 = SI)', (await p.ev(`letraBox.querySelector('c').textContent`)) === 'SI');

  await p.ev('editarAcordes.click()');
  let e = await estado(p);
  check('editor: barra abierta, sin nada elegido, sin cambios', e.abierta && e.fila === 'ebNada' && e.estado === 'Sin cambios' && e.salir === 'Salir' && !e.guardar, JSON.stringify(e));
  check('editor: se edita en el tono original', (await p.ev(`letraBox.querySelector('c').textContent`)) === 'LA' && (await es(p, `letraBox.classList.contains('editando')`)));
  check('editor: el tono y "Acordes" quedan quietos', await es(p, `document.querySelector('.toolbar').inert && toggleChords.inert && editarAcordes.inert`));
  check('editor: la letra no se desplaza de costado', (await p.ev('letraBox.scrollWidth - letraBox.clientWidth')) <= 1);

  // Elegir un acorde y correrlo con ◀ ▶
  await p.ev(`letraBox.querySelector('c').click()`);
  e = await estado(p);
  check('tocar un acorde lo elige: ◀ ▶ Cambiar Borrar Listo', e.fila === 'ebAcorde' && e.sel === 'LA' && e.info === 'LA sobre Toma,' && e.letra === 'T', JSON.stringify(e));
  check('al principio del renglón, ◀ deshabilitado', await es(p, 'ebIzq.disabled && !ebDer.disabled'));
  await foto(p, 'editor-acorde');
  await p.ev('ebDer.click()');
  e = await estado(p);
  check('▶ lo corre una letra', (await lineas(p))[0] === 'T[LA]oma, que tu [DO#m]Cuerpo sea mi cu[FA#m]erpo,' && e.letra === 'o' && e.sel === 'LA', JSON.stringify((await lineas(p))[0]));
  check('el acorde sigue sobre su letra', await es(p, `(() => { const c = letraBox.querySelector('c.sel'), s = c.parentElement.lastElementChild; return Math.abs(c.getBoundingClientRect().left - s.getBoundingClientRect().left) < 0.5 && s.textContent === 'oma,'; })()`));
  await p.ev('ebIzq.click()');
  check('◀ lo vuelve', (await lineas(p))[0] === L0);

  // Tocar una letra de otro renglón lo lleva ahí
  await tocarLetra(p, 1, 'Sangre', 2);
  let ls = await lineas(p);
  e = await estado(p);
  check('tocar otra letra lleva el acorde ahí (otro renglón)', ls[0] === 'Toma, que tu [DO#m]Cuerpo sea mi cu[FA#m]erpo,' && ls[1] === 'que tu [DO#m]Sa[LA]ngre sea mi san[FA#m]gre,' && e.sel === 'LA' && e.letra === 'n', JSON.stringify([ls[0], ls[1], e]));

  // Cambiar el nombre
  await p.ev('ebCambiar.click()');
  e = await estado(p);
  check('Cambiar: campo con el nombre actual', e.fila === 'ebCampo' && (await p.ev('ebNombre.value')) === 'LA' && e.info === 'Otro nombre para LA', JSON.stringify(e));
  await escribirNombre(p, 'xx');
  e = await estado(p);
  check('nombre que no es un acorde: avisa y no deja aceptar', e.aviso.startsWith('No se reconoce') && (await es(p, 'ebAceptar.disabled')), JSON.stringify(e));
  await escribirNombre(p, 'sol13');
  e = await estado(p);
  check('acorde sin diagrama: avisa y deja agregar', e.aviso.includes('Queda SOL13') && e.aviso.includes('no tiene diagrama') && (await es(p, '!ebAceptar.disabled')), e.aviso);
  await escribirNombre(p, 'lam');
  e = await estado(p);
  check('escrito en minúsculas: avisa cómo queda', e.aviso === 'Queda LAm', e.aviso);
  await foto(p, 'editor-campo');
  await p.ev(`ebCampo.requestSubmit()`); await wait(100);
  e = await estado(p);
  check('Cambiar: queda el nombre nuevo, todavía elegido', (await lineas(p))[1] === 'que tu [DO#m]Sa[LAm]ngre sea mi san[FA#m]gre,' && e.fila === 'ebAcorde' && e.sel === 'LAm', JSON.stringify(e));

  // Borrar
  await p.ev('ebBorrar.click()');
  e = await estado(p);
  check('Borrar: se va el acorde y no queda nada elegido', (await lineas(p))[1] === L1 && e.fila === 'ebNada' && e.estado === 'Hay cambios sin guardar' && e.salir === 'Descartar' && e.guardar, JSON.stringify(e));

  // Una letra sin acorde: "+ Acorde acá"
  await tocarLetra(p, 0, 'Toma', 0);
  e = await estado(p);
  check('tocar una letra sin acorde elegido: "+ Acorde acá"', e.fila === 'ebSilaba' && e.info === 'Acorde nuevo sobre Toma,' && e.letra === 'T', JSON.stringify(e));
  await p.ev('ebAgregar.click()');
  await escribirNombre(p, 'Re7');
  await p.ev(`ebCampo.requestSubmit()`); await wait(100);
  e = await estado(p);
  check('agregar: el acorde nuevo queda en la letra y elegido', (await lineas(p))[0] === '[RE7]Toma, que tu [DO#m]Cuerpo sea mi cu[FA#m]erpo,' && e.sel === 'RE7' && e.fila === 'ebAcorde', JSON.stringify(e));
  await p.ev('ebListo.click()');
  await foto(p, 'editor-cambios');

  // Guardar
  const LETRA1 = ORIGINAL.replace('[LA]Toma,', '[RE7]Toma,');
  await p.ev('ebGuardar.click()'); await wait(300);
  let w = await escrituras(p);
  check('Guardar: escribe canciones/<id> con la letra, quién y cuándo (sin anterior)', w.length === 1 && w[0][0] === 'set' && w[0][1] === `canciones/${ID}` &&
    w[0][2].letra === LETRA1 && w[0][2].por === 'Admin Prueba' && typeof w[0][2].cuando === 'number' && !('anterior' in w[0][2]), JSON.stringify(w).slice(0, 300));
  e = await estado(p);
  check('Guardar: se cierra el editor y vuelve el tono del coro (RE7 + 2 = MI7)', !e.abierta && (await p.ev(`letraBox.querySelector('c').textContent`)) === 'MI7' && (await es(p, `!letraBox.classList.contains('editando')`)));
  check('"Corregida por …" con la fecha', (await p.ev('correccionTexto.textContent')) === `Corregida por Admin Prueba · ${FECHA}`, await p.ev('correccionTexto.textContent'));
  check('admin: "Volver a la versión original", sin "Deshacer" (no hay anterior)', await es(p, `!${CAJA}.hidden && !correccionAcciones.hidden && !correccionOriginal.hidden && correccionDeshacer.hidden`));
  check('copia local de la corrección', JSON.parse(await p.ev(`localStorage.getItem('cancion_${ID}')`)).letra === LETRA1);

  // Otra corrección: guarda la anterior
  await p.ev('editarAcordes.click()');
  await p.ev(`letraBox.querySelector('c').click()`);
  await p.ev('ebDer.click()');
  await p.ev('ebListo.click()');
  await p.ev('ebGuardar.click()'); await wait(300);
  w = await escrituras(p);
  check('otra corrección: guarda la anterior', w.length === 2 && w[1][2].letra === ORIGINAL.replace('[LA]Toma,', 'T[RE7]oma,') && w[1][2].anterior === LETRA1, JSON.stringify(w[1]).slice(0, 200));
  check('ahora se ve "Deshacer el último cambio"', await es(p, '!correccionDeshacer.hidden'));
  await foto(p, 'editor-corregida');

  // Deshacer
  await p.ev('correccionDeshacer.click()'); await wait(300);
  w = await escrituras(p);
  check('Deshacer: vuelve la versión anterior (y ya no hay otra para deshacer)', w.length === 3 && w[2][0] === 'set' && w[2][2].letra === LETRA1 && !('anterior' in w[2][2]) && p.dialogs.some(d => d.startsWith('¿Deshacer')), JSON.stringify(w[2]).slice(0, 200));
  check('Deshacer: la letra en pantalla es la anterior', (await lineas(p))[0] === '[RE7]Toma, que tu [DO#m]Cuerpo sea mi cu[FA#m]erpo,' && (await es(p, 'correccionDeshacer.hidden')));

  // Volver a la versión original
  await p.ev('correccionOriginal.click()'); await wait(300);
  w = await escrituras(p);
  check('Volver a la versión original: borra la corrección', w.length === 4 && w[3][0] === 'remove' && w[3][1] === `canciones/${ID}`, JSON.stringify(w[3]));
  check('vuelve la letra del archivo, en el tono del coro, sin "Corregida"', (await lineas(p))[0] === L0 && (await p.ev(`letraBox.querySelector('c').textContent`)) === 'SI' && (await es(p, `${CAJA}.hidden`)));

  // Descartar
  await p.ev('editarAcordes.click()');
  await p.ev(`letraBox.querySelector('c').click()`);
  await p.ev('ebBorrar.click()');
  await p.ev('ebSalir.click()'); await wait(100);
  check('Descartar: pregunta, no escribe y deja la letra como estaba', p.dialogs.some(d => d.startsWith('¿Descartar')) && (await escrituras(p)).length === 4 && (await lineas(p))[0] === L0 && !(await estado(p)).abierta);
  check('sin errores', p.errors.length === 0, p.errors.join(' | '));
  await p.ev(`localStorage.removeItem('cancion_${ID}')`);
  await p.close();
}

// ── 2. Cambios sin guardar, sin conexión, otro admin guardó, acordes ocultos ──
{
  const p = await c.newPage({ fake: FAKE_FIREBASE({ 'admins/test@gmail,com': true }, ADMIN), width: 390, height: 800 });
  await p.go(`/cancion.html?id=${ID}&admin=true`, 2500);
  if (!(await es(p, 'Array.isArray(window.__writes)'))) throw new Error('Firebase falso no cargado: aborto');
  await p.ev(`window.__preguntas = []; window.confirm = m => { __preguntas.push(m); return false; }`);
  await p.ev('toggleChords.click()');   // acordes ocultos
  await p.ev('editarAcordes.click()');
  check('con los acordes ocultos, el editor los muestra', await es(p, `!letraBox.classList.contains('no-chords') && getComputedStyle(letraBox.querySelector('c')).display !== 'none'`));
  await p.ev(`letraBox.querySelector('c').click()`);
  await p.ev('ebDer.click()');
  await p.ev(`document.querySelector('.back-link').click()`); await wait(300);
  check('"Volver" con cambios sin guardar: pregunta y se queda', (await p.ev('__preguntas.length')) === 1 && (await p.ev('location.pathname')) === '/cancion.html' && (await estado(p)).abierta, await p.ev('JSON.stringify(__preguntas)'));
  await p.ev('ebListo.click()');

  await p.s('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }); await wait(200);
  await p.ev('ebGuardar.click()'); await wait(200);
  check('sin conexión: avisa, no escribe y el editor sigue con los cambios', p.dialogs.some(d => d.includes('Sin conexión')) && (await escrituras(p)).length === 0 && (await estado(p)).guardar, p.dialogs.join(' | '));
  await p.s('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }); await wait(200);

  // Otro admin guarda mientras tanto
  await p.ev(`firebase.database().ref('canciones/${ID}').set({ letra: ${JSON.stringify(ORIGINAL.replace('[LA]Toma', '[SOL]Toma'))}, por: 'Otra Admin', cuando: Date.now() })`); await wait(200);
  let e = await estado(p);
  check('otro admin guardó: lo avisa sin pisar lo que se edita', e.estado === 'Se guardó otra versión mientras editabas' && (await lineas(p))[0].startsWith('T[LA]oma'), JSON.stringify(e));
  await p.ev('ebGuardar.click()'); await wait(200);
  check('otro admin guardó: Guardar pregunta antes de reemplazar', (await p.ev('__preguntas.length')) === 2 && (await p.ev('__preguntas[1]')).startsWith('Mientras editabas') && (await escrituras(p)).length === 1);
  await p.ev(`window.confirm = () => true; ebSalir.click()`); await wait(200);
  check('al salir se ve la versión guardada por el otro admin', (await lineas(p))[0].startsWith('[SOL]Toma') && (await p.ev('correccionTexto.textContent')).startsWith('Corregida por Otra Admin'));
  check('sin errores', p.errors.length === 0, p.errors.join(' | '));
  await p.ev(`localStorage.removeItem('cancion_${ID}')`);
  await p.close();
}

// ── 3. Músicos: ven la corrección, no la editan; sin conexión, la copia ──
const CORREGIDA = ORIGINAL.replace('[LA]Toma, que tu', '[SOL]TOMA, que tu');
{
  const p = await c.newPage({ fake: FAKE_FIREBASE({ [`canciones/${ID}`]: { letra: CORREGIDA, por: 'Mateo', cuando: new Date(2026, 10, 3, 20, 0).getTime() } }), width: 390, height: 800 });
  await p.go(`/cancion.html?id=${ID}`, 2500);
  check('músicos: se ve la letra corregida', (await lineas(p))[0] === '[SOL]TOMA, que tu [DO#m]Cuerpo sea mi cu[FA#m]erpo,', (await lineas(p))[0]);
  check('músicos: "Corregida por Mateo · 3/11", sin botones', (await p.ev('correccionTexto.textContent')) === 'Corregida por Mateo · 3/11' && (await es(p, `!${CAJA}.hidden && correccionAcciones.hidden`)));
  check('músicos: sin lápiz', await es(p, 'editarAcordes.hidden'));
  await p.go(`/cancion.html?id=${ID}&admin=true`, 2500);
  check('admin sin sesión: sin lápiz ni botones de la corrección', await es(p, `editarAcordes.hidden && !${CAJA}.hidden && correccionAcciones.hidden`));
  check('sin errores', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}
{
  const p = await c.newPage({ blockFirebase: true, width: 390, height: 800 });
  await p.go(`/cancion.html?id=${ID}`, 2000);
  check('sin Firebase: la copia local de la corrección', (await lineas(p))[0].startsWith('[SOL]TOMA') && (await es(p, `!${CAJA}.hidden`)));
  await p.ev(`localStorage.removeItem('cancion_${ID}')`);
  await p.close();
}

// ── 4. Banco: una lectura por REST, solo del texto ──
{
  const p = await c.newPage({ rest: { misa_actual: [ID], [`canciones/${ID}/letra`]: CORREGIDA }, width: 390, height: 800 });
  await p.go(`/cancion.html?id=${ID}&modo=banco`, 2500);
  check('banco: la letra corregida', (await p.ev(`letraBox.querySelector('.renglon').innerText`)) === 'TOMA, que tu Cuerpo sea mi cuerpo,', await p.ev(`letraBox.querySelector('.renglon').innerText`));
  check('banco: lee canciones/<id>/letra por REST, sin el SDK', p.requests.some(u => u.includes(`/canciones/${ID}/letra.json`)) && !p.requests.some(u => u.includes('firebasejs')), p.requests.filter(u => u.includes('firebase')).join(' '));
  check('banco: sin "Corregida por" ni lápiz', await es(p, `getComputedStyle(${CAJA}).display === 'none' && getComputedStyle(editarAcordes).display === 'none'`));
  check('sin errores', p.errors.length === 0, p.errors.join(' | '));
  await p.ev(`localStorage.removeItem('cancion_${ID}')`);
  await p.close();
}

// ── 5. Reglas de la base ──
{
  const reglas = JSON.parse(fs.readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8')).rules;
  const r = reglas.canciones;
  check('reglas: lectura pública, escritura solo de admins', r['.read'] === true && r.$id['.write'].includes("root.child('admins')"));
  check('reglas: id de canción, letra hasta 20 000, cuando del servidor, sin campos extra',
    r.$id['.validate'].includes('$id.matches') && r.$id.letra['.validate'].includes('<= 20000') && r.$id.cuando['.validate'].includes('== now') &&
    r.$id.anterior['.validate'].includes('<= 20000') && r.$id.$otro['.validate'] === false);
}
done(); c.close();
