// Capturas de las pantallas principales, en claro y en oscuro, para detectar
// cambios visuales en un refactor.
//   run.ps1 capturas.mjs --referencia   guarda en salida/referencia/
//   run.ps1 capturas.mjs                 guarda en salida/actual/ y compara
// La comparación es píxel por píxel dentro de Chrome (canvas), sin
// dependencias. Las diferencias quedan marcadas en rojo en salida/diferencias/.
// Datos fijos (Firebase falso y REST simulado): la misa real no influye.
import fs from 'fs';
import path from 'path';
import { connect, check, done, wait, OUT, BASE, FAKE_FIREBASE } from './cdp.mjs';

const REFERENCIA = process.argv.includes('--referencia');
const destino = path.join(OUT, REFERENCIA ? 'referencia' : 'actual');
fs.mkdirSync(destino, { recursive: true });

const MISA = ['ent_bendecire', 'glo_gloria-congreso-2000', 'com_pescador-de-hombres', 'mar_magnificat'];
const DB = {
  misa_actual: MISA,
  'notas/com_pescador-de-hombres': 'Tono DO, entra el coro en el estribillo',
  'tonos/com_pescador-de-hombres': { transponer: 2, capo: 0 },
  'admins/test@gmail,com': true,
  misa_meta: { por: 'Mateo', cuando: new Date(2026, 9, 3, 19, 40).getTime() },
  'avisos/a1': { fecha: '2026-10-08', hora: '20:00', tipo: 'ensayo', titulo: 'Ensayo general', lugar: 'Salón parroquial', detalle: 'Traer las carpetas' },
  'avisos/a2': { fecha: '2026-10-17', hora: '', tipo: 'celebracion', titulo: 'Misa con el coro de jóvenes', lugar: '', detalle: '' }
};
const ADMIN = { email: 'test@gmail.com' };
const CANCION = '/cancion.html?id=com_pescador-de-hombres&cat=misa';

const PANTALLAS = [
  { nombre: 'indice-musico', url: '/index.html', fake: true },
  { nombre: 'indice-admin', url: '/index.html?admin=true', fake: true, admin: true },
  { nombre: 'indice-busqueda', url: '/index.html?cat=todas', fake: true, buscar: 'arena' },
  { nombre: 'indice-banco', url: '/index.html?modo=banco', rest: true },
  { nombre: 'cancion-musico', url: CANCION, fake: true },
  { nombre: 'cancion-admin', url: CANCION + '&admin=true', fake: true, admin: true },
  { nombre: 'cancion-banco', url: CANCION + '&modo=banco', rest: true },
  { nombre: 'cancion-popover', url: CANCION, fake: true, popover: true },
  { nombre: 'avisos-musico', url: '/avisos.html', fake: true },
  { nombre: 'avisos-admin', url: '/avisos.html?admin=true', fake: true, admin: true }
];

