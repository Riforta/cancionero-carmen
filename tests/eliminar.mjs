// Eliminar y recuperar canciones (AGENTS.md D26): el botón de la canción, que
// deje de verse en la lista, la misa, la búsqueda y banco, "Recuperar" desde
// el índice y la canción, el borrado del todo y las reglas.
import fs from 'fs';
import { connect, check, done, wait, FAKE_FIREBASE } from './cdp.mjs';
const c = await connect();
const ADMIN = { email: 'test@gmail.com', displayName: 'Admin Prueba' };
const es = async (p, expr) => (await p.ev(expr)) === true;
const ELIM = { ofert_toma: { titulo: 'Toma', por: 'Admin Prueba', cuando: Date.now() } };
const limpiar = p => p.ev(`['eliminadas', 'canciones_indice', 'misa_cache', 'misa_borrador'].forEach(k => localStorage.removeItem(k))`);
const esperarFake = async p => { for (let t = 0; t < 60 && !(await es(p, 'Array.isArray(window.__writes)')); t++) await wait(100); };
const nombres = p => p.ev(`[...document.querySelectorAll('.song-name')].map(e => e.textContent).join('|')`);

// ── 1. Eliminar desde la canción ──
{
  const p = await c.newPage({ fake: FAKE_FIREBASE({ 'admins/test@gmail,com': true }, ADMIN), dialogAccept: true, width: 390, height: 800 });
  await p.go('/cancion.html?id=ofert_toma&admin=true', 2500);
  await esperarFake(p);
  check('admin: "Eliminar esta canción" al final', await es(p, `!document.getElementById('eliminar').hidden && eliminarBtn.textContent === 'Eliminar esta canción'`));
  await p.ev(`window.linkCon = () => '#eliminada'`);   // que no navegue: se mira lo escrito
  await p.ev('eliminarBtn.click()'); await wait(400);
  const w = JSON.parse(await p.ev('JSON.stringify(__writes)'));
  check('pregunta antes', p.dialogs.some(d => d.startsWith('¿Eliminar «Toma»')));
  check('marca eliminadas/<id> con título, quién y cuándo', w.length === 1 && w[0][1] === 'eliminadas/ofert_toma' && w[0][2].titulo === 'Toma' && w[0][2].por === 'Admin Prueba' && typeof w[0][2].cuando === 'number', JSON.stringify(w));
  check('vuelve al índice', (await p.ev('location.hash')) === '#eliminada');
  check('sin errores', p.errors.length === 0, p.errors.join(' | '));
  await limpiar(p);
  await p.close();
}
{ // Músicos: no la ven
  const p = await c.newPage({ fake: FAKE_FIREBASE({ eliminadas: ELIM, misa_actual: ['ent_bendecire', 'ofert_toma'] }), width: 390, height: 800 });
  await p.go('/index.html', 2500);
  await esperarFake(p); await wait(300);
  check('la misa sigue sin la eliminada', (await nombres(p)) === 'Bendeciré');
  await p.ev(`elegirCategoria('ofertorio')`);
  check('no está en su categoría', !(await nombres(p)).split('|').includes('Toma'));
  await p.ev(`{ const i = document.getElementById('si'); i.value = 'toma'; i.dispatchEvent(new Event('input')); }`); await wait(300);
  check('no aparece al buscarla', !(await nombres(p)).split('|').includes('Toma'));
  check('músicos: sin lista de eliminadas', await es(p, `document.getElementById('nueva').hidden`));
  await limpiar(p);
  await p.close();
}
{ // Banco: tampoco
  const p = await c.newPage({ rest: { misa_actual: ['ent_bendecire', 'ofert_toma'], eliminadas: ELIM }, width: 390, height: 800 });
  await p.go('/index.html?modo=banco', 3000);
  check('banco: la misa sin la eliminada', (await nombres(p)) === 'Bendeciré');
  await limpiar(p);
  await p.close();
}

