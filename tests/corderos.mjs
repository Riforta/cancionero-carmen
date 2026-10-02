import fs from 'fs';
import { connect, check, done, wait, OUT } from './cdp.mjs';
const c = await connect();
const p = await c.newPage({ width: 390, height: 900 });
const canciones = { 'snt_cordero-lento-sube': 'Cordero (Lento, sube de tono)', 'snt_este-es-el-cordero': 'Éste es el Cordero', 'snt_cordero-cueca': 'Cordero (Cueca)' };
for (const [id, titulo] of Object.entries(canciones)) {
  await p.go(`/cancion.html?id=${id}`, 2000);
  const info = await p.ev(`(() => ({
    titulo: document.getElementById('song-title').textContent,
    error: !!document.querySelector('.error-msg'),
    acordes: document.querySelectorAll('pre c[data-original]').length,
    sinDiagrama: [...new Set([...document.querySelectorAll('pre c')].map(c => c.textContent))].filter(n => !chordLookup(n))
  }))()`);
  check(`${id}: carga con título`, !info.error && info.titulo === titulo, JSON.stringify(info));
  check(`${id}: todos los acordes con diagrama`, info.acordes > 5 && info.sinDiagrama.length === 0, JSON.stringify(info.sinDiagrama));
  const r = await p.s('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${OUT}/f9-${id}.png`, Buffer.from(r.result.data, 'base64'));
}
await p.go('/index.html?cat=santo', 2000);
const lista = await p.ev(`[...document.querySelectorAll('.song-name')].map(e => e.textContent)`);
check('categoría Santo / Cordero: 8 canciones con las nuevas', lista.length === 8 && Object.values(canciones).every(t => lista.includes(t)), lista.join(' | '));
check('sin errores', p.errors.length === 0, p.errors.join(' | '));
done(); c.close();
