// Varias misas (D27): misas preparadas, elegir cuál ven los fieles, agregar
// canciones a la preparada desde el índice y desde la canción
import { connect, check, done, wait, FAKE_FIREBASE } from './cdp.mjs';
const c = await connect();
const ADMIN = { email: 'test@gmail.com', displayName: 'Prueba' };
const HOY = ['ent_bendecire', 'com_alma-misionera'];
const TARDE = { nombre: 'Domingo 19 h', canciones: ['ent_ven-hermano', 'mar_magnificat'], por: 'Otra', cuando: 1763900000000 };
const DB = () => ({ misa_actual: HOY, misa_meta: { por: 'Prueba', cuando: 1763800000000, nombre: 'Domingo 10 h · Comuniones' }, 'misas/-k9': TARDE, 'admins/test@gmail,com': true });
const guardia = async p => { if (!(await p.ev('Array.isArray(window.__writes)'))) throw new Error('Firebase falso no cargado: aborto'); };
const tabs = p => p.ev(`[...document.querySelectorAll('#misa-tabs .misa-tab')].map(b => (b.classList.contains('active') ? '*' : '') + b.textContent.trim()).join('|')`);
const nombres = p => p.ev(`[...document.querySelectorAll('#list .song-name')].map(e => e.textContent).join('|')`);
const esperar = async (p, expr) => { for (let i = 0; i < 40 && !(await p.ev(expr)); i++) await wait(100); };

