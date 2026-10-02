import fs from 'fs';
import { connect, check, done, wait, OUT, FAKE_FIREBASE } from './cdp.mjs';
const c = await connect();
const ESPERADA = 'https://riforta.github.io/cancionero-carmen/index.html?modo=banco';
{
  const p = await c.newPage({ width: 820, height: 1160 });
  await p.go('/qr.html', 3000);
  // Decodificar el QR con jsQR (cargado solo para la prueba)
  await p.ev(`new Promise((ok, mal) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js'; s.onload = ok; s.onerror = mal; document.head.appendChild(s); })`);
  const decodificar = `new Promise(ok => { const img = document.querySelector('.qr'); const go = () => { const cv = document.createElement('canvas'); cv.width = img.naturalWidth + 80; cv.height = img.naturalHeight + 80; const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(img, 40, 40); const d = x.getImageData(0, 0, cv.width, cv.height); const r = jsQR(d.data, d.width, d.height); ok(r ? r.data : null); }; img.complete ? go() : img.onload = go; })`;
  const leido = await p.ev(decodificar);
  check('el QR apunta al modo banco del sitio publicado', leido === ESPERADA, String(leido));
  check('muestra la URL impresa', (await p.ev(`document.querySelector('.url').textContent`)) === ESPERADA);
  const r = await p.s('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${OUT}/f5-qr-cartel.png`, Buffer.from(r.result.data, 'base64'));
  await p.ev(`formato.value = 'tarjetas'; formato.dispatchEvent(new Event('change'))`);
  check('4 tarjetas por hoja', (await p.ev(`document.querySelectorAll('.cartel').length`)) === 4);
  check('tarjetas: QR legible', (await p.ev(decodificar)) === ESPERADA);
  const r2 = await p.s('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${OUT}/f5-qr-tarjetas.png`, Buffer.from(r2.result.data, 'base64'));
  // PDF de impresión: 1 página por formato
  const pdf = await p.s('Page.printToPDF', { preferCSSPageSize: true, printBackground: true });
  const bytes = Buffer.from(pdf.result.data, 'base64'); fs.writeFileSync(`${OUT}/f5-qr-tarjetas.pdf`, bytes);
  const paginas = (bytes.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  check('impresión de tarjetas: 1 hoja', paginas === 1, `${paginas} páginas`);
  await p.ev(`formato.value = 'cartel'; formato.dispatchEvent(new Event('change'))`);
  const pdf2 = await p.s('Page.printToPDF', { preferCSSPageSize: true, printBackground: true });
  const b2 = Buffer.from(pdf2.result.data, 'base64'); fs.writeFileSync(`${OUT}/f5-qr-cartel.pdf`, b2);
  const pag2 = (b2.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  check('impresión de cartel: 1 hoja', pag2 === 1, `${pag2} páginas`);
  check('sin errores', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}
{ // link desde la barra de admin
  const p = await c.newPage({ fake: FAKE_FIREBASE({ 'admins/test@gmail,com': true }, { email: 'test@gmail.com' }) });
  await p.go('/index.html?admin=true');
  check('admin: link al QR', (await p.ev(`document.querySelector('#admin-bar a[href="qr.html"]')?.textContent`)) === '🖨️ QR para fieles');
  await p.close();
}
done(); c.close();
