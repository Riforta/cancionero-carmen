import { connect, check, done, wait, FAKE_FIREBASE } from './cdp.mjs';
const c = await connect();
const MISA = ['ent_bendecire', 'glo_gloria-congreso-2000', 'com_alma-misionera', 'mar_magnificat'];

// 1. Ordenar Misa de Hoy (admin, Firebase falso)
{
  const p = await c.newPage({ fake: FAKE_FIREBASE({ misa_actual: ['ent_bendecire', 'com_alma-misionera'], 'admins/test@gmail,com': true }, { email: 'test@gmail.com' }), width: 360, height: 740 });
  await p.go('/index.html?admin=true&cat=todas');
  await p.ev(`addToMisa('glo_gloria-congreso-2000'); addToMisa('mar_magnificat'); addToMisa('ent_ven-hermano'); addToMisa('ofert_toma')`);
  const orden = await p.ev('JSON.stringify(misaIds)');
  check('orden por momento al agregar', orden === JSON.stringify(['ent_bendecire', 'ent_ven-hermano', 'glo_gloria-congreso-2000', 'ofert_toma', 'com_alma-misionera', 'mar_magnificat']), orden);
  await p.ev(`fc('misa')`);
  await p.ev(`document.querySelector('.admin-btn[data-action=up][data-song-id="ofert_toma"]').click()`);
  const tras = await p.ev('JSON.stringify(misaIds)');
  check('↑ sube una posición', JSON.parse(tras)[2] === 'ofert_toma', tras);
  await p.ev(`document.querySelector('.admin-btn[data-action=down][data-song-id="ent_bendecire"]').click()`);
  check('↓ baja una posición', JSON.parse(await p.ev('JSON.stringify(misaIds)'))[1] === 'ent_bendecire');
  check('lista refleja el orden', (await p.ev(`[...document.querySelectorAll('.song-row .song-name')].map(e => e.textContent).join('|')`)).startsWith('Ven hermano|Bendeciré|Toma'));
  check('sin publicar marcado', await p.ev('misaSinPublicar') === true);
  await p.ev(`document.querySelector('.song-row').scrollIntoView()`);
  await p.shot('f1-index-admin-misa', 740);
  if (!(await p.ev('Array.isArray(window.__writes)'))) throw new Error('Firebase falso no cargado: aborto para no escribir en la base real');
  await p.ev(`publicarMisa()`); await wait(300);
  check('publicar guarda el orden (falso)', (await p.ev('JSON.stringify(__writes)')).includes('"ent_ven-hermano","ent_bendecire","ofert_toma"'));
  check('sin errores', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}

// 2. Anterior / siguiente (admin, Firebase falso)
{
  const p = await c.newPage({ fake: FAKE_FIREBASE({ misa_actual: MISA }), width: 360, height: 740 });
  await p.go('/cancion.html?id=glo_gloria-congreso-2000&cat=misa&admin=true');
  const nav = await p.ev(`(() => { const n = document.getElementById('misa-nav'); return { visible: !n.hidden, pos: misaPos.textContent, prev: misaPrev.textContent, next: misaNext.textContent, nextHref: misaNext.getAttribute('href') }; })()`);
  check('nav visible', nav.visible);
  check('posición 2 / 4', nav.pos === '2 / 4', nav.pos);
  check('anterior = Bendeciré', nav.prev.includes('Bendeciré'));
  check('siguiente = Alma misionera', nav.next.includes('Alma misionera'));
  check('link conserva admin y cat', nav.nextHref === 'cancion.html?id=com_alma-misionera&admin=true&cat=misa', nav.nextHref);
  await p.ev(`window.scrollTo(0, document.body.scrollHeight)`); await wait(300);
  await p.shot('f1-cancion-nav', 740);
  await p.ev(`misaNext.click()`); await wait(2000);
  check('click siguiente navega', (await p.ev('location.search')).includes('id=com_alma-misionera'));
  await p.go('/cancion.html?id=ent_bendecire&cat=misa');
  check('primera: anterior vacío', await p.ev(`misaPrev.classList.contains('vacio')`));
  await p.go('/cancion.html?id=ent_bendecire&cat=carmelitanos');
  check('sin cat=misa: nav oculta', await p.ev(`document.getElementById('misa-nav').hidden`));
  await p.go('/cancion.html?id=ofert_toma&cat=misa');
  check('canción fuera de la misa: nav oculta', await p.ev(`document.getElementById('misa-nav').hidden`));
  check('sin errores', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}

// 3. Anterior / siguiente en banco (REST real, solo lectura)
{
  const real = await (await fetch('https://coro-97958-default-rtdb.firebaseio.com/misa_actual.json')).json();
  const p = await c.newPage();
  await p.go(`/cancion.html?id=${real[1]}&cat=misa&modo=banco`, 3000);
  check('banco: nav con misa real', (await p.ev('misaPos.textContent')) === `2 / ${real.length}`, await p.ev('misaPos.textContent'));
  check('banco: link conserva modo', (await p.ev(`misaNext.getAttribute('href')`)).includes('modo=banco'));
  check('banco: sin SDK', !p.requests.some(u => u.includes('gstatic.com/firebasejs')));
  check('banco: autoscroll oculto', await p.ev(`getComputedStyle(document.getElementById('autoscroll')).display === 'none'`));
  await p.close();
}

// 4. Pantalla encendida (stub de navigator.wakeLock)
{
  const p = await c.newPage({ fake: FAKE_FIREBASE({}) });
  await p.s('Page.addScriptToEvaluateOnNewDocument', { source: `window.__wl = 0; Object.defineProperty(navigator, 'wakeLock', { value: { request: () => { window.__wl++; return Promise.resolve({ released: false }); } } });` });
  await p.go('/cancion.html?id=ofert_toma');
  check('wake lock pedido al abrir', (await p.ev('window.__wl')) === 1, String(await p.ev('window.__wl')));
  await p.go('/cancion.html?id=ofert_toma&modo=banco');
  check('banco: sin wake lock', (await p.ev('window.__wl')) === 0);
  await p.close();
}

// 5. Desplazamiento automático
{
  const p = await c.newPage({ fake: FAKE_FIREBASE({}), width: 360, height: 640 });
  await p.go('/cancion.html?id=ador_noche-oscura-jesed');
  await p.ev(`localStorage.removeItem('autoscroll_nivel')`);
  await p.go('/cancion.html?id=ador_noche-oscura-jesed');
  check('control visible', await p.ev(`!document.getElementById('autoscroll').hidden`));
  await p.ev(`asMas.click()`); // sin reproducir, los botones extra están ocultos pero clickeables por JS
  await p.ev(`asPlay.click()`); await wait(1500);
  const y1 = await p.ev('scrollY');
  check('avanza', y1 > 20, `scrollY=${y1}`);
  check('nivel 4 guardado', (await p.ev(`localStorage.getItem('autoscroll_nivel')`)) === '4');
  await p.shot('f1-autoscroll', 640);
  await p.ev(`document.querySelector('pre').dispatchEvent(new TouchEvent('touchstart', { bubbles: true }))`); await wait(800);
  const y2 = await p.ev('scrollY'); await wait(800);
  check('se detiene al tocar', (await p.ev('scrollY')) === y2 && (await p.ev(`asPlay.textContent`)) === '▶');
  await p.ev(`asPlay.click()`); await wait(300);
  await p.ev(`asPlay.dispatchEvent(new TouchEvent('touchstart', { bubbles: true }))`); await wait(300);
  check('tocar el control no lo detiene', (await p.ev(`asPlay.textContent`)) === '⏸');
  await p.ev(`window.scrollTo(0, document.body.scrollHeight)`); await wait(800);
  check('se detiene al final', (await p.ev(`asPlay.textContent`)) === '▶');
  check('sin errores', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}
done(); c.close();
