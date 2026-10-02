import fs from 'fs';
import { connect, check, done, wait, OUT } from './cdp.mjs';
const c = await connect();
const casos = { 'ador_la-confianza': 'OClD97tGVNs', 'ador_porque-te-amo-oh-madre': '0A4gbAMI9H8', 'ador_el-abandono': 'mfQE3ep5iLo', 'ador_una-lluvia-de-rosas': 'Q1xFY4K-xA0', 'ador_no-conozco-otro-medio': 'WAxo95wF2r0', 'ador_lo-que-agrada-a-dios': 'zsWCN5VF0DI' };
const p = await c.newPage({ width: 390, height: 760 });
for (const [id, vid] of Object.entries(casos)) {
  await p.go(`/cancion.html?id=${id}`, 2500);
  const src = await p.ev(`(() => { const f = document.querySelector('#medios iframe.youtube'); return !document.getElementById('medios').hidden && f ? f.src : null; })()`);
  check(`${id}: reproductor de YouTube`, src === `https://www.youtube-nocookie.com/embed/${vid}`, String(src));
}
await p.go('/cancion.html?id=ador_la-confianza', 2500);
await p.ev(`document.getElementById('medios').scrollIntoView({ block: 'center' })`); await wait(3000);
const r = await p.s('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${OUT}/f8-youtube.png`, Buffer.from(r.result.data, 'base64'));
await p.go('/cancion.html?id=ador_la-confianza&modo=banco', 2500);
check('banco: sin reproductor', await p.ev(`getComputedStyle(document.getElementById('medios')).display === 'none'`));
await p.go('/cancion.html?id=ador_silencio-de-amor-jesed', 2500);
check('canción sin audio: sección oculta', await p.ev(`document.getElementById('medios').hidden`));
check('sin errores', p.errors.length === 0, p.errors.join(' | '));
done(); c.close();
