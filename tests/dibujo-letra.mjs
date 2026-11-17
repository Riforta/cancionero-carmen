// Dibujo de la letra (letra.js + cancion.js, AGENTS.md D22): cada acorde
// sobre su sílaba, la letra de corrido, espacio solo donde hace falta, y
// acordes ocultos / banco como texto corrido.
import { connect, check, done, wait, FAKE_FIREBASE } from './cdp.mjs';
const c = await connect();

// Dibuja un texto con el mismo código que usa la página
const dibujar = texto => `(() => {
  letraBox.classList.remove('no-chords');
  letraBox.innerHTML = htmlDeLetra(parsearLetra(${JSON.stringify(texto)}));
  renderChords();
  return true;
})()`;
const rect = sel => `(() => { const b = letraBox.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top }; })()`;
const desfase = `Math.max(0, ...[...letraBox.querySelectorAll('.tramo')].map(t => Math.abs(t.firstElementChild.getBoundingClientRect().left - t.lastElementChild.getBoundingClientRect().left)))`;

const p = await c.newPage({ fake: FAKE_FIREBASE({}), width: 390, height: 800 });
await p.go('/cancion.html?id=com_pescador-de-hombres', 2000);
await p.ev('document.fonts.ready.then(() => true)');

// 1. Una letra real
{
  const r = await p.ev(`(async () => {
    const texto = await (await fetch('letras/com_pescador-de-hombres.txt')).text();
    return { acordes: letraBox.querySelectorAll('c').length, esperados: acordesDeLetra(parsearLetra(texto)).length,
             primero: letraBox.querySelector('.tramo').textContent, desborde: letraBox.scrollWidth - letraBox.clientWidth,
             estribillo: letraBox.querySelectorAll('.estribillo .renglon:not(.vacio)').length,
             viejo: letraBox.querySelectorAll('pre, .chord-line').length };
  })()`);
  check('letra real: todos los acordes, ninguno del dibujo viejo', r.acordes === r.esperados && r.acordes > 50 && r.viejo === 0, JSON.stringify(r));
  check('letra real: el primer acorde va sobre "Tú"', r.primero === 'DOTú', r.primero);
  check('letra real: estribillo de 4 renglones, en negrita aparte', r.estribillo === 4, String(r.estribillo));
  check('letra real: cada acorde sobre su sílaba', (await p.ev(desfase)) < 0.5);
  check('letra real: no hay que desplazarse de costado (390 px)', r.desborde <= 1, String(r.desborde));
  check('letra real: los lectores de pantalla no leen los acordes', await p.ev(`[...letraBox.querySelectorAll('c')].every(c => c.getAttribute('aria-hidden') === 'true')`));
}

// 2. Sin choques la letra va de corrido: no se agrega espacio
await p.ev(dibujar('[DO]Yo te a[RE]mo, Señor, fortaleza mía.'));
check('sin choques: ni espacio agregado ni guion', await p.ev(`!letraBox.querySelector('.sil[style], .palabra[style], .estirado, .salto')`));
check('sin choques: el acorde no ocupa lugar en la letra', await p.ev(`(() => { const r = letraBox.querySelector('.renglon'); return r.textContent.replace(/DO|RE/g, '') === 'Yo te amo, Señor, fortaleza mía.'; })()`));

// 3. Dos acordes que chocan dentro de una palabra: guion y separación
await p.ev(dibujar('[SOLmaj7]a[RE]mor'));
{
  const a = await p.ev(rect('c[data-original="SOLmaj7"]')), b = await p.ev(rect('c[data-original="RE"]'));
  check('choque en una palabra: el segundo acorde se corre', b.l >= a.r + 2 && Math.abs(a.t - b.t) < 1, JSON.stringify({ a, b }));
  check('choque en una palabra: guion entre las partes ("a- mor")', await p.ev(`letraBox.querySelector('.tramo.estirado .sil').textContent === 'a' && getComputedStyle(letraBox.querySelector('.tramo.estirado .sil'), '::after').content.includes('-')`));
  check('choque en una palabra: cada acorde sigue sobre su sílaba', (await p.ev(desfase)) < 0.5);
}

// 4. Choque entre palabras: más espacio entre ellas, sin guion
await p.ev(dibujar('[SOLmaj7]y [RE]te'));
check('choque entre palabras: se abre el espacio, sin guion', await p.ev(`!letraBox.querySelector('.estirado') && !!letraBox.querySelector('.palabra[style*="margin-left"]')`));
{
  const a = await p.ev(rect('c[data-original="SOLmaj7"]')), b = await p.ev(rect('c[data-original="RE"]'));
  check('choque entre palabras: no quedan encimados', b.l >= a.r + 2, JSON.stringify({ a, b }));
}

