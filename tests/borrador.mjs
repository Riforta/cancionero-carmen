// Borrador de la misa guardado en el celular, botón "Agregar a la Misa de
// Hoy" dentro de la canción y respuesta del botón + del índice
import { connect, check, done, wait, FAKE_FIREBASE } from './cdp.mjs';
const c = await connect();
const ADMIN = { email: 'test@gmail.com' };
const PUBLICADA = ['ent_bendecire', 'com_alma-misionera'];
const DB = () => ({ misa_actual: PUBLICADA, 'admins/test@gmail,com': true });
const borrador = async p => JSON.parse(await p.ev(`localStorage.getItem('misa_borrador')`) || 'null');
const flotante = p => p.ev(`(() => { const a = document.getElementById('aviso-flotante'); return a && a.classList.contains('visible') ? a.textContent : null; })()`);
const boton = (p, id) => p.ev(`(() => { const b = document.querySelector('.admin-btn.btn-mas[data-song-id="${id}"]'); return b ? { texto: b.textContent, accion: b.dataset.action, enMisa: b.classList.contains('en-misa'), ancho: b.offsetWidth } : null; })()`);
const guardia = async p => { if (!(await p.ev('Array.isArray(window.__writes)'))) throw new Error('Firebase falso no cargado: aborto'); };

