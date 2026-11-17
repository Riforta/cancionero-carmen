// Tamaño de letra A− / A+ en cancion.html (todos los modos)
import { connect, check, done, wait, FAKE_FIREBASE } from './cdp.mjs';
const c = await connect();
// desfase: lo más lejos que quedó un acorde del comienzo de su sílaba (px)
const estado = `(() => {
  const box = document.getElementById('letra-box');
  const fs = parseFloat(getComputedStyle(box).fontSize);
  let desfase = 0;
  for (const t of box.querySelectorAll('.tramo')) {
    desfase = Math.max(desfase, Math.abs(t.firstElementChild.getBoundingClientRect().left - t.lastElementChild.getBoundingClientRect().left));
  }
  return { escala: box.style.getPropertyValue('--escala-letra'), fs, desfase, desborde: box.scrollWidth - box.clientWidth,
           menos: letraMenos.disabled, mas: letraMas.disabled, visible: getComputedStyle(document.querySelector('.tam-letra')).display !== 'none' };
})()`;
const p = await c.newPage({ fake: FAKE_FIREBASE({}), width: 390, height: 800 });
await p.go('/cancion.html?id=com_pescador-de-hombres');
await p.ev(`localStorage.removeItem('tam_letra')`);
await p.go('/cancion.html?id=com_pescador-de-hombres');
const a = await p.ev(estado);
check('tamaño normal al empezar', a.escala === '1' && !a.menos && !a.mas, JSON.stringify(a));
check('cada acorde sobre su sílaba', a.desfase < 0.5, a.desfase + 'px');
await p.ev('letraMas.click(); letraMas.click(); letraMas.click()');
await wait(200);
const b = await p.ev(estado);
check('A+ ×3 → escala 1.45', b.escala === '1.45' && Math.abs(b.fs / a.fs - 1.45) < 0.02, `${a.fs}px → ${b.fs}px`);
check('con la letra grande, cada acorde sigue sobre su sílaba y nada se sale de costado', b.desfase < 0.5 && b.desborde <= 1, JSON.stringify({ desfase: b.desfase, desborde: b.desborde }));
await p.ev('letraMas.click(); letraMas.click()');
check('tope: A+ deshabilitado en el máximo', (await p.ev(estado)).mas === true && (await p.ev(estado)).escala === '1.6');
await p.go('/cancion.html?id=com_pescador-de-hombres');
check('se recuerda al volver a entrar', (await p.ev(estado)).escala === '1.6');
for (let i = 0; i < 6; i++) await p.ev('letraMenos.click()');
check('piso: A− deshabilitado en el mínimo', (await p.ev(estado)).menos === true && (await p.ev(estado)).escala === '0.85');
await p.go('/cancion.html?id=com_pescador-de-hombres&modo=banco');
check('banco: los botones se ven', (await p.ev(estado)).visible);
await p.ev(`localStorage.removeItem('tam_letra')`);
check('sin errores', p.errors.length === 0, p.errors.join(' | '));
done(); c.close();