// 5. Acorde después de una palabra (se sostiene): ocupa su lugar
await p.ev(dibujar('Así[RE] en marcha'));
{
  const re = await p.ev(rect('c[data-original="RE"]')), en = await p.ev(`(() => { const r = document.createRange(); const n = [...letraBox.querySelector('.renglon').childNodes].find(x => x.nodeType === 3 && x.data.includes('en')); r.setStart(n, n.data.indexOf('en')); r.setEnd(n, n.data.indexOf('en') + 2); return r.getBoundingClientRect().left; })()`);
  check('acorde después de la palabra: la palabra siguiente arranca después del acorde', en >= re.r, JSON.stringify({ re, en }));
}

// 6. Un acorde que se saldría por la derecha: su palabra pasa abajo. En
// una caja angosta, con muchas palabras de acorde largo cerca del final,
// alguna cae en el borde
await p.ev(`letraBox.style.width = '9em'`);
await p.ev(dibujar(Array(14).fill('palab[SOL#m7]ra').join(' ')));
{
  const r = await p.ev(`(() => {
    const cs = getComputedStyle(letraBox), lim = letraBox.getBoundingClientRect().right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth);
    return { fuera: [...letraBox.querySelectorAll('c')].filter(c => c.getBoundingClientRect().right > lim + 0.5).length,
             saltos: letraBox.querySelectorAll('.salto').length, desborde: letraBox.scrollWidth - letraBox.clientWidth };
  })()`);
  check('acorde en el borde: su palabra pasa al renglón de abajo y nada se sale', r.saltos > 0 && r.fuera === 0 && r.desborde <= 1, JSON.stringify(r));
}
await p.ev(`letraBox.style.width = ''`);

// 7. Transponer cambia los anchos: se vuelve a acomodar
await p.ev(dibujar('[SOL]a[LA]mor'));
await p.ev(`for (let i = 0; i < 1; i++) document.getElementById('btnSubirTono').click()`);
{
  const a = await p.ev(rect('c[data-original="SOL"]')), b = await p.ev(rect('c[data-original="LA"]'));
  check('al transponer (SOL#, LA#) se vuelven a separar', b.l >= a.r + 2 && (await p.ev(`letraBox.querySelector('c').textContent`)) === 'SOL#', JSON.stringify({ a, b }));
}
await p.ev(`document.getElementById('btnBajarTono').click()`);

// 8. Opcional y renglón de solo acordes
await p.ev(dibujar('Intro: [DO] [FA]\nÉl es [(MI)]todo'));
check('acorde opcional entre paréntesis', await p.ev(`getComputedStyle(letraBox.querySelector('c.opcional'), '::before').content === '"("' && letraBox.querySelector('c.opcional').textContent === 'MI'`));

// 9. Acordes ocultos: texto corrido, sin renglones de solo acordes ni espacios agregados
await p.ev(dibujar('Intro: [DO] [FA]\n[SOLmaj7]a[RE]mor, [DO]Yo[RE] te'));
await p.ev(`document.getElementById('toggleChords').click()`); await wait(100);
{
  const r = await p.ev(`(() => ({
    acordes: [...letraBox.querySelectorAll('c, .solo-acordes')].filter(e => getComputedStyle(e).display !== 'none').length,
    texto: letraBox.innerText.trim(),
    estilos: letraBox.querySelectorAll('.sil[style], .palabra[style], .estirado, .salto').length
  }))()`);
  check('acordes ocultos: no se ve ninguno ni queda su renglón', r.acordes === 0, JSON.stringify(r));
  check('acordes ocultos: la letra de corrido ("amor, Yo te")', r.texto === 'amor, Yo te' && r.estilos === 0, JSON.stringify(r));
}
await p.ev(`document.getElementById('toggleChords').click()`); await wait(100);
check('acordes visibles otra vez: se vuelven a acomodar', await p.ev(`!!letraBox.querySelector('.estirado')`));

// 10. Lo que venga en la letra no se ejecuta (las letras van a poder venir de la web)
await p.ev(`window.__xss = 0`);
await p.ev(dibujar('<img src=x onerror="window.__xss=1">[<img src=x onerror="window.__xss=2">]a\n{titulo: <b onmouseover="x">T</b>}'));
await wait(300);
check('la letra no puede meter HTML', (await p.ev(`window.__xss === 0 && !letraBox.querySelector('img, b')`)) === true);
check('sin errores', p.errors.length === 0, p.errors.join(' | '));
await p.close();

// 11. Banco: texto corrido, sin acordes
{
  const b = await c.newPage({ rest: { misa_actual: [] }, width: 390, height: 800 });
  await b.go('/cancion.html?id=com_alma-misionera&modo=banco', 2000);
  const r = await b.ev(`(() => ({
    acordes: [...letraBox.querySelectorAll('c, .solo-acordes')].filter(e => getComputedStyle(e).display !== 'none').length,
    primera: letraBox.querySelector('.renglon').innerText,
    estilos: letraBox.querySelectorAll('.sil[style], .palabra[style], .estirado, .salto').length
  }))()`);
  check('banco: sin acordes y la letra de corrido', r.acordes === 0 && r.primera === 'Señor, toma mi vida nueva' && r.estilos === 0, JSON.stringify(r));
  check('banco: sin errores', b.errors.length === 0, b.errors.join(' | '));
  await b.close();
}
done(); c.close();