{ // Admin con sesión: de la canción al índice y a publicar
  const p = await c.newPage({ fake: FAKE_FIREBASE(DB(), ADMIN), width: 390, height: 800 });
  await p.go('/index.html?admin=true', 800);
  await p.ev(`localStorage.removeItem('misa_borrador')`);

  await p.go('/cancion.html?id=ofert_toma&admin=true&cat=todas');
  const antes = await p.ev(`({ visible: !document.getElementById('misa-agregar').hidden, texto: misaAgregarBtn.textContent, pendiente: !misaPendiente.hidden })`);
  check('canción: botón "Agregar a la Misa de Hoy"', antes.visible && antes.texto.startsWith('➕') && !antes.pendiente, JSON.stringify(antes));
  await p.ev(`misaAgregarBtn.click()`); await wait(200);
  const despues = await p.ev(`({ texto: misaAgregarBtn.textContent, activo: misaAgregarBtn.classList.contains('active'), pressed: misaAgregarBtn.getAttribute('aria-pressed'), pendiente: !misaPendiente.hidden, link: misaIrPublicar.getAttribute('href') })`);
  check('canción: al tocar pasa a "✓ En la Misa de Hoy"', despues.texto.startsWith('✓') && despues.activo && despues.pressed === 'true', JSON.stringify(despues));
  check('canción: "Falta publicar" con link a Misa de Hoy', despues.pendiente && despues.link === 'index.html?admin=true&cat=misa', despues.link);
  check('canción: aviso flotante con "Ir a publicar"', ((await flotante(p)) || '').includes('Agregada a la Misa de Hoy (3)') && ((await flotante(p)) || '').includes('Ir a publicar'), String(await flotante(p)));
  const b1 = await borrador(p);
  check('borrador: la canción entra en su momento, con la base publicada', JSON.stringify(b1) === JSON.stringify({ ids: ['ent_bendecire', 'ofert_toma', 'com_alma-misionera'], base: PUBLICADA }), JSON.stringify(b1));
  await guardia(p);
  check('agregar desde la canción no publica', (await p.ev('__writes.length')) === 0);

  await p.go('/index.html?admin=true&cat=misa');
  check('índice: muestra el borrador', (await p.ev('JSON.stringify(misaIds)')) === JSON.stringify(b1.ids) && (await p.ev('misaSinPublicar')) === true);
  check('índice: aviso de cambios sin publicar', !(await p.ev(`document.getElementById('misa-pendiente').hidden`)));
  check('índice: no confunde el borrador con otra versión publicada', await p.ev(`document.getElementById('aviso-misa').hidden`));

  // El + del índice: se nota y alterna
  await p.ev(`elegirCategoria('entrada')`);
  const ya = await boton(p, 'ent_bendecire');
  check('+ de una canción que ya está: ✓ dorado', ya && ya.texto === '✓' && ya.enMisa && ya.accion === 'remove', JSON.stringify(ya));
  const mas = await boton(p, 'ent_ven-hermano');
  check('+ cómodo para el dedo (40 px)', mas && mas.texto === '+' && mas.ancho >= 40, JSON.stringify(mas));
  await p.ev(`document.querySelector('.admin-btn[data-song-id="ent_ven-hermano"]').click()`); await wait(150);
  const tras = await boton(p, 'ent_ven-hermano');
  check('tocar +: pasa a ✓', tras.texto === '✓' && tras.enMisa, JSON.stringify(tras));
  check('tocar +: aviso flotante con la cantidad', ((await flotante(p)) || '').includes('Agregada a la Misa de Hoy (4)'), String(await flotante(p)));
  check('tocar +: salta el contador de Misa de Hoy', await p.ev(`document.querySelector('.cat-chip[data-cat="misa"] .chip-count').classList.contains('pulso')`));
  await p.ev(`document.querySelector('.admin-btn[data-song-id="ent_ven-hermano"]').click()`); await wait(150);
  check('tocar ✓: la quita', (await boton(p, 'ent_ven-hermano')).texto === '+' && !(await p.ev(`misaIds.includes('ent_ven-hermano')`)));

  await p.go('/index.html?admin=true&cat=misa');
  check('el borrador sobrevive a la recarga', (await p.ev('JSON.stringify(misaIds)')) === JSON.stringify(b1.ids));
  await p.ev(`__db.misa_actual = ['mar_magnificat']; __emit('misa_actual')`); await wait(200);
  check('otro admin publica: aviso y no pisa el borrador', !(await p.ev(`document.getElementById('aviso-misa').hidden`)) && (await p.ev('JSON.stringify(misaIds)')) === JSON.stringify(b1.ids));

  await p.go('/index.html?admin=true&cat=misa');
  await guardia(p);
  p.dialogs.length = 0;
  await p.ev('publicarMisa()'); await wait(400);
  check('publicar guarda el borrador', (await p.ev('JSON.stringify(__writes[0])')) === JSON.stringify(['update', 'misa_actual', b1.ids]), await p.ev('JSON.stringify(__writes)'));
  check('publicar borra el borrador', (await borrador(p)) === null && (await p.ev('misaSinPublicar')) === false && (await p.ev(`document.getElementById('misa-pendiente').hidden`)));
  check('publicar: aviso flotante, sin alert', ((await flotante(p)) || '').includes('Misa publicada') && p.dialogs.length === 0, p.dialogs.join(' | '));

  // Agregar y quitar deja todo como estaba: no queda nada por publicar
  await p.go('/cancion.html?id=ofert_toma&admin=true');
  await p.ev(`misaAgregarBtn.click()`); await wait(100);
  check('agregar: queda borrador', (await borrador(p)) !== null);
  await p.ev(`misaAgregarBtn.click()`); await wait(100);
  check('quitar enseguida: sin borrador ni "Falta publicar"', (await borrador(p)) === null && (await p.ev('misaPendiente.hidden')));
  check('sin errores', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}
{ // Sin sesión, músicos y banco: no hay botón ni borrador
  const p = await c.newPage({ fake: FAKE_FIREBASE(DB(), null) });
  await p.ev(`0`);
  await p.go('/cancion.html?id=ofert_toma&admin=true');
  check('admin sin sesión: sin botón', await p.ev(`document.getElementById('misa-agregar').hidden`));
  await p.ev(`localStorage.setItem('misa_borrador', JSON.stringify({ ids: ['mar_magnificat'], base: [] }))`);
  await p.go('/cancion.html?id=ofert_toma');
  check('músicos: sin botón', await p.ev(`document.getElementById('misa-agregar').hidden`));
  await p.go('/index.html');
  check('músicos: el índice muestra la misa publicada, no el borrador', (await p.ev('JSON.stringify(misaIds)')) === JSON.stringify(PUBLICADA), await p.ev('JSON.stringify(misaIds)'));
  await p.ev(`localStorage.removeItem('misa_borrador')`);
  await p.close();
  const b = await c.newPage({ rest: { misa_actual: PUBLICADA } });
  await b.go('/cancion.html?id=ofert_toma&modo=banco&admin=true');
  check('banco: sin botón', await b.ev(`getComputedStyle(document.getElementById('misa-agregar')).display === 'none'`));
  await b.close();
}
done(); c.close();
