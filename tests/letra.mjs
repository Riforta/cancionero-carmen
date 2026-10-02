// Tamaño de letra A− / A+ en cancion.html (todos los modos)
import { connect, check, done, wait, FAKE_FIREBASE } from './cdp.mjs';
const c = await connect();
const estado = `(() => {
  const pre = document.getElementById('letra-box');
  const cs = getComputedStyle(pre);
  const fs = parseFloat(cs.fontSize);
  const ch = pre.querySelectorAll('c')[3].getBoundingClientRect();
  const base = pre.getBoundingClientRect().left + parseFloat(cs.paddingLeft) - pre.scrollLeft;
  return { escala: pre.style.getPropertyValue('--escala-letra'), fs, posAcorde: (ch.left - base) / fs,
           menos: letraMenos.disabled, mas: letraMas.disabled, visible: getComputedStyle(document.querySelector('.tam-letra')).display !== 'none' };
})()`;
const p = await c.newPage({ fake: FAKE_FIREBASE({}), width: 390, height: 800 });
await p.go('/cancion.html?id=com_pescador-de-hombres');
await p.ev(`localStorage.removeItem('tam_letra')`);
await p.go('/cancion.html?id=com_pescador-de-hombres');
const a = await p.ev(estado);
check('tamaño normal al empezar', a.escala === '1' && !a.menos && !a.mas, JSON.stringify(a));
await p.ev('letraMas.click(); letraMas.click(); letraMas.click()');
await wait(400);   // los acordes tienen transition: all 0.1s
const b = await p.ev(estado);
check('A+ ×3 → escala 1.45', b.escala === '1.45' && Math.abs(b.fs / a.fs - 1.45) < 0.02, `${a.fs}px → ${b.fs}px`);
check('los acordes siguen alineados (misma posición relativa)', Math.abs(b.posAcorde - a.posAcorde) < 0.15, `${a.posAcorde.toFixed(2)}em → ${b.posAcorde.toFixed(2)}em`);
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
