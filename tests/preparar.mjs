import fs from 'fs';
import { connect, check, done, wait, OUT, FAKE_FIREBASE } from './cdp.mjs';
const c = await connect();
const ADMIN = { email: 'test@gmail.com' };
const viewport = async (p, name) => { const r = await p.s('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.result.data, 'base64')); };
const primerAcorde = `document.querySelector('pre c').textContent`;
const tono = `(() => { const q = id => document.getElementById(id); return { visible: !q('tono-coro').hidden, texto: q('tonoTexto').textContent, usar: q('tonoUsar').hidden ? null : q('tonoUsar').textContent, guardar: q('tonoGuardar').hidden ? null : q('tonoGuardar').textContent, capo: capoFret, transp: currentTranspose }; })()`;

// 1. Tono del coro, vista de músicos (ofert_toma empieza en SOL)
{
  const p = await c.newPage({ fake: FAKE_FIREBASE({ 'tonos/ofert_toma': { transponer: 2, capo: 0 } }), width: 390, height: 760 });
  await p.go('/cancion.html?id=ofert_toma');
  const original = await p.ev(`document.querySelector('pre c').getAttribute('data-original')`);
  check('primer acorde original es LA', original === 'LA', original);
  check('se aplica el tono del coro (+2 → SI)', (await p.ev(primerAcorde)) === 'SI');
  let t = await p.ev(tono);
  check('indicador muestra el tono', t.visible && t.texto === '🎼 Tono del coro: empieza en SI', t.texto);
  check('músico: sin botón guardar', t.guardar === null);
  await viewport(p, 'f4-tono-musico');
  await p.ev(`tonoUsar.click()`);
  t = await p.ev(tono);
  check('ver original: acordes originales', (await p.ev(primerAcorde)) === 'LA' && t.usar === 'Volver al tono del coro', JSON.stringify(t));
  await p.ev(`tonoUsar.click()`);
  check('volver al tono del coro', (await p.ev(primerAcorde)) === 'SI');
  await p.ev(`applyTransposition(1)`);
  t = await p.ev(tono);
  check('cambio a mano: lo avisa', t.texto.includes('(estás viendo otro tono)') && (await p.ev(primerAcorde)) === 'DO', t.texto);
  check('copia local guardada', (await p.ev(`localStorage.getItem('tono_ofert_toma')`)) === '{"transponer":2,"capo":0}');
  check('sin errores', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}
// 2. Tono del coro, admin: guardar y volver al original
{
  const p = await c.newPage({ fake: FAKE_FIREBASE({ 'admins/test@gmail,com': true }, ADMIN), width: 390, height: 760 });
  await p.go('/cancion.html?id=ofert_toma&admin=true');
  let t = await p.ev(tono);
  check('admin sin tono guardado: indicador oculto', !t.visible, JSON.stringify(t));
  await p.ev(`capoSelect.value = '2'; capoSelect.dispatchEvent(new Event('change')); applyTransposition(2)`);
  t = await p.ev(tono);
  check('admin con otro tono: ofrece guardar', t.visible && t.guardar === '💾 Guardar como tono del coro', JSON.stringify(t));
  if (!(await p.ev('Array.isArray(window.__writes)'))) throw new Error('Firebase falso no cargado: aborto');
  await p.ev(`tonoGuardar.click()`); await wait(300);
  check('guarda { transponer: 2, capo: 2 } (falso)', (await p.ev('JSON.stringify(__writes)')) === '[["set","tonos/ofert_toma",{"transponer":2,"capo":2}]]', await p.ev('JSON.stringify(__writes)'));
  t = await p.ev(tono);
  check('después de guardar: indicador del coro', t.texto === '🎼 Tono del coro: empieza en SI · capo 2' && t.guardar === null, JSON.stringify(t));
  await viewport(p, 'f4-tono-admin');
  await p.ev(`tonoUsar.click()`); // ver original
  t = await p.ev(tono);
  check('en el original: ofrece guardar original', t.guardar === '💾 Guardar: tono original, sin capo', JSON.stringify(t));
  await p.ev(`tonoGuardar.click()`); await wait(300);
  check('guardar original borra el tono (falso)', (await p.ev('JSON.stringify(__writes[1])')) === '["remove","tonos/ofert_toma"]');
  check('sin errores', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}
// 3. Banco: sin tono ni audios
{
  const p = await c.newPage();
  await p.go('/cancion.html?id=ofert_toma&modo=banco');
  check('banco: sin indicador de tono', await p.ev(`getComputedStyle(document.getElementById('tono-coro')).display === 'none'`));
  check('banco: sin audios', await p.ev(`getComputedStyle(document.getElementById('medios')).display === 'none'`));
  await p.close();
}
// 4. Buscar por letra
{
  const p = await c.newPage({ width: 390, height: 760 });
  await p.go('/index.html');
  await p.ev(`{ const i = document.getElementById('si'); i.value = 'en la arena he dejado'; i.dispatchEvent(new Event('input')); }`);
  await wait(2500);
  const res = await p.ev(`[...document.querySelectorAll('.song-row')].map(r => r.querySelector('.song-name').childNodes[0].textContent + ' | ' + (r.querySelector('.song-snippet')?.textContent || '')).join(' || ')`);
  check('encuentra Pescador de hombres por la letra', res.startsWith('Pescador de hombres | «En la arena he dejado mi barca»'), res);
  check('resalta la coincidencia', (await p.ev(`document.querySelector('.song-snippet mark').textContent`)) === 'En la arena he dejado');
  await p.ev(`{ const i = document.getElementById('si'); i.value = 'maria'; i.dispatchEvent(new Event('input')); }`);
  await wait(300);
  const nombres = await p.ev(`[...document.querySelectorAll('.song-row')].map(r => ({ t: r.querySelector('.song-name').childNodes[0].textContent, f: !!r.querySelector('.song-snippet') }))`);
  const primeraConFragmento = nombres.findIndex(n => n.f);
  check('primero coincidencias en el título, después en la letra', primeraConFragmento > 0 && nombres.slice(0, primeraConFragmento).every(n => /mar[ií]a/i.test(n.t)) && nombres.slice(primeraConFragmento).every(n => n.f), `${primeraConFragmento} de ${nombres.length}`);
  await viewport(p, 'f4-busqueda');
  await p.ev(`{ const i = document.getElementById('si'); i.value = 'ma'; i.dispatchEvent(new Event('input')); }`);
  check('menos de 3 letras: solo título', !(await p.ev(`!!document.querySelector('.song-snippet')`)));
  check('sin errores', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}
// 5. Compartir la misa
{
  const p = await c.newPage({ fake: FAKE_FIREBASE({ misa_actual: ['ent_bendecire', 'glo_gloria-congreso-2000', 'com_alma-misionera'] }) });
  await p.s('Page.addScriptToEvaluateOnNewDocument', { source: `navigator.share = t => { window.__compartido = t.text; return Promise.resolve(); };` });
  await p.go('/index.html');
  check('botón compartir visible en Misa de Hoy', await p.ev(`!document.getElementById('misa-share').hidden`));
  await p.ev(`btnCompartir.click()`); await wait(200);
  const texto = await p.ev('window.__compartido');
  check('texto: título y canciones por momento', texto.startsWith('🎶 *Misa de Hoy* — Coro Virgen del Carmen\n\n🚪 Entrada: Bendeciré\n✨ Gloria / Kyrie: Gloria (Congreso Eucarístico 2000)\n✝️ Comunión: Alma misionera'), JSON.stringify(texto));
  check('texto: links para músicos y fieles', texto.includes('http://127.0.0.1:8642/index.html?cat=misa') && texto.includes('http://127.0.0.1:8642/index.html?modo=banco'));
  await p.ev(`elegirCategoria('entrada')`);
  check('fuera de Misa de Hoy: botón oculto', await p.ev(`document.getElementById('misa-share').hidden`));
  await p.close();
}
{ // sin navigator.share → WhatsApp
  const p = await c.newPage({ fake: FAKE_FIREBASE({ misa_actual: ['ent_bendecire'] }) });
  await p.s('Page.addScriptToEvaluateOnNewDocument', { source: `Object.defineProperty(navigator, 'share', { value: undefined }); window.open = u => { window.__abierto = u; };` });
  await p.go('/index.html');
  await p.ev(`btnCompartir.click()`);
  check('sin share: abre wa.me', (await p.ev('window.__abierto')).startsWith('https://wa.me/?text=%F0%9F%8E%B6'));
  await p.close();
}
{ // banco: sin botón compartir
  const p = await c.newPage();
  await p.go('/index.html?modo=banco', 3000);
  check('banco: sin botón compartir', await p.ev(`document.getElementById('misa-share').hidden`));
  await p.close();
}
// 6. Audios y links
{
  const p = await c.newPage({ fake: FAKE_FIREBASE({}), width: 390, height: 760 });
  await p.go('/cancion.html?id=ofert_toma');
  check('sin medios: sección oculta', await p.ev(`document.getElementById('medios').hidden`));
  await p.ev(`renderMedios([
    { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10', etiqueta: 'Versión de referencia' },
    { url: 'https://open.spotify.com/intl-es/track/4uLU6hMCjMI75M1A2tKUQC?si=x' },
    { url: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing', etiqueta: 'Ensayo contraltos' },
    { url: 'https://ejemplo.org/toma.mp3' },
    { url: 'https://ejemplo.org/partitura.pdf', etiqueta: 'Partitura' },
    { url: 'javascript:alert(1)' }
  ])`);
  const m = await p.ev(`(() => { const l = document.getElementById('mediosLista'); return { visible: !document.getElementById('medios').hidden, n: l.children.length, yt: l.querySelector('iframe.youtube')?.src, sp: l.querySelector('iframe.spotify')?.src, dr: l.querySelector('iframe.drive')?.src, au: l.querySelector('audio')?.getAttribute('src'), link: l.querySelector('a')?.href, lazy: [...l.querySelectorAll('iframe')].every(f => f.loading === 'lazy') }; })()`);
  check('5 medios (descarta javascript:)', m.visible && m.n === 5, JSON.stringify(m));
  check('YouTube embebido sin cookies', m.yt === 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', m.yt);
  check('Spotify embebido', m.sp === 'https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC', m.sp);
  check('Drive embebido', m.dr === 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/preview', m.dr);
  check('MP3 con <audio>', m.au === 'https://ejemplo.org/toma.mp3');
  check('otro link: enlace común', m.link === 'https://ejemplo.org/partitura.pdf');
  check('iframes con carga diferida', m.lazy);
  await p.ev(`document.getElementById('medios').scrollIntoView()`); await wait(300);
  await viewport(p, 'f4-medios');
  await p.s('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }); await wait(300);
  check('sin conexión: audios ocultos', await p.ev(`document.getElementById('medios').hidden`));
  await p.s('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await p.close();
}
done(); c.close();
