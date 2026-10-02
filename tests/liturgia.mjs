// Tiempo litúrgico en el índice (la lógica se prueba en liturgia.node.mjs)
import fs from 'fs';
import { connect, check, done, wait, OUT } from './cdp.mjs';
const c = await connect();
const conFecha = async (p, fecha, tema = 'light') => p.s('Page.addScriptToEvaluateOnNewDocument', { source: `window.FECHA_PRUEBA = '${fecha}'; try { localStorage.setItem('tema', '${tema}'); } catch (e) {}` });
const franja = `(() => { const l = document.getElementById('liturgia'); return { visible: !l.hidden && getComputedStyle(l).display !== 'none', color: l.dataset.color, nombre: liturgiaNombre.textContent, detalle: liturgiaDetalle.textContent, raya: getComputedStyle(l.querySelector('.liturgia-color')).backgroundColor }; })()`;

// Contraste WCAG contra el fondo de la tarjeta (--bg)
const contraste = sel => `(() => {
  const rgb = s => s.match(/\\d+(\\.\\d+)?/g).slice(0, 3).map(Number);
  const lum = c => { const [r, g, b] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const a = lum(rgb(getComputedStyle(document.querySelector('${sel}')).color));
  const b = lum(rgb(getComputedStyle(document.getElementById('liturgia')).backgroundColor));
  return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 10) / 10;
})()`;

{
  const p = await c.newPage({ width: 390, height: 800 });
  await conFecha(p, '2026-10-04');
  await p.go('/index.html?cat=todas');
  let f = await p.ev(franja);
  check('domingo 4/10/2026: Domingo XXVII del Tiempo Ordinario, verde', f.visible && f.nombre === 'Domingo XXVII del Tiempo Ordinario' && f.color === 'verde' && f.detalle === 'Color litúrgico: verde', JSON.stringify(f));
  check('raya de color verde', f.raya === 'rgb(63, 122, 58)', f.raya);
  check('contraste del nombre ≥ 4.5 (claro)', (await p.ev(contraste('.liturgia-nombre'))) >= 4.5);
  check('contraste del detalle ≥ 4.5 (claro)', (await p.ev(contraste('.liturgia-detalle'))) >= 4.5, String(await p.ev(contraste('.liturgia-detalle'))));
  const r = await p.s('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${OUT}/liturgia-claro.png`, Buffer.from(r.result.data, 'base64'));
  check('sin errores', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}
{
  const p = await c.newPage({ width: 390, height: 800 });
  await conFecha(p, '2026-12-13', 'dark');
  await p.go('/index.html?cat=todas');
  const f = await p.ev(franja);
  check('Gaudete 13/12/2026: rosa', f.nombre === 'Domingo III de Adviento' && f.color === 'rosa', JSON.stringify(f));
  check('contraste del nombre ≥ 4.5 (oscuro)', (await p.ev(contraste('.liturgia-nombre'))) >= 4.5);
  check('contraste del detalle ≥ 4.5 (oscuro)', (await p.ev(contraste('.liturgia-detalle'))) >= 4.5);
  // Orden de categorías: con canciones de Adviento, Adviento va después de Misa de Hoy
  const orden = () => p.ev(`[...document.querySelectorAll('.cat-chip')].map(c => c.dataset.cat).slice(0, 3).join(',')`);
  check('sin canciones de Adviento: orden normal', (await orden()).startsWith('misa,entrada'));
  await p.ev(`SONGS.push({ id: 'adv_prueba', num: 0, title: 'Prueba de Adviento', category: 'adviento' }); render()`);
  check('con canciones de Adviento: Adviento segunda', (await orden()) === 'misa,adviento,entrada', await orden());
  const r = await p.s('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${OUT}/liturgia-oscuro.png`, Buffer.from(r.result.data, 'base64'));
  await p.close();
}
{
  const p = await c.newPage({ width: 390, height: 800 });
  await conFecha(p, '2026-07-16');
  await p.go('/index.html?modo=banco', 2500);
  const f = await p.ev(franja);
  check('fiesta patronal 16/7 en banco: visible con su nombre y el tiempo', f.visible && f.nombre === 'Nuestra Señora del Carmen (fiesta patronal)' && f.detalle === 'Semana XV del Tiempo Ordinario · color blanco', JSON.stringify(f));
  await p.close();
}
done(); c.close();
