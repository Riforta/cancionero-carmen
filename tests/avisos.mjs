// Avisos del coro: avisos.html y "Próximos avisos" del índice
import fs from 'fs';
import { connect, check, done, wait, OUT, FAKE_FIREBASE } from './cdp.mjs';
const c = await connect();
const ADMIN = { email: 'test@gmail.com', displayName: 'Mateo Prueba' };
const DB = {
  'admins/test@gmail,com': true,
  'avisos/a1': { fecha: '2026-10-08', hora: '20:00', tipo: 'ensayo', titulo: 'Ensayo general', lugar: 'Salón parroquial', detalle: 'Traer las carpetas' },
  'avisos/a2': { fecha: '2026-09-30', hora: '19:00', tipo: 'ensayo', titulo: 'Ensayo que ya pasó', lugar: '', detalle: '' },
  'avisos/a3': { fecha: '2026-11-01', hora: '', tipo: 'celebracion', titulo: 'Misa de Todos los Santos <img src=x onerror=alert(1)>', lugar: '', detalle: '' }
};
const fecha = p => p.s('Page.addScriptToEvaluateOnNewDocument', { source: `window.FECHA_PRUEBA = '2026-10-04'; window.__alertas = 0; window.alert = () => { window.__alertas++; };` });
const lista = `[...document.querySelectorAll('#listaAvisos .mes, #listaAvisos .aviso-titulo')].map(e => e.textContent.trim())`;

