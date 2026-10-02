import { connect, check, done, wait, FAKE_FIREBASE } from './cdp.mjs';
const c = await connect();

// 1. Índice músico con Firebase real (solo lectura)
{
  const p = await c.newPage();
  await p.go('/index.html', 4000);
  const misa = await p.ev(`document.getElementById('cnt').textContent`);
  check('índice: Misa de Hoy carga desde Firebase', /\d+ canciones/.test(misa) && !misa.startsWith('0'), misa);
  check('índice: usa SDK en vivo (websocket)', p.requests.some(u => u.startsWith('WS ')));
  await p.ev(`fc('carmelitanos')`);
  check('índice: categoría Carmelitanos', (await p.ev(`document.querySelectorAll('.song-row').length`)) === 14);
  await p.ev(`fc('carmelitanos'); const i = document.getElementById('si'); i.value = 'pastor'; i.dispatchEvent(new Event('input'))`);
  check('índice: búsqueda por título', (await p.ev(`[...document.querySelectorAll('.song-name')].map(e => e.textContent).join('|')`)).includes('El Señor es mi Pastor'));
  check('índice: chips con contadores', (await p.ev(`document.querySelectorAll('.cat-chip').length`)) >= 10);
  check('índice: sin errores', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}
// 2. Índice banco: REST, sin SDK ni websocket
{
  const p = await c.newPage();
  await p.go('/index.html?modo=banco', 4000);
  check('banco: misa cargada', !(await p.ev(`document.getElementById('cnt').textContent`)).startsWith('0'));
  check('banco: lee por REST', p.requests.some(u => u.includes('firebaseio.com/misa_actual.json')));
  check('banco: no descarga el SDK', !p.requests.some(u => u.includes('gstatic.com/firebasejs')));
  check('banco: sin websocket', !p.requests.some(u => u.startsWith('WS ')));
  check('banco: typeof firebase', (await p.ev('typeof firebase')) === 'undefined');
  check('banco: sin errores', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}
// 3. Canción: título desde SONGS (sin ?t=), nota con Firebase falso
{
  const p = await c.newPage({ fake: FAKE_FIREBASE({ 'notas/ador_la-confianza': 'Tono RE', 'admins/test@gmail,com': true }, { email: 'test@gmail.com' }) });
  await p.go('/cancion.html?id=ador_la-confianza');
  check('canción: título desde songs.js', (await p.ev(`document.getElementById('song-title').textContent`)) === 'La confianza');
  check('canción: nota visible', (await p.ev(`document.getElementById('notaTexto').textContent`)) === 'Tono RE');
  check('canción: acordes', (await p.ev(`document.querySelectorAll('pre c[data-original]').length`)) > 10);
  await p.go('/cancion.html?id=ador_la-confianza&admin=true');
  if (!(await p.ev('Array.isArray(window.__writes)'))) throw new Error('Firebase falso no cargado: aborto para no escribir en la base real');
  await p.ev(`document.getElementById('notaEditBtn').click(); document.getElementById('notaInput').value = 'Tono MI'; document.getElementById('notaSave').click()`);
  await wait(300);
  check('canción admin: guarda nota (falso)', (await p.ev(`JSON.stringify(__writes)`)).includes('Tono MI'));
  check('canción: sin errores', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}
// 4. Canción banco: no carga SDK
{
  const p = await c.newPage();
  await p.go('/cancion.html?id=ador_la-confianza&modo=banco');
  check('canción banco: no descarga el SDK', !p.requests.some(u => u.includes('gstatic.com/firebasejs')));
  check('canción banco: letra visible', (await p.ev(`document.getElementById('letra-box').innerText.length`)) > 100);
  await p.close();
}
// 5. Sin Firebase (SDK bloqueado): todo sigue funcionando
{
  const p = await c.newPage({ blockFirebase: true });
  await p.go('/index.html?cat=carmelitanos');
  check('sin SDK: índice lista canciones', (await p.ev(`document.querySelectorAll('.song-row').length`)) === 14);
  await p.go('/cancion.html?id=ador_la-confianza&admin=true');
  check('sin SDK: canción carga', (await p.ev(`document.querySelectorAll('pre c').length`)) > 10);
  check('sin SDK: sin errores', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}
done(); c.close();
