import { connect, check, done, wait, FAKE_FIREBASE } from './cdp.mjs';
const c = await connect();
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const WL_OK = `window.__wl = 0; Object.defineProperty(navigator, 'wakeLock', { value: { request: () => { window.__wl++; return Promise.resolve({ released: false }); } } });`;
const WL_FALLA = `window.__wl = 0; Object.defineProperty(navigator, 'wakeLock', { value: { request: () => { window.__wl++; return Promise.reject(new DOMException('Bajo consumo', 'NotAllowedError')); } } });`;
const video = `(() => { const v = document.querySelector('video[aria-hidden]'); return v ? { existe: true, reproduciendo: !v.paused, fuente: v.currentSrc.split('/').pop() } : { existe: false }; })()`;
const tocar = async p => {
  for (const type of ['mousePressed', 'mouseReleased']) await p.s('Input.dispatchMouseEvent', { type, x: 200, y: 600, button: 'left', clickCount: 1 });
  await wait(800);
};

// 1. Doble toque sin zoom
{
  const p = await c.newPage();
  await p.go('/index.html');
  check('índice: touch-action manipulation', (await p.ev(`getComputedStyle(document.documentElement).touchAction`)) === 'manipulation');
  await p.go('/cancion.html?id=ofert_toma');
  check('canción: touch-action manipulation', (await p.ev(`getComputedStyle(document.documentElement).touchAction`)) === 'manipulation');
  await p.close();
}
// 2. iPhone desde el ícono de inicio: video de respaldo tras un toque
{
  const p = await c.newPage({ fake: FAKE_FIREBASE({}) });
  await p.s('Emulation.setUserAgentOverride', { userAgent: IPHONE, platform: 'iPhone' });
  await p.s('Page.addScriptToEvaluateOnNewDocument', { source: WL_OK + `Object.defineProperty(navigator, 'standalone', { value: true });` });
  await p.go('/cancion.html?id=ofert_toma');
  let v = await p.ev(video);
  check('iPhone inicio: video preparado al abrir', v.existe, JSON.stringify(v));
  await tocar(p);
  v = await p.ev(video);
  check('iPhone inicio: tras un toque el video se reproduce', v.reproduciendo, JSON.stringify(v));
  check('iPhone inicio: no depende del Wake Lock', (await p.ev('window.__wl')) === 0);
  check('sin errores', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}
// 3. Wake Lock que falla (bajo consumo): pasa al video
{
  const p = await c.newPage({ fake: FAKE_FIREBASE({}) });
  await p.s('Page.addScriptToEvaluateOnNewDocument', { source: WL_FALLA });
  await p.go('/cancion.html?id=ofert_toma');
  check('Wake Lock pedido al abrir', (await p.ev('window.__wl')) === 1);
  await tocar(p);
  const v = await p.ev(video);
  check('Wake Lock rechazado: usa el video', v.existe && v.reproduciendo, JSON.stringify(v));
  check('no insiste con el Wake Lock', (await p.ev('window.__wl')) === 1, String(await p.ev('window.__wl')));
  await p.close();
}
// 4. Wake Lock que funciona (Android): sin video
{
  const p = await c.newPage({ fake: FAKE_FIREBASE({}) });
  await p.s('Page.addScriptToEvaluateOnNewDocument', { source: WL_OK });
  await p.go('/cancion.html?id=ofert_toma');
  await tocar(p);
  check('Wake Lock activo: sin video', !(await p.ev(video)).existe);
  check('Wake Lock activo: un solo pedido', (await p.ev('window.__wl')) === 1);
  await p.close();
}
// 5. Banco: nada
{
  const p = await c.newPage();
  await p.s('Emulation.setUserAgentOverride', { userAgent: IPHONE, platform: 'iPhone' });
  await p.s('Page.addScriptToEvaluateOnNewDocument', { source: WL_OK + `Object.defineProperty(navigator, 'standalone', { value: true });` });
  await p.go('/cancion.html?id=ofert_toma&modo=banco');
  await tocar(p);
  check('banco: sin video ni Wake Lock', !(await p.ev(video)).existe && (await p.ev('window.__wl')) === 0);
  await p.close();
}
// 6. Aviso "Listo para usar sin internet"
{
  const p = await c.newPage();
  await p.go('/index.html', 2000);
  await p.ev('navigator.serviceWorker.ready.then(() => true)'); await wait(4000);
  await p.go('/index.html', 2500);
  const estado = await p.ev(`(() => { const e = document.getElementById('estado-offline'); return e.hidden ? null : e.textContent; })()`);
  check('con todas las letras guardadas: muestra el aviso', estado === '📥 Listo para usar sin internet', String(estado));
  await p.ev(`caches.keys().then(async ks => { for (const k of ks) { const c = await caches.open(k); await c.delete(new URL('letras/ofert_toma.html', location.href).href); } })`);
  await p.s('Network.setBypassServiceWorker', { bypass: true }); // que la recarga no vuelva a guardar la letra
  await p.go('/index.html', 2500);
  check('si falta una letra: no lo muestra', await p.ev(`document.getElementById('estado-offline').hidden`));
  await p.close();
}
done(); c.close();
