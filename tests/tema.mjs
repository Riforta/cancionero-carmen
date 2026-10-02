import fs from 'fs';
import { connect, check, done, wait, OUT, FAKE_FIREBASE } from './cdp.mjs';
const c = await connect();
const viewport = async (p, name) => { const r = await p.s('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.result.data, 'base64')); };
const esquema = (p, v) => p.s('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: v }] });

// Contraste WCAG de un elemento contra su fondo efectivo (sube por los padres
// hasta un fondo opaco; si llega al body con degradé usa el color de página)
const CONTRASTE = `(sel) => {
  const el = document.querySelector(sel); if (!el) return null;
  const rgb = s => { const m = s.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(',').map(Number); return { r, g, b, a }; };
  const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  let n = el, fondo = null;
  while (n && n.nodeType === 1) {
    const cs = getComputedStyle(n);
    const img = cs.backgroundImage;
    if (img && img.startsWith('linear-gradient')) { const c = rgb(img); if (c) { fondo = c; break; } }
    const bc = rgb(cs.backgroundColor); if (bc && bc.a > 0.9) { fondo = bc; break; }
    n = n.parentElement;
  }
  fondo = fondo || (document.documentElement.dataset.theme === 'dark' ? { r: 27, g: 18, b: 12 } : { r: 250, g: 210, b: 150 });
  const tx = rgb(getComputedStyle(el).color);
  const [a, b] = [lum(tx), lum(fondo)].sort((x, y) => y - x);
  return Math.round(((a + 0.05) / (b + 0.05)) * 10) / 10;
}`;
const contraste = (p, sel) => p.ev(`(${CONTRASTE})(${JSON.stringify(sel)})`);

// 1. Sigue al sistema, el botón cambia y se recuerda
{
  const p = await c.newPage({ width: 390, height: 760 });
  await esquema(p, 'dark');
  await p.go('/index.html', 2500);
  await p.ev(`localStorage.removeItem('tema')`); await p.go('/index.html', 2500);
  check('sistema oscuro → tema oscuro', (await p.ev(`document.documentElement.dataset.theme`)) === 'dark');
  check('botón muestra ☀️', (await p.ev(`themeToggle.textContent`)) === '☀️');
  await esquema(p, 'light'); await wait(300);
  check('sigue el cambio del sistema si no eligió', (await p.ev(`document.documentElement.dataset.theme`)) === 'light');
  await p.ev(`themeToggle.click()`);
  check('el botón cambia a oscuro', (await p.ev(`document.documentElement.dataset.theme`)) === 'dark' && (await p.ev(`localStorage.getItem('tema')`)) === 'dark');
  await p.go('/cancion.html?id=com_pescador-de-hombres', 2500);
  check('la elección se mantiene en otra página', (await p.ev(`document.documentElement.dataset.theme`)) === 'dark');
  await esquema(p, 'light'); await wait(300);
  check('elegido a mano: no lo pisa el sistema', (await p.ev(`document.documentElement.dataset.theme`)) === 'dark');
  check('sin errores', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}

// 2. Contraste en modo oscuro y en claro
for (const tema of ['dark', 'light']) {
  const p = await c.newPage({ fake: FAKE_FIREBASE({ misa_actual: ['ent_bendecire', 'com_pescador-de-hombres'], 'admins/test@gmail,com': true, 'notas/com_pescador-de-hombres': 'Tono DO, entra el coro', 'tonos/com_pescador-de-hombres': { transponer: 2, capo: 0 } }, { email: 'test@gmail.com' }), width: 390, height: 760 });
  await p.s('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('tema', '${tema}'); } catch (e) {}` });
  await p.go('/index.html?admin=true');
  const minimo = 4.5;
  for (const [nombre, sel] of [['nombre de canción', '.song-name'], ['etiqueta de categoría', '.song-tag'], ['chip de categoría', '.cat-chip:not(.active) .chip-label'], ['chip activo', '.cat-chip.active .chip-label'], ['botón admin', '.admin-action-btn'], ['botón ↑', '.admin-btn'], ['barra de sesión', '.sesion-texto'], ['contador', '.sec-label-count']]) {
    const v = await contraste(p, sel);
    check(`[${tema}] índice: ${nombre} ≥ ${minimo}`, v >= minimo, String(v));
  }
  if (tema === 'dark') await viewport(p, 'f6-index-oscuro');
  await p.go('/cancion.html?id=com_pescador-de-hombres&cat=misa&admin=true');
  for (const [nombre, sel] of [['letra', 'pre'], ['acorde', 'pre c'], ['estribillo', 'pre b'], ['título', 'h1'], ['botón ½ tono', '.btn-toggle:not(.active)'], ['botón activo', '.btn-toggle.active'], ['selector de capo', '.capo-select'], ['tono del coro', '.tono-texto'], ['nota', '.nota-texto'], ['anterior/siguiente', '.mn-title']]) {
    const v = await contraste(p, sel);
    check(`[${tema}] canción: ${nombre} ≥ ${minimo}`, v >= minimo, String(v));
  }
  if (tema === 'dark') {
    await viewport(p, 'f6-cancion-oscuro');
    // Popover del diagrama de acordes
    await p.ev(`document.querySelector('pre c').click()`); await wait(200);
    check('[dark] diagrama: cejuela clara', (await p.ev(`getComputedStyle(document.querySelector('#popover-svg .cd-cejuela')).stroke`)) === 'rgb(242, 228, 207)');
    await p.ev(`(() => { const r = document.getElementById('chord-popover').getBoundingClientRect(); window.scrollBy(0, 0); })()`);
    await viewport(p, 'f6-popover-oscuro');
  }
  check(`[${tema}] sin errores`, p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}

// 3. Banco en oscuro: botón de tema visible, sin el de admin
{
  const p = await c.newPage({ width: 390, height: 760 });
  await p.s('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('tema', 'dark'); } catch (e) {}` });
  await p.go('/cancion.html?id=com_pescador-de-hombres&modo=banco', 2500);
  check('banco: botón de tema visible', await p.ev(`getComputedStyle(themeToggle).display !== 'none'`));
  check('banco: sin botón de admin', await p.ev(`modeToggle.hidden`));
  check('[dark] banco: letra ≥ 4.5', (await contraste(p, 'pre')) >= 4.5);
  await viewport(p, 'f6-banco-oscuro');
  await p.close();
}
done(); c.close();
