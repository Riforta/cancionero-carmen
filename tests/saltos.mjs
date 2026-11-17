// La página no se corre hacia abajo cuando aparecen la barra de sesión del
// admin, sus botones de edición o el botón "Agregar a la Misa de Hoy".
//
// Se mide el alto de los bloques que aparecen (barra de sesión, botones de
// edición, botón de la misa) dos veces:
// 1. antes de que corra el JS de la página (cuando el HTML agrega el primer
//    <script> del final del body), que es lo que se pinta primero;
// 2. cuando ya terminó de cargar todo (sesión confirmada, datos).
// Si el alto no cambió, ese bloque no empujó la página. Margen de 3 px: el
// texto puede cambiar un poco cuando terminan de cargar las fuentes.
import { connect, check, done, wait, FAKE_FIREBASE } from './cdp.mjs';
const c = await connect();
const ADMIN = { email: 'gromateo.prueba@gmail.com', displayName: 'Admin Prueba' };
const DB = { misa_actual: ['ent_bendecire', 'ofert_toma'], 'admins/gromateo,prueba@gmail,com': true, 'tonos/ofert_toma': null };

// Alto que ocupa cada bloque, con sus márgenes (0 si no está)
const ALTOS = sel => `${JSON.stringify(sel)}.map(s => { const el = document.querySelector(s); if (!el) return 0; const cs = getComputedStyle(el); return el.getBoundingClientRect().height + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom); })`;
const sonda = sel => `
  window.__antes = null;
  new MutationObserver((cambios, obs) => {
    if (document.querySelector('body script[src]')) { window.__antes = ${ALTOS(sel)}; obs.disconnect(); }
  }).observe(document, { childList: true, subtree: true });`;

async function medir({ url, bloques, auth = null, recordada = null, borrador = null }) {
  const p = await c.newPage({ fake: FAKE_FIREBASE(DB, auth), width: 390, height: 800 });
  await p.go('/index.html', 300);
  await p.ev(`localStorage.clear(); localStorage.setItem('tema', 'light');` +
    (recordada ? `localStorage.setItem('sesion_admin', ${JSON.stringify(JSON.stringify(recordada))});` : '') +
    (borrador ? `localStorage.setItem('misa_borrador', ${JSON.stringify(JSON.stringify(borrador))});` : ''));
  await p.s('Page.addScriptToEvaluateOnNewDocument', { source: sonda(bloques) });
  await p.go(url, 2500);
  await p.ev('document.fonts.ready.then(() => true)');
  const r = await p.ev(`({ antes: window.__antes, despues: ${ALTOS(bloques)} })`);
  r.bloques = bloques;
  r.errores = p.errors.slice();
  r.ev = p.ev;
  r.cerrar = async () => { await p.ev('localStorage.clear()'); await p.close(); };
  return r;
}
const sinSalto = r => Array.isArray(r.antes) && r.antes.every((h, i) => Math.abs(r.despues[i] - h) <= 3);
const det = r => r.bloques.map((b, i) => `${b}: ${r.antes ? r.antes[i].toFixed(0) : '?'} → ${r.despues[i].toFixed(0)}`).join(', ');
const CANCION = ['#sesion-slot', '#misa-agregar', '#nota'];

{ // Canción, admin con sesión recordada: barra y botón de la misa al instante
  const r = await medir({ url: '/cancion.html?id=ofert_toma&admin=true', bloques: CANCION, auth: ADMIN, recordada: { email: ADMIN.email, nombre: ADMIN.displayName } });
  check('canción admin: barra, botón de la misa y nota no empujan la página', sinSalto(r), det(r));
  check('canción admin: barra de sesión y botón de la misa visibles', await r.ev(`document.querySelector('.sesion-bar.admin') && !document.getElementById('misa-agregar').hidden`));
  check('canción admin: sin errores', r.errores.length === 0, r.errores.join(' | '));
  await r.cerrar();
}
{ // Canción en la misa, con borrador pendiente: "✓ En la Misa de Hoy" y "Falta publicar"
  const r = await medir({ url: '/cancion.html?id=ofert_toma&admin=true&cat=misa', bloques: CANCION, auth: ADMIN, recordada: { email: ADMIN.email }, borrador: { ids: ['ent_bendecire', 'ofert_toma', 'com_alma-misionera'], base: ['ent_bendecire', 'ofert_toma'] } });
  check('canción en la misa: no empuja la página', sinSalto(r), det(r));
  check('canción en la misa: muestra "✓ En la Misa de Hoy" y "Falta publicar"', (await r.ev('misaAgregarBtn.textContent')).startsWith('En la Misa de Hoy') && !(await r.ev(`misaPendiente.classList.contains('oculta')`)));
  const alto1 = await r.ev(`document.querySelector('pre').getBoundingClientRect().top + scrollY`);
  await r.ev('misaAgregarBtn.click()'); await wait(150);
  check('quitar de la misa: la letra no se corre', Math.abs((await r.ev(`document.querySelector('pre').getBoundingClientRect().top + scrollY`)) - alto1) < 1);
  await r.cerrar();
}
{ // Primera vez en este celular (sin sesión recordada): la barra igual tiene su lugar
  const r = await medir({ url: '/cancion.html?id=ofert_toma&admin=true', bloques: ['#sesion-slot'], auth: null });
  check('canción admin sin sesión: la barra no empuja la página', sinSalto(r), det(r));
  check('canción admin sin sesión: botón "Entrar con Google"', (await r.ev(`document.querySelector('.sesion-bar .sesion-btn').textContent`)) === 'Entrar con Google');
  await r.cerrar();
}
{ // Índice, admin con sesión recordada: barra y botones de publicar
  const r = await medir({ url: '/index.html?admin=true&cat=entrada', bloques: ['#sesion-slot', '#admin-bar'], auth: ADMIN, recordada: { email: ADMIN.email } });
  check('índice admin: barra y botones de publicar no empujan la página', sinSalto(r), det(r));
  check('índice admin: botones de publicar visibles', !(await r.ev(`document.getElementById('admin-bar').hidden`)));
  await r.cerrar();
}
{ // Avisos, admin con sesión recordada
  const r = await medir({ url: '/avisos.html?admin=true', bloques: ['#sesion-slot', '.avisos-acciones'], auth: ADMIN, recordada: { email: ADMIN.email } });
  check('avisos admin: barra y "Nuevo aviso" no empujan la página', sinSalto(r), det(r));
  await r.cerrar();
}
{ // La sesión recordada ya no es admin: se corrige sola
  const r = await medir({ url: '/cancion.html?id=ofert_toma&admin=true', bloques: CANCION, auth: { email: 'otra@gmail.com' }, recordada: { email: 'otra@gmail.com' } });
  check('sesión recordada que ya no es admin: se corrige y se olvida', (await r.ev(`document.getElementById('misa-agregar').hidden && !esAdminOk && localStorage.getItem('sesion_admin') === null`)));
  await r.cerrar();
}
{ // Músicos y banco: no se reserva nada
  const r = await medir({ url: '/cancion.html?id=ofert_toma', bloques: ['#sesion-slot'] });
  check('músicos: sin lugar de sesión', await r.ev(`getComputedStyle(document.getElementById('sesion-slot')).display === 'none'`));
  await r.cerrar();
}
done(); c.close();