{ // Admin con sesión: pestañas, agregar a la preparada y mostrarla a los fieles
  const p = await c.newPage({ fake: FAKE_FIREBASE(DB(), ADMIN), width: 390, height: 800, dialogAccept: true });
  await p.go('/index.html?admin=true', 600);
  await p.ev(`localStorage.removeItem('misa_borrador'); localStorage.removeItem('misas_cache'); localStorage.setItem('sesion_admin', JSON.stringify({ email: 'test@gmail.com', nombre: 'Prueba' }))`);
  await p.go('/index.html?admin=true&cat=misa');
  await esperar(p, `misasPrep.length === 1`);
  await guardia(p);
  check('admin: pestañas de las misas, con la de los fieles elegida', (await tabs(p)) === '*Domingo 10 h · Comuniones|Domingo 19 h|Nueva misa', await tabs(p));
  check('admin: el botón principal publica la Misa de Hoy', (await p.ev(`document.querySelector('#admin-bar [data-action=publicar]').textContent`)) === 'Publicar Misa');
  check('admin: "Borrar esta misa" oculto en la de los fieles', await p.ev(`document.querySelector('[data-misa-accion=borrar]').hidden`));

  await p.ev(`document.querySelector('.misa-tab[data-misa="-k9"]').click()`);
  check('elegir la preparada: su lista', (await nombres(p)) === 'Ven hermano|Magníficat', await nombres(p));
  check('elegir la preparada: viaja en la URL', (await p.ev('location.search')).includes('misa=-k9'));
  check('preparada: "Mostrar a los fieles" y "Borrar esta misa"', (await p.ev(`document.querySelector('#admin-bar [data-action=publicar]').textContent`)) === 'Mostrar a los fieles' && !(await p.ev(`document.querySelector('[data-misa-accion=borrar]').hidden`)));
  check('preparada: dice que los fieles no la ven', (await p.ev(`document.getElementById('misa-meta').textContent`)).includes('Los fieles todavía no la ven'));
  check('preparada: el chip lleva su nombre', (await p.ev(`document.querySelector('.cat-chip[data-cat=misa] .chip-label').textContent`)) === 'Domingo 19 h');
  check('preparada: el link de la canción lleva la misa', (await p.ev(`document.querySelector('#list .song-row').dataset.href`)).includes('misa=-k9'));

  // El + agrega a la preparada y se guarda al instante (sin borrador)
  await p.ev(`elegirCategoria('ofertorio')`);
  await p.ev(`document.querySelector('.admin-btn.btn-mas[data-song-id="ofert_toma"]').click()`); await wait(200);
  const w = JSON.parse(await p.ev(`JSON.stringify(__writes.filter(x => x[1] === 'misas/-k9').pop())`));
  check('+ con la preparada elegida: la guarda en su momento', w && JSON.stringify(w[2].canciones) === JSON.stringify(['ent_ven-hermano', 'ofert_toma', 'mar_magnificat']) && w[2].nombre === 'Domingo 19 h' && w[2].por === 'Prueba', JSON.stringify(w));
  check('+ con la preparada elegida: no toca la Misa de Hoy', (await p.ev(`localStorage.getItem('misa_borrador') === null`)) && (await p.ev('JSON.stringify(misaIds)')) === JSON.stringify(HOY));
  check('+ con la preparada elegida: aviso con su nombre', (await p.ev(`document.getElementById('aviso-flotante').textContent`)).includes('Agregada a «Domingo 19 h» (3)'));

  // Mostrar a los fieles: pasa a misa_actual y la anterior queda preparada
  await p.ev(`elegirCategoria('misa')`);
  await p.ev(`document.querySelector('#admin-bar [data-action=publicar]').click()`); await wait(400);
  const db = JSON.parse(await p.ev(`JSON.stringify({ hoy: __db.misa_actual, meta: __db.misa_meta, misas: __val('misas') })`));
  check('mostrar a los fieles: la preparada pasa a la Misa de Hoy', JSON.stringify(db.hoy) === JSON.stringify(['ent_ven-hermano', 'ofert_toma', 'mar_magnificat']) && db.meta.nombre === 'Domingo 19 h', JSON.stringify(db.meta));
  const quedan = Object.values(db.misas || {});
  check('mostrar a los fieles: la que se veía queda como preparada', quedan.length === 1 && quedan[0].nombre === 'Domingo 10 h · Comuniones' && JSON.stringify(quedan[0].canciones) === JSON.stringify(HOY), JSON.stringify(db.misas));
  check('mostrar a los fieles: en una sola operación', (await p.ev(`__writes.filter(x => x[0] === 'update').slice(-4).map(x => x[1]).join(',')`)).startsWith('misa_actual,misa_meta,misas/-k9,misas/-k'));
  check('mostrar a los fieles: vuelve a la Misa de Hoy', (await p.ev('misaSel === null')) && !(await p.ev('location.search')).includes('misa=') && (await tabs(p)).startsWith('*Domingo 19 h|Domingo 10 h'), await tabs(p));

  // Nueva misa
  await p.ev(`window.prompt = () => 'Sábado 20 h'`);
  await p.ev(`document.querySelector('.misa-tab.nueva').click()`); await wait(300);
  check('nueva misa: se crea y queda elegida', (await tabs(p)).includes('*Sábado 20 h') && (await p.ev('idsElegida().length')) === 0, await tabs(p));
  check('nueva misa: lista vacía con el aviso de siempre', (await p.ev(`document.getElementById('misa-empty').style.display`)) === 'block');
  // Borrarla
  await p.ev(`document.querySelector('[data-misa-accion=borrar]').click()`); await wait(300);
  check('borrar misa: desaparece y vuelve a la Misa de Hoy', !(await tabs(p)).includes('Sábado') && (await p.ev('misaSel === null')), await tabs(p));
  // Cambiar el nombre de la Misa de Hoy conserva quién y cuándo
  await p.ev(`window.prompt = () => 'Domingo 19 h (tarde)'`);
  await p.ev(`document.querySelector('[data-misa-accion=renombrar]').click()`); await wait(300);
  const meta = JSON.parse(await p.ev('JSON.stringify(__db.misa_meta)'));
  check('cambiar nombre de la Misa de Hoy', meta.nombre === 'Domingo 19 h (tarde)' && meta.por === 'Prueba', JSON.stringify(meta));
  await p.shot('misas-admin', 800);
  check('sin errores', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}

{ // Músicos: ven las preparadas para ensayar, sin botones
  const p = await c.newPage({ fake: FAKE_FIREBASE(DB()), width: 390, height: 800 });
  await p.go('/index.html?cat=misa');
  await esperar(p, `misasPrep.length === 1`);
  check('músicos: pestañas sin "Nueva misa"', (await tabs(p)) === '*Domingo 10 h · Comuniones|Domingo 19 h', await tabs(p));
  check('músicos: sin botones de la misa', await p.ev(`document.getElementById('misa-acciones').hidden`));
  await p.ev(`document.querySelector('.misa-tab[data-misa="-k9"]').click()`);
  check('músicos: ven la preparada', (await nombres(p)) === 'Ven hermano|Magníficat');
  check('músicos: compartir la preparada, sin link de fieles', await p.ev(`textoMisa().includes('*Domingo 19 h*') && textoMisa().includes('misa=-k9') && !textoMisa().includes('modo=banco')`));
  // Canción de la preparada: anterior / siguiente dentro de ella
  await p.go('/cancion.html?id=ent_ven-hermano&cat=misa&misa=-k9');
  await esperar(p, `misaPos.textContent === '1 / 2'`);
  check('canción: anterior / siguiente de la preparada', (await p.ev('misaPos.textContent')) === '1 / 2' && (await p.ev('misaNext.textContent')).includes('Magníficat'), await p.ev('misaPos.textContent'));
  check('canción: el siguiente conserva la misa', (await p.ev(`misaNext.getAttribute('href')`)).includes('misa=-k9'));
  check('canción: "Volver" conserva la misa', (await p.ev(`document.querySelector('.back-link').getAttribute('href')`)).includes('misa=-k9'));
  // Misa que ya no existe: la de hoy
  await p.go('/cancion.html?id=com_alma-misionera&cat=misa&misa=-nada');
  await esperar(p, `misaPos.textContent === '2 / 2'`);
  check('canción: misa que ya no está → la de hoy', (await p.ev('misaPos.textContent')) === '2 / 2');
  check('sin errores', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}

{ // Admin en la canción con la preparada elegida
  const p = await c.newPage({ fake: FAKE_FIREBASE(DB(), ADMIN), width: 390, height: 800 });
  await p.go('/cancion.html?id=ofert_toma&admin=true&cat=todas&misa=-k9');
  await esperar(p, `misaAgregarBtn.textContent.includes('Domingo 19 h')`);
  await guardia(p);
  check('canción admin: "Agregar a «Domingo 19 h»"', (await p.ev('misaAgregarBtn.textContent')) === 'Agregar a «Domingo 19 h»', await p.ev('misaAgregarBtn.textContent'));
  await p.ev('misaAgregarBtn.click()'); await wait(300);
  const w = JSON.parse(await p.ev(`JSON.stringify(__writes.pop())`));
  check('canción admin: se guarda en la preparada', w[1] === 'misas/-k9' && JSON.stringify(w[2].canciones) === JSON.stringify(['ent_ven-hermano', 'ofert_toma', 'mar_magnificat']), JSON.stringify(w));
  check('canción admin: pasa a "En «…» · Quitar", sin "Falta publicar"', (await p.ev('misaAgregarBtn.textContent')) === 'En «Domingo 19 h» · Quitar' && (await p.ev(`misaPendiente.classList.contains('oculta')`)));
  check('canción admin: no deja borrador de la Misa de Hoy', (await p.ev(`localStorage.getItem('misa_borrador') === null`)));
  check('sin errores', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}

{ // Banco: no lee las preparadas
  const p = await c.newPage({ rest: { misa_actual: HOY, misas: { '-k9': TARDE } } });
  await p.go('/index.html?modo=banco&misa=-k9', 2500);
  check('banco: sin pestañas', await p.ev(`document.getElementById('misa-tabs').hidden`));
  check('banco: muestra la Misa de Hoy aunque venga ?misa=', (await nombres(p)) === 'Bendeciré|Alma misionera', await nombres(p));
  check('banco: no pide misas', !p.requests.some(u => u.includes('/misas.json')));
  await p.close();
}
done(); c.close();
