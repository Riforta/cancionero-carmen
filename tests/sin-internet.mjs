import fs from 'fs';
import { connect, check, done, wait, OUT } from './cdp.mjs';
const c = await connect();
const p = await c.newPage({ width: 390, height: 760 });
const offline = async v => {
  await p.s('Network.emulateNetworkConditions', { offline: v, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  return c.swOffline(v);
};
const viewport = async name => { const r = await p.s('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.result.data, 'base64')); };

// 1. Primera visita con conexión: se instala el service worker
await p.go('/index.html', 4000);
await p.ev(`navigator.serviceWorker.ready.then(() => true)`);
await wait(4000); // precache de letras
const cache = await p.ev(`caches.keys().then(async ks => { const c = await caches.open(ks.find(k => k.startsWith('cancionero-'))); const keys = (await c.keys()).map(r => r.url); return { claves: ks, total: keys.length, letras: keys.filter(u => u.includes('/letras/')).length, gstatic: keys.filter(u => u.includes('gstatic.com/firebasejs')).length, fuentes: keys.filter(u => u.includes('fonts.googleapis')).length, woff: keys.filter(u => u.includes('fonts.gstatic.com')).length }; })`);
const totalSongs = await p.ev('SONGS.length');
check('service worker activo', (await p.ev('navigator.serviceWorker.ready.then(r => !!r.active)')) === true);
check('todas las letras guardadas', cache.letras === totalSongs, `${cache.letras}/${totalSongs}`);
check('SDK de Firebase guardado', cache.gstatic >= 2, String(cache.gstatic));
check('CSS de fuentes guardado', cache.fuentes >= 1, String(cache.fuentes));
check('archivos de las fuentes guardados al instalar', cache.woff >= 2, String(cache.woff));
const manifest = await p.ev(`fetch('manifest.webmanifest').then(r => r.json()).then(m => m.icons.length + ' ' + m.display)`);
check('manifest válido', manifest === '2 standalone', manifest);
check('aviso oculto con conexión', await p.ev(`document.querySelector('.aviso-offline').hidden`));

// Recargar ya controlado por el SW y abrir una canción (deja copias: misa, nota)
await p.go('/index.html', 4000);
check('página controlada por el SW', await p.ev('!!navigator.serviceWorker.controller'));
const misaOnline = await p.ev(`document.getElementById('cnt').textContent`);
const misaIds = await p.ev('JSON.stringify(misaIds)');
await p.go(`/cancion.html?id=${JSON.parse(misaIds)[0]}&cat=misa`, 4000);
await p.ev(`localStorage.setItem('nota_ador_noche-oscura-jesed', JSON.stringify('Tono RE, empieza el coro'))`);

// 2. Con conexión, el HTML sale de la copia y se actualiza desde la red
const sw = await c.swOffline(false);
await p.go('/index.html', 3000);
check('con conexión: el SW actualiza index.html desde la red', sw.reqs.some(u => u.endsWith('/index.html')), sw.reqs.filter(u => u.includes('8642')).join(' '));

// 3. Sin conexión
await offline(true);
await p.go('/index.html', 3000);
check('sin conexión: índice carga', (await p.ev(`document.querySelectorAll('.song-row').length`)) > 0);
check('sin conexión: misa desde la copia', (await p.ev(`document.getElementById('cnt').textContent`)) === misaOnline, misaOnline);
check('sin conexión: aviso visible', await p.ev(`!document.querySelector('.aviso-offline').hidden`));
await viewport('f2-offline-index');
await p.go('/cancion.html?id=ador_noche-oscura-jesed', 3000);
check('sin conexión: canción nunca abierta carga', (await p.ev(`document.querySelectorAll('pre c[data-original]').length`)) > 50);
check('sin conexión: título', (await p.ev(`document.getElementById('song-title').textContent`)) === 'Noche oscura (Jesed)');
check('sin conexión: nota desde la copia', (await p.ev(`document.getElementById('notaTexto').textContent`)) === 'Tono RE, empieza el coro');
check('sin conexión: fuentes cargadas', await p.ev(`document.fonts.check('16px "EB Garamond"')`));
await viewport('f2-offline-cancion');
const segunda = JSON.parse(misaIds)[1];
await p.go(`/cancion.html?id=${segunda}&cat=misa&modo=banco`, 3000);
check('sin conexión banco: anterior/siguiente desde la copia', (await p.ev('misaPos.textContent')) === `2 / ${JSON.parse(misaIds).length}`);
await p.go('/index.html?modo=banco', 3000);
check('sin conexión banco: misa desde la copia', (await p.ev(`document.getElementById('cnt').textContent`)) === misaOnline);
await p.go('/index.html?admin=true', 3000);
p.dialogs.length = 0;
await p.ev(`publicarMisa()`); await wait(300);
check('sin conexión: publicar avisa', p.dialogs.some(d => d.includes('Sin conexión')), p.dialogs.join(' | '));
check('sin errores de JS', p.errors.length === 0, p.errors.join(' | '));

// 4. Vuelve la conexión: el aviso se oculta
await offline(false);
await wait(500);
check('con conexión otra vez: aviso oculto', await p.ev(`document.querySelector('.aviso-offline').hidden`));

// 5. Red lenta (4 s por pedido): la página sale de la copia sin esperar
await c.swOffline(false, 4000);
await p.go('/cancion.html?id=ofert_toma', 1500);
check('red lenta: la canción carga al instante desde la copia', (await p.ev(`document.getElementById('song-title').textContent`)) === 'Toma' && (await p.ev(`document.querySelectorAll('pre c[data-original]').length`)) > 5);
await p.go('/index.html?cat=todas', 1500);
check('red lenta: el índice carga al instante desde la copia', (await p.ev(`document.querySelectorAll('.song-row').length`)) === totalSongs);
await c.swOffline(false, 0);
await wait(5000);   // terminan las actualizaciones lentas en segundo plano

// 6. Versión nueva del sitio: se simula dejando en la caché una copia vieja de
// index.html (una página mínima con offline.js). Tiene que ser el documento:
// los CSS y JS ya usados en esta pestaña salen de la memoria del navegador
const envejecer = `caches.keys().then(ks => caches.open(ks.find(k => k.startsWith('cancionero-')))).then(c => c.put(location.origin + '/index.html', new Response('<!doctype html><title>copia vieja</title><header></header><script src="offline.js"></scr' + 'ipt>', { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Last-Modified': 'Mon, 01 Jan 2001 00:00:00 GMT' } }))).then(() => true)`;
const esLaNueva = () => p.ev(`document.title !== 'copia vieja' && !!document.getElementById('list')`);
await p.ev(`sessionStorage.removeItem('recarga_version')`);
await p.ev(envejecer);
await p.go('/index.html', 4000);
check('versión nueva, página recién abierta: se recarga sola', (await p.ev(`sessionStorage.getItem('recarga_version') !== null`)) && (await esLaNueva()));
await p.ev(envejecer);
await p.go('/index.html', 3000);
check('otra versión enseguida: aviso con botón, sin recargar sola', await p.ev(`document.title === 'copia vieja' && !!document.querySelector('.aviso-version button')`));
await p.ev(`document.querySelector('.aviso-version button').click()`); await wait(2500);
check('"Actualizar" trae la versión nueva', (await esLaNueva()) && !(await p.ev(`!!document.querySelector('.aviso-version')`)));
check('sin errores de JS al final', p.errors.length === 0, p.errors.join(' | '));
done(); c.close();
