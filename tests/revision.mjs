// Arreglos de la revisión del código (A2–A8 y código muerto)
import fs from 'fs';
import { connect, check, done, wait, FAKE_FIREBASE } from './cdp.mjs';
const c = await connect();
const ADMIN = { email: 'test@gmail.com' };
const DB = extra => ({ 'admins/test@gmail,com': true, ...extra });
const guardia = async p => { if (!(await p.ev('Array.isArray(window.__writes)'))) throw new Error('Firebase falso no cargado: aborto'); };

// A2: ids publicados que ya no existen en SONGS
{
  const p = await c.newPage({ fake: FAKE_FIREBASE(DB({ misa_actual: ['ent_bendecire', 'zzz_borrada', 'com_alma-misionera'] }), ADMIN) });
  await p.go('/index.html?admin=true');
  check('A2: el chip cuenta solo canciones existentes', (await p.ev(`document.querySelector('.cat-chip .chip-count').textContent`)) === '2');
  check('A2: la lista coincide con el chip', (await p.ev(`document.querySelectorAll('.song-row').length`)) === 2);
  await guardia(p);
  await p.ev('publicarMisa()'); await wait(300);
  check('A2: publicar no vuelve a guardar el id inexistente', (await p.ev('JSON.stringify(__writes)')) === '[["set","misa_actual",["ent_bendecire","com_alma-misionera"]]]', await p.ev('JSON.stringify(__writes)'));
  await p.close();
}
// A3: otra versión publicada mientras el admin edita
{
  const p = await c.newPage({ fake: FAKE_FIREBASE(DB({ misa_actual: ['ent_bendecire'] }), ADMIN), dialogAccept: true });
  await p.go('/index.html?admin=true');
  await p.ev(`addToMisa('com_alma-misionera')`);
  await p.ev(`__db.misa_actual = ['mar_magnificat']; __emit('misa_actual')`); await wait(200);
  check('A3: no pisa los cambios locales', (await p.ev('JSON.stringify(misaIds)')) === '["ent_bendecire","com_alma-misionera"]');
  check('A3: muestra el aviso', !(await p.ev(`document.getElementById('aviso-misa').hidden`)));
  await p.ev(`document.querySelector('#aviso-misa button').click()`); await wait(200);
  check('A3: "Cargar la publicada" trae la otra versión', (await p.ev('JSON.stringify(misaIds)')) === '["mar_magnificat"]' && (await p.ev(`document.getElementById('aviso-misa').hidden`)));
  await guardia(p);
  await p.ev(`addToMisa('ent_bendecire'); publicarMisa()`); await wait(300);
  check('A3: el eco de la propia publicación no avisa', (await p.ev(`document.getElementById('aviso-misa').hidden`)) && (await p.ev('misaSinPublicar')) === false);
  check('sin errores', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}
// A4: singular
{
  const p = await c.newPage({ fake: FAKE_FIREBASE({ misa_actual: ['ent_bendecire'] }) });
  await p.go('/index.html');
  check('A4: "1 canción"', (await p.ev(`document.getElementById('cnt').textContent`)) === '1 canción');
  await p.close();
}
// A5: filas de admin sin onclick inline, título con apóstrofo
{
  const p = await c.newPage({ fake: FAKE_FIREBASE(DB({}), ADMIN) });
  await p.go('/index.html?admin=true&cat=varias');
  await p.ev(`SONGS.push({ id: 'var_prueba-apostrofo', num: 0, title: "Canción d'ejemplo", category: 'varias' }); fc('entrada'); fc('varias')`);
  const fila = await p.ev(`(() => { const r = [...document.querySelectorAll('.admin-row')].find(r => r.textContent.includes("d'ejemplo")); return r ? { onclick: r.hasAttribute('onclick'), href: r.dataset.href } : null; })()`);
  check('A5: fila con data-href y sin onclick', fila && !fila.onclick && fila.href === 'cancion.html?id=var_prueba-apostrofo&admin=true&cat=varias', JSON.stringify(fila));
  await p.ev(`[...document.querySelectorAll('.admin-row')].find(r => r.textContent.includes("d'ejemplo")).querySelector('.song-name').click()`); await wait(1500);
  check('A5: tocar la fila navega a la canción', (await p.ev('location.search')).startsWith('?id=var_prueba-apostrofo'));
  check('sin errores', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}
// A6: sin ?id= vuelve al índice sin pedir letras/null.html
{
  const p = await c.newPage();
  await p.go('/cancion.html', 2000);
  check('A6: redirige al índice', (await p.ev('location.pathname')).endsWith('/index.html'));
  check('A6: no pide letras/null.html', !p.requests.some(u => u.includes('letras/null')));
  await p.close();
}
// A7: reglas y transposición acotada
{
  const reglas = JSON.parse(fs.readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8')).rules;
  check('A7: reglas de tonos con rangos y sin campos extra', !!reglas.tonos.$id.transponer && !!reglas.tonos.$id.capo && reglas.tonos.$id.$otro['.validate'] === false);
  check('A7: misa_actual valida ids de texto', reglas.misa_actual.$i['.validate'].includes('isString'));
  const p = await c.newPage({ fake: FAKE_FIREBASE({}) });
  await p.go('/cancion.html?id=ofert_toma');
  await p.ev(`for (let i = 0; i < 13; i++) applyTransposition(1)`);
  check('A7: +13 semitonos queda en +1 (misma nota, guardable)', (await p.ev('currentTranspose')) === 1 && (await p.ev(`document.querySelector('pre c').textContent`)) === 'LA#');
  await p.ev(`for (let i = 0; i < 14; i++) applyTransposition(-1)`);
  check('A7: −13 queda en −1', (await p.ev('currentTranspose')) === -1);
  // Código muerto: solo notación latina
  check('B: SIb +2 = DO', (await p.ev(`transposeChord('SIb', 2)`)) === 'DO');
  check('B: RE/FA# +2 = MI/SOL#', (await p.ev(`transposeChord('RE/FA#', 2)`)) === 'MI/SOL#');
  check('B: notación americana ya no se transpone', (await p.ev(`transposeChord('Am', 2)`)) === 'Am');
  await p.close();
}
// A8 y archivos borrados
{
  const p = await c.newPage();
  await p.go('/index.html', 1000);
  const nums = await p.ev(`Object.fromEntries(['ent_aqui-estamos-senor', 'ent_vienen-con-alegria', 'mar_ven-con-nosotros-a-caminar', 'mar_dios-te-salve-maria'].map(id => [id, SONGS.find(s => s.id === id).num]))`);
  check('A8: números corregidos', JSON.stringify(nums) === '{"ent_aqui-estamos-senor":1,"ent_vienen-con-alegria":19,"mar_ven-con-nosotros-a-caminar":182,"mar_dios-te-salve-maria":0}', JSON.stringify(nums));
  const st = await p.ev(`Promise.all(['assets/virgen-hero.png', 'assets/virgen-icono.jpg', 'assets/virgen-sticker.jpg'].map(u => fetch(u).then(r => r.status)))`);
  check('B: imágenes sin uso borradas', st.every(s => s === 404), JSON.stringify(st));
  await p.close();
}
done(); c.close();