// ── 2. Recuperar ──
{
  const p = await c.newPage({ fake: FAKE_FIREBASE({ 'admins/test@gmail,com': true, 'eliminadas/ofert_toma': ELIM.ofert_toma, misa_actual: [] }, ADMIN), width: 390, height: 800 });
  await p.go('/index.html?admin=true&cat=ofertorio', 2500);
  await esperarFake(p); await wait(300);
  check('admin: lista de eliminadas con "Recuperar"', (await p.ev(`document.getElementById('eliminadasLista').textContent`)).includes('Toma') && (await es(p, `!document.getElementById('eliminadasCaja').hidden`)));
  await p.ev(`document.querySelector('[data-recuperar="ofert_toma"]').click()`); await wait(400);
  const w = JSON.parse(await p.ev('JSON.stringify(__writes)'));
  check('Recuperar: borra la marca', w.some(x => x[1] === 'eliminadas/ofert_toma' && x[2] === null), JSON.stringify(w));
  check('vuelve a la lista y se va de las eliminadas', (await nombres(p)).split('|').includes('Toma') && (await es(p, `document.getElementById('eliminadasCaja').hidden`)));
  check('sin errores', p.errors.length === 0, p.errors.join(' | '));
  await limpiar(p);
  await p.close();
}
{ // Desde el link de la canción eliminada
  const p = await c.newPage({ fake: FAKE_FIREBASE({ 'admins/test@gmail,com': true, eliminadas: ELIM }, ADMIN), width: 390, height: 800 });
  await p.go('/cancion.html?id=ofert_toma&admin=true', 2500);
  await esperarFake(p); await wait(300);
  check('la canción eliminada ofrece "Recuperar"', (await p.ev('eliminarBtn.textContent')) === 'Recuperar esta canción' && (await es(p, '!eliminarTexto.hidden')));
  await p.ev('eliminarBtn.click()'); await wait(400);
  check('Recuperar desde la canción', (await p.ev('JSON.stringify(__writes)')).includes('"eliminadas/ofert_toma",null') && (await p.ev('eliminarBtn.textContent')) === 'Eliminar esta canción');
  await limpiar(p);
  await p.close();
}

// ── 3. Borrado del todo (limpieza del índice, admin) ──
{
  const viejo = Date.now() - 40 * 24 * 3600 * 1000;
  const rest = {
    canciones: {}, eliminadas: {
      ofert_toma: { titulo: 'Toma', cuando: viejo },               // sigue en el repo: espera al script
      'var_vieja': { titulo: 'Vieja', cuando: viejo },             // ya no está en el repo: se borra todo
      'nav_reciente': { titulo: 'Reciente', cuando: Date.now() },   // de la web, menos de 30 días: se queda
      'nav_antigua': { titulo: 'Antigua', cuando: viejo }           // de la web, más de 30 días: se borra
    },
    canciones_indice: { 'nav_reciente': { titulo: 'Reciente', categoria: 'navidad' }, 'nav_antigua': { titulo: 'Antigua', categoria: 'navidad' } }
  };
  const p = await c.newPage({ fake: FAKE_FIREBASE({ 'admins/test@gmail,com': true, misa_actual: [] }, ADMIN), rest, width: 390, height: 800 });
  await p.go('/index.html?admin=true', 3500);
  await esperarFake(p); await wait(500);
  const rutas = JSON.parse(await p.ev('JSON.stringify(__writes)')).filter(x => x[2] === null).map(x => x[1]);
  const de = id => ['eliminadas', 'canciones_indice', 'canciones', 'notas', 'tonos', 'medios'].map(r => `${r}/${id}`);
  check('se borra todo lo de la que ya no está en el repo y lo de la web con más de 30 días', [...de('var_vieja'), ...de('nav_antigua')].every(r => rutas.includes(r)), JSON.stringify(rutas));
  check('se quedan la del repo y la reciente de la web', !rutas.some(r => r.endsWith('/ofert_toma') || r.endsWith('/nav_reciente')), JSON.stringify(rutas));
  await limpiar(p);
  await p.close();
}

// ── 4. Reglas ──
{
  const r = JSON.parse(fs.readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8')).rules.eliminadas;
  check('reglas: eliminadas con lectura pública, escritura de admins, título, quién y cuándo del servidor',
    r['.read'] === true && r.$id['.write'].includes("root.child('admins')") && r.$id.cuando['.validate'].includes('== now') && r.$id.$otro['.validate'] === false);
}
done(); c.close();