// 1. Músicos: lista, orden, fiestas, sin pasados, .ics
{
  const p = await c.newPage({ fake: FAKE_FIREBASE(DB), width: 390, height: 900 });
  await fecha(p);
  await p.go('/avisos.html');
  const l = await p.ev(lista);
  check('lista por mes y en orden, con fiestas y sin lo pasado', JSON.stringify(l) === JSON.stringify(['octubre 2026', '🎶 Ensayo general', 'noviembre 2026', '⛪ Misa de Todos los Santos <img src=x onerror=alert(1)>', '✝️ Todos los Santos', '✝️ Jesucristo, Rey del Universo']), JSON.stringify(l));
  check('el título se muestra como texto (sin HTML)', !(await p.ev(`!!document.querySelector('#listaAvisos img')`)) && (await p.ev('window.__alertas')) === 0);
  check('datos del aviso: hora, lugar y tipo', (await p.ev(`document.querySelector('.aviso-datos').textContent`)) === '20:00 h · Salón parroquial · Ensayo');
  check('músico: sin botones de editar', !(await p.ev(`!!document.querySelector('[data-accion=editar]')`)));
  const ics = await p.ev('icsDe(eventos[0])');
  check('.ics con hora: 20:00 a 21:00, título y lugar', ics.includes('DTSTART:20261008T200000') && ics.includes('DTEND:20261008T210000') && ics.includes('SUMMARY:Ensayo general') && ics.includes('LOCATION:Salón parroquial') && ics.includes('\r\n'), ics.split('\r\n').join(' | '));
  const icsDia = await p.ev('icsDe(eventos.find(e => e.tipo === "liturgia"))');
  check('.ics de día completo para las fiestas', icsDia.includes('DTSTART;VALUE=DATE:20261101') && icsDia.includes('DTEND;VALUE=DATE:20261102'));
  const r = await p.s('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${OUT}/avisos-musico.png`, Buffer.from(r.result.data, 'base64'));
  check('sin errores', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}
// 2. Admin: agregar, editar, borrar, validar
{
  const p = await c.newPage({ fake: FAKE_FIREBASE(DB, ADMIN), width: 390, height: 900, dialogAccept: true });
  await fecha(p);
  await p.go('/avisos.html?admin=true');
  if (!(await p.ev('Array.isArray(window.__writes)'))) throw new Error('Firebase falso no cargado: aborto');
  check('admin: botón "Nuevo aviso"', !(await p.ev(`document.getElementById('nuevoAviso').hidden`)));
  await p.ev(`nuevoAviso.click(); fTitulo.value = ''; formAviso.requestSubmit()`); await wait(200);
  check('sin título no guarda (lo frena el navegador: required)', (await p.ev('__writes.length')) === 0 && !(await p.ev('formAviso.hidden')));
  await p.ev(`fFecha.value = '2026-10-15'; fHora.value = '19:30'; fTipo.value = 'aviso'; fTitulo.value = 'Reunión del coro'; fLugar.value = 'Capilla'; fDetalle.value = 'Organizamos la fiesta patronal'; formAviso.requestSubmit()`); await wait(300);
  const w1 = await p.ev('JSON.stringify(__writes[0])');
  check('nuevo aviso guardado con push', w1 === '["set","avisos/-k1",{"fecha":"2026-10-15","hora":"19:30","tipo":"aviso","titulo":"Reunión del coro","lugar":"Capilla","detalle":"Organizamos la fiesta patronal"}]', w1);
  check('aparece en la lista y el formulario se cierra', (await p.ev(lista)).includes('📢 Reunión del coro') && (await p.ev('formAviso.hidden')));
  await p.ev(`document.querySelector('[data-accion=editar]').click()`);
  check('editar carga los datos en el formulario', (await p.ev('fTitulo.value')) === 'Ensayo general' && (await p.ev('fHora.value')) === '20:00');
  await p.ev(`fTitulo.value = 'Ensayo general (cambia el horario)'; fHora.value = '20:30'; formAviso.requestSubmit()`); await wait(300);
  check('editar guarda sobre el mismo aviso', (await p.ev('JSON.stringify(__writes[1].slice(0, 2))')) === '["set","avisos/a1"]' && (await p.ev('__writes[1][2].hora')) === '20:30');
  const nBorrar = await p.ev(`[...document.querySelectorAll('[data-accion=borrar]')].length`);
  await p.ev(`[...document.querySelectorAll('.aviso')].find(a => a.textContent.includes('Todos los Santos <img')).querySelector('[data-accion=borrar]').click()`); await wait(300);
  check('borrar (con confirmación)', (await p.ev('JSON.stringify(__writes[2])')) === '["remove","avisos/a3"]' && (await p.ev(`[...document.querySelectorAll('[data-accion=borrar]')].length`)) === nBorrar - 1);
  check('las fiestas litúrgicas no se pueden editar', (await p.ev(`[...document.querySelectorAll('.aviso.liturgia [data-accion=editar]')].length`)) === 0);
  const r = await p.s('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${OUT}/avisos-admin.png`, Buffer.from(r.result.data, 'base64'));
  check('sin errores', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}
// 3. Sin conexión: muestra la copia local
{
  const p = await c.newPage({ blockFirebase: true });
  await fecha(p);
  await p.go('/avisos.html');
  check('sin conexión: avisos desde la copia local', (await p.ev(lista)).some(t => t.includes('Ensayo general')));
  await p.close();
}
// 4. Banco: no hay avisos
{
  const p = await c.newPage({ rest: { misa_actual: [] } });
  await p.go('/avisos.html?modo=banco', 2000);
  check('banco: avisos.html vuelve al índice', (await p.ev('location.pathname + location.search')).endsWith('/index.html?modo=banco'));
  check('banco: el índice no muestra "Próximos avisos"', await p.ev(`document.getElementById('proximos').hidden`));
  await p.close();
}
// 5. Índice: "Próximos avisos"
{
  const p = await c.newPage({ fake: FAKE_FIREBASE(DB), width: 390, height: 900 });
  await fecha(p);
  await p.go('/index.html?cat=todas');
  const items = await p.ev(`[...document.querySelectorAll('#proximosLista li')].map(li => li.textContent)`);
  check('índice: los próximos 3 (30 días), con fecha corta y hora', JSON.stringify(items) === JSON.stringify(['jue 8/10 · 20:00🎶 Ensayo general', 'dom 1/11⛪ Misa de Todos los Santos <img src=x onerror=alert(1)>', 'dom 1/11✝️ Todos los Santos']), JSON.stringify(items));
  check('índice: link a avisos.html con el contexto', (await p.ev(`document.getElementById('proximos').getAttribute('href')`)) === 'avisos.html?cat=todas');
  const r = await p.s('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${OUT}/avisos-indice.png`, Buffer.from(r.result.data, 'base64'));
  check('sin errores', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}
done(); c.close();