const c = await connect();
const nombres = [];
for (const tema of ['claro', 'oscuro']) {
  for (const pant of PANTALLAS) {
    const p = await c.newPage({
      width: 390, height: 800,
      fake: pant.fake ? FAKE_FIREBASE(DB, pant.admin ? ADMIN : null) : null,
      rest: pant.rest ? { misa_actual: MISA } : null
    });
    // Tema fijo, sin service worker (el aviso "Listo sin internet" dependería
    // de si ya se instaló) y sin animaciones (una captura a mitad del fadeUp
    // corre medio píxel algunas líneas)
    await p.s('Page.addScriptToEvaluateOnNewDocument', { source: `
      window.FECHA_PRUEBA = '2026-10-04';   // la franja litúrgica no cambia con el día
      try { localStorage.setItem('tema', '${tema === 'oscuro' ? 'dark' : 'light'}'); } catch (e) {}
      delete Navigator.prototype.serviceWorker;
      document.addEventListener('DOMContentLoaded', () => {
        const st = document.createElement('style');
        st.textContent = '*, *::before, *::after { animation: none !important; transition: none !important; }';
        document.head.appendChild(st);
      });` });
    await p.go(pant.url, 2000);
    if (pant.buscar) {
      await p.ev(`{ const i = document.getElementById('si'); i.value = '${pant.buscar}'; i.dispatchEvent(new Event('input')); }`);
      await wait(2500);
    }
    await p.ev('document.fonts.ready.then(() => true)');
    await wait(800); // animaciones de entrada (fadeUp)
    let r;
    if (pant.popover) {
      await p.ev(`document.querySelector('pre c').click()`);
      await wait(200);
      r = await p.s('Page.captureScreenshot', { format: 'png' });
    } else {
      const alto = await p.ev('document.documentElement.scrollHeight');
      await p.s('Emulation.setDeviceMetricsOverride', { width: 390, height: alto, deviceScaleFactor: 1, mobile: true });
      await wait(400);
      r = await p.s('Page.captureScreenshot', { format: 'png' });
    }
    const archivo = `${tema}-${pant.nombre}.png`;
    fs.writeFileSync(path.join(destino, archivo), Buffer.from(r.result.data, 'base64'));
    nombres.push(archivo);
    if (p.errors.length) console.log(`  (errores en ${archivo}: ${p.errors.join(' | ')})`);
    await p.close();
  }
}

if (REFERENCIA) {
  console.log(`Referencia guardada: ${nombres.length} capturas en ${destino}`);
} else {
  // Comparar dentro de Chrome: las imágenes se sirven por el mismo servidor
  const dirDif = path.join(OUT, 'diferencias');
  fs.mkdirSync(dirDif, { recursive: true });
  const rel = path.relative(path.resolve(OUT, '..', '..'), OUT).split(path.sep).join('/');
  const p = await c.newPage();
  await p.go('/index.html', 500);
  for (const archivo of nombres) {
    if (!fs.existsSync(path.join(OUT, 'referencia', archivo))) { check(archivo, false, 'no hay referencia'); continue; }
    const res = await p.ev(`(async () => {
      const cargar = src => new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = src + '?' + Date.now(); });
      const [a, b] = await Promise.all([cargar('${BASE}/${rel}/referencia/${archivo}'), cargar('${BASE}/${rel}/actual/${archivo}')]);
      if (a.width !== b.width || a.height !== b.height) return { tamano: [a.width, a.height, b.width, b.height] };
      const lienzo = w => { const cv = document.createElement('canvas'); cv.width = a.width; cv.height = a.height; return cv; };
      const ca = lienzo(), cb = lienzo();
      const xa = ca.getContext('2d'), xb = cb.getContext('2d');
      xa.drawImage(a, 0, 0); xb.drawImage(b, 0, 0);
      const da = xa.getImageData(0, 0, a.width, a.height), db = xb.getImageData(0, 0, a.width, a.height);
      let distintos = 0;
      for (let i = 0; i < da.data.length; i += 4) {
        const d = Math.max(Math.abs(da.data[i] - db.data[i]), Math.abs(da.data[i + 1] - db.data[i + 1]), Math.abs(da.data[i + 2] - db.data[i + 2]));
        if (d > 24) { distintos++; db.data[i] = 255; db.data[i + 1] = 0; db.data[i + 2] = 0; }
      }
      xb.putImageData(db, 0, 0);
      return { porcentaje: 100 * distintos / (a.width * a.height), dif: distintos ? cb.toDataURL('image/png') : null };
    })()`);
    if (res.tamano) { check(`${archivo}: mismo tamaño`, false, `ref ${res.tamano[0]}x${res.tamano[1]} vs actual ${res.tamano[2]}x${res.tamano[3]}`); continue; }
    if (res.dif) fs.writeFileSync(path.join(dirDif, archivo), Buffer.from(res.dif.split(',')[1], 'base64'));
    check(`${archivo}: igual a la referencia`, res.porcentaje < 0.1, res.porcentaje.toFixed(3) + '% de píxeles distintos');
  }
  await p.close();
}
done(); c.close();
