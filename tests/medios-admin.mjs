// Audios y links cargados desde la app (Firebase medios/<id>)
import fs from 'fs';
import { connect, check, done, wait, FAKE_FIREBASE } from './cdp.mjs';
const c = await connect();
const ADMIN = { email: 'test@gmail.com' };
const YT = { url: 'https://www.youtube.com/watch?v=mfQE3ep5iLo', etiqueta: 'Versión de prueba' };
const SPOTIFY = 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT';
const DB = () => ({
  'admins/test@gmail,com': true,
  'medios/ofert_toma': [YT],
  // La primera repite el link que ya está en songs.js para esa canción
  'medios/ador_la-confianza': [{ url: 'https://www.youtube.com/watch?v=OClD97tGVNs' }, { url: SPOTIFY, etiqueta: 'En Spotify' }]
});
const estado = p => p.ev(`(() => { const l = document.getElementById('mediosLista'); return { visible: !document.getElementById('medios').hidden, n: l.children.length, quitar: l.querySelectorAll('.medio-btn').length, agregar: !document.getElementById('medioAgregar').hidden, form: !document.getElementById('medioForm').hidden, etiquetas: [...l.querySelectorAll('.medio-etiqueta')].map(e => e.textContent) }; })()`);
const cargar = (p, url, etiqueta) => p.ev(`{ medioAgregar.click(); medioUrl.value = ${JSON.stringify(url)}; medioEtiqueta.value = ${JSON.stringify(etiqueta)}; medioSave.click(); }`);

{ // Admin con sesión: alta y baja
  const p = await c.newPage({ fake: FAKE_FIREBASE(DB(), ADMIN), dialogAccept: true });
  await p.go('/cancion.html?id=ofert_toma&admin=true');
  if (!(await p.ev('Array.isArray(window.__writes)'))) throw new Error('Firebase falso no cargado: aborto');
  let e = await estado(p);
  check('admin: ve el audio guardado, con Quitar y Agregar', e.visible && e.n === 1 && e.quitar === 1 && e.agregar && !e.form, JSON.stringify(e));
  check('el reproductor es el de YouTube', (await p.ev(`document.querySelector('#mediosLista iframe.youtube')?.src`)) === 'https://www.youtube-nocookie.com/embed/mfQE3ep5iLo');

  await cargar(p, 'http://ejemplo.com/audio.mp3', ''); await wait(200);
  check('link sin https: avisa y no guarda', p.dialogs.some(d => d.includes('https://')) && (await p.ev('__writes.length')) === 0, p.dialogs.join(' | '));
  await cargar(p, YT.url, ''); await wait(200);
  check('link repetido: avisa y no guarda', p.dialogs.some(d => d.includes('ya está cargado')) && (await p.ev('__writes.length')) === 0);

  await cargar(p, SPOTIFY, 'En Spotify'); await wait(300);
  const w = await p.ev('JSON.stringify(__writes)');
  check('guardar: escribe la lista completa en medios/<id>', w === JSON.stringify([['set', 'medios/ofert_toma', [YT, { url: SPOTIFY, etiqueta: 'En Spotify' }]]]), w);
  e = await estado(p);
  check('guardar: aparece el reproductor nuevo y se cierra el formulario', e.n === 2 && !e.form && e.agregar && e.etiquetas.join('|') === 'Versión de prueba|En Spotify', JSON.stringify(e));

  await p.ev(`document.querySelector('#mediosLista .medio-btn').click()`); await wait(300);
  check('quitar: guarda la lista sin ese link', (await p.ev('JSON.stringify(__writes[1])')) === JSON.stringify(['set', 'medios/ofert_toma', [{ url: SPOTIFY, etiqueta: 'En Spotify' }]]), await p.ev('JSON.stringify(__writes[1])'));
  await p.ev(`document.querySelector('#mediosLista .medio-btn').click()`); await wait(300);
  check('quitar el último: borra el nodo', (await p.ev('JSON.stringify(__writes[2])')) === JSON.stringify(['remove', 'medios/ofert_toma']));
  e = await estado(p);
  check('sin audios: el admin sigue viendo "Agregar"', e.visible && e.n === 0 && e.agregar, JSON.stringify(e));
  check('sin errores', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}
{ // Músicos: los ven, no los editan. Se mezclan con los de songs.js sin repetir
  const p = await c.newPage({ fake: FAKE_FIREBASE(DB(), null) });
  await p.go('/cancion.html?id=ofert_toma');
  let e = await estado(p);
  check('músicos: ven el audio, sin botones de edición', e.visible && e.n === 1 && e.quitar === 0 && !e.agregar, JSON.stringify(e));
  await p.go('/cancion.html?id=ador_la-confianza');
  e = await estado(p);
  check('songs.js + Firebase, sin repetir el mismo link', e.n === 2 && e.etiquetas.join('|') === 'En Spotify', JSON.stringify(e));
  await p.go('/cancion.html?id=ofert_toma&admin=true');
  e = await estado(p);
  check('admin sin sesión: sin botones de edición', e.n === 1 && e.quitar === 0 && !e.agregar, JSON.stringify(e));
  await p.close();
}
{ // Banco: ni se piden
  const p = await c.newPage({ rest: { misa_actual: ['ofert_toma'], 'medios/ofert_toma': [YT] } });
  await p.go('/cancion.html?id=ofert_toma&modo=banco', 2500);
  check('banco: no pide medios', !p.requests.some(u => u.includes('medios')));
  check('banco: sección oculta', await p.ev(`getComputedStyle(document.getElementById('medios')).display === 'none'`));
  await p.ev(`localStorage.removeItem('medios_ofert_toma')`);
  await p.close();
}
{ // Reglas de la base
  const reglas = JSON.parse(fs.readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8')).rules;
  const m = reglas.medios;
  check('reglas: lectura pública, escritura solo de admins', m['.read'] === true && m.$id['.write'].includes("root.child('admins')"));
  check('reglas: hasta 5, url https y sin campos extra', m.$id.$i['.validate'].includes('[0-4]') && m.$id.$i.url['.validate'].includes("beginsWith('https://')") && m.$id.$i.$otro['.validate'] === false);
}
done(); c.close();
