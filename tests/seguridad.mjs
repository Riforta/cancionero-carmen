import { connect, check, done } from './cdp.mjs';
const c = await connect();
const p = await c.newPage();
await p.s('Page.addScriptToEvaluateOnNewDocument', { source: `window.__xss = 0; window.alert = () => { window.__xss++; };` });
const ataques = [
  '<img src=x onerror=alert(1)>',
  '"><svg onload=alert(1)>',
  '../qr',
  'x</b><img src=x onerror=alert(1)>'
];
for (const a of ataques) {
  await p.go('/cancion.html?admin=true&id=' + encodeURIComponent(a), 1500);
  const r = await p.ev(`({ xss: window.__xss, img: document.querySelectorAll('#letra-box img, #letra-box svg').length, texto: document.querySelector('.error-msg b')?.textContent })`);
  check(`no ejecuta: ${a}`, r.xss === 0 && r.img === 0 && r.texto === 'letras/' + a + '.html', JSON.stringify(r));
}
await p.go('/cancion.html?id=ofert_toma', 1500);
check('canción normal sigue cargando', (await p.ev(`document.querySelectorAll('pre c[data-original]').length`)) > 10);
await p.go('/cancion.html?id=no_existe', 1500);
check('id válido inexistente: mensaje de error', (await p.ev(`document.querySelector('.error-msg b')?.textContent`)) === 'letras/no_existe.html');
check('sin errores', p.errors.length === 0, p.errors.join(' | '));
done(); c.close();
