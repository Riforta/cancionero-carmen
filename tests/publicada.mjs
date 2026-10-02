// "Publicada por … · sáb 3/10, 19:40": quién publicó la misa y cuándo
import { connect, check, done, wait, FAKE_FIREBASE } from './cdp.mjs';
const c = await connect();
const ADMIN = { email: 'test@gmail.com', displayName: 'Mateo Prueba' };
const META = { por: 'Ana', cuando: new Date(2026, 9, 3, 19, 40).getTime() };   // sáb 3/10/2026 19:40 (hora local)
const texto = `(() => { const m = document.getElementById('misa-meta'); return m.hidden ? null : m.textContent; })()`;

{ // Publicar guarda misa y quién/cuándo en una sola operación
  const p = await c.newPage({ fake: FAKE_FIREBASE({ misa_actual: ['ent_bendecire'], 'admins/test@gmail,com': true }, ADMIN) });
  await p.go('/index.html?admin=true');
  if (!(await p.ev('Array.isArray(window.__writes)'))) throw new Error('Firebase falso no cargado: aborto');
  const antes = Date.now();
  await p.ev(`addToMisa('com_alma-misionera'); publicarMisa()`); await wait(400);
  const w = await p.ev('__writes');
  check('una operación con misa_actual y misa_meta', w.length === 2 && w[0][0] === 'update' && w[0][1] === 'misa_actual' && w[1][1] === 'misa_meta', JSON.stringify(w));
  check('misa_meta: nombre del admin y hora del servidor', w[1][2].por === 'Mateo Prueba' && w[1][2].cuando >= antes, JSON.stringify(w[1][2]));
  check('se muestra "Publicada por Mateo Prueba"', ((await p.ev(texto)) || '').startsWith('Publicada por Mateo Prueba · '), String(await p.ev(texto)));
  check('sin errores', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}
{ // Músicos: ven quién publicó, solo en Misa de Hoy
  const p = await c.newPage({ fake: FAKE_FIREBASE({ misa_actual: ['ent_bendecire'], misa_meta: META }) });
  await p.go('/index.html');
  check('músicos: "Publicada por Ana · sáb 3/10, 19:40"', (await p.ev(texto)) === 'Publicada por Ana · sáb 3/10, 19:40', String(await p.ev(texto)));
  await p.ev(`elegirCategoria('entrada')`);
  check('fuera de Misa de Hoy no se muestra', (await p.ev(texto)) == null);
  await p.close();
}
{ // Sin datos de publicación: no se muestra nada
  const p = await c.newPage({ fake: FAKE_FIREBASE({ misa_actual: ['ent_bendecire'] }) });
  await p.go('/index.html');
  check('sin misa_meta: oculto', (await p.ev(texto)) == null);
  await p.close();
}
{ // Banco: no lo pide ni lo muestra
  const p = await c.newPage({ rest: { misa_actual: ['ent_bendecire'], misa_meta: META } });
  await p.go('/index.html?modo=banco', 2500);
  check('banco: no pide misa_meta', !p.requests.some(u => u.includes('misa_meta')));
  check('banco: no lo muestra', (await p.ev(texto)) == null);
  await p.close();
}
done(); c.close();
