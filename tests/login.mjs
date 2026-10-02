import fs from 'fs';
import { connect, check, done, wait, OUT, FAKE_FIREBASE } from './cdp.mjs';
const c = await connect();
const ADMIN = 'Coro.Admin@gmail.com';
const DB = { misa_actual: ['ent_bendecire'], 'admins/coro,admin@gmail,com': true, 'notas/ent_bendecire': 'Tono SOL' };
const panel = `(() => { const b = document.querySelector('.sesion-bar'); if (!b) return null; const btn = b.querySelector('button'); return { clase: b.className, texto: b.querySelector('.sesion-texto').textContent, boton: btn.hidden ? null : btn.textContent }; })()`;
const viewport = async (p, name) => { const r = await p.s('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.result.data, 'base64')); };

// 1. Índice admin: sin sesión → entrar → admin → cerrar sesión
{
  const p = await c.newPage({ fake: FAKE_FIREBASE(DB, null), width: 390, height: 760 });
  await p.go('/index.html?admin=true&cat=entrada');
  let st = await p.ev(panel);
  check('sin sesión: pide entrar con Google', st && st.boton === 'Entrar con Google', JSON.stringify(st));
  check('sin sesión: sin botones de edición', await p.ev(`document.getElementById('admin-bar').hidden && !document.querySelector('.admin-btn')`));
  await viewport(p, 'f3-sin-sesion');
  await p.ev(`window.__loginAs = { email: '${ADMIN}' }; document.querySelector('.sesion-bar button').click()`); await wait(400);
  st = await p.ev(panel);
  check('admin autorizado: lo muestra', st.texto === `✓ Admin: ${ADMIN}` && st.boton === 'Cerrar sesión', JSON.stringify(st));
  check('admin: aparecen barra y botones', await p.ev(`!document.getElementById('admin-bar').hidden && document.querySelectorAll('.admin-btn[data-action=add]').length > 0`));
  await viewport(p, 'f3-admin');
  await p.ev(`document.querySelector('.sesion-bar button').click()`); await wait(400);
  check('cerrar sesión: vuelve a pedir entrar', (await p.ev(panel)).boton === 'Entrar con Google');
  check('cerrar sesión: botones ocultos', await p.ev(`document.getElementById('admin-bar').hidden && !document.querySelector('.admin-btn')`));
  check('sin errores', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}
// 2. Cuenta no autorizada
{
  const p = await c.newPage({ fake: FAKE_FIREBASE(DB, { email: 'otro@gmail.com' }) });
  await p.go('/index.html?admin=true&cat=entrada');
  const st = await p.ev(panel);
  check('no autorizada: lo dice', st.texto.includes('otro@gmail.com') && st.texto.includes('no está autorizada') && st.boton === 'Cerrar sesión', JSON.stringify(st));
  check('no autorizada: sin botones', !(await p.ev(`!!document.querySelector('.admin-btn')`)));
  await p.close();
}
// 3. Canción admin: la nota se edita solo con sesión
{
  const p = await c.newPage({ fake: FAKE_FIREBASE(DB, null) });
  await p.go('/cancion.html?id=ent_bendecire&admin=true');
  check('canción sin sesión: nota visible, sin editar', await p.ev(`document.getElementById('notaTexto').textContent === 'Tono SOL' && document.getElementById('notaEditBtn').hidden`));
  await p.ev(`window.__loginAs = { email: '${ADMIN}' }; document.querySelector('.sesion-bar button').click()`); await wait(400);
  check('canción admin: botón editar', await p.ev(`!document.getElementById('notaEditBtn').hidden`));
  await p.ev(`notaEditBtn.click()`);
  await p.ev(`document.querySelector('.sesion-bar button').click()`); await wait(400);
  check('cerrar sesión: cierra el formulario de nota', await p.ev(`document.getElementById('notaForm').hidden && document.getElementById('notaEditBtn').hidden`));
  check('sin errores', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}
// 4. Músicos y banco: sin barra de sesión ni SDK de Auth (Firebase real, solo lectura)
{
  const p = await c.newPage();
  await p.go('/index.html', 3000);
  check('músicos: sin barra de sesión', (await p.ev(panel)) == null);
  check('músicos: no carga Auth', !p.requests.some(u => u.includes('firebase-auth')));
  await p.go('/cancion.html?id=ent_bendecire', 3000);
  check('canción músicos: no carga Auth', !p.requests.some(u => u.includes('firebase-auth')));
  await p.go('/cancion.html?id=ent_bendecire&modo=banco&admin=true', 3000);
  check('banco (aun con admin=true): sin barra', (await p.ev(panel)) == null);
  await p.close();
}
// 5. Admin real: carga Auth y queda sin sesión (no se puede automatizar el popup de Google)
{
  const p = await c.newPage();
  await p.go('/index.html?admin=true', 5000);
  check('admin real: carga Auth', p.requests.some(u => u.includes('firebase-auth-compat')));
  check('admin real: sin sesión pide entrar', (await p.ev(panel))?.boton === 'Entrar con Google', JSON.stringify(await p.ev(panel)));
  check('admin real: sin errores', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}
// 6. Sin conexión con Firebase
{
  const p = await c.newPage({ blockFirebase: true });
  await p.go('/index.html?admin=true');
  check('sin conexión: lo avisa', (await p.ev(panel)).clase.includes('sin-conexion'));
  await p.close();
}
done(); c.close();
