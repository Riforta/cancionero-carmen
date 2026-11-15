// Volver de una canción al índice: misma búsqueda y misma posición
import { connect, check, done, wait, FAKE_FIREBASE } from './cdp.mjs';
const c = await connect();
const p = await c.newPage({ fake: FAKE_FIREBASE({ misa_actual: ['ent_bendecire'] }), width: 390, height: 600 });
const bajarA = y => p.ev(`window.scrollTo({ top: ${y}, behavior: 'instant' })`);
const buscar = q => p.ev(`{ const i = document.getElementById('si'); i.value = ${JSON.stringify(q)}; i.dispatchEvent(new Event('input')); }`);
const volver = async () => { await p.ev(`document.querySelector('.back-link').click()`); await wait(2000); };
// Espera (hasta 10 s) a que la búsqueda por letra termine de armar su índice
const conLetras = async () => { for (let i = 0; i < 40 && !(await p.ev('!!indiceLetras')); i++) await wait(250); await wait(200); };

// Sin copias de otras pruebas: los avisos guardados cambian el alto de la página
await p.go('/index.html?cat=todas', 500);
await p.ev(`localStorage.removeItem('avisos_cache')`);

// 1. Búsqueda (título y letra)
await p.go('/index.html?cat=todas');
await buscar('cordero'); await conLetras();
const filas = await p.ev(`document.querySelectorAll('.song-row').length`);
await bajarA(180); await wait(100);
const y = await p.ev('scrollY');
await p.ev(`document.querySelectorAll('.song-row')[2].click()`); await wait(1500);
check('entra a la canción', (await p.ev('location.pathname')).endsWith('/cancion.html'));
await volver(); await conLetras();
check('vuelve con la misma búsqueda', (await p.ev(`document.getElementById('si').value`)) === 'cordero' && (await p.ev(`document.querySelectorAll('.song-row').length`)) === filas, `${filas} filas`);
check('vuelve a la misma posición', y > 100 && Math.abs((await p.ev('scrollY')) - y) <= 4, `antes ${y}, ahora ${await p.ev('scrollY')}`);
check('sin animación de entrada al volver', await p.ev(`document.body.classList.contains('sin-entrada')`));
check('lo anotado se usa una sola vez', await p.ev(`sessionStorage.getItem('indice_vuelta') === null`));

// 2. Búsqueda por letra: vuelve con el verso encontrado
await buscar('toda mi libertad'); await conLetras();
check('búsqueda por letra: hay resultado', (await p.ev(`document.querySelectorAll('.song-snippet').length`)) > 0);
await p.ev(`document.querySelector('.song-row').click()`); await wait(1500);
await volver(); await conLetras();
check('vuelve con el verso encontrado', (await p.ev(`document.getElementById('si').value`)) === 'toda mi libertad' && (await p.ev(`document.querySelectorAll('.song-snippet').length`)) > 0);

// 3. Una categoría, más abajo en la lista
await p.go('/index.html?cat=comunion');
await bajarA(700); await wait(100);
// Lo que importa es dónde queda en pantalla la canción que se tocó: si algo de
// arriba crece después de volver, el navegador ajusta el desplazamiento
const filaEnPantalla = () => p.ev(`document.querySelectorAll('.song-row')[8].getBoundingClientRect().top`);
const y2 = await p.ev('scrollY');
const fila2 = await filaEnPantalla();
await p.ev(`document.querySelectorAll('.song-row')[8].click()`); await wait(1500);
await volver();
check('categoría: la canción tocada queda en el mismo lugar de la pantalla', y2 > 600 && Math.abs((await filaEnPantalla()) - fila2) <= 4, `antes ${fila2.toFixed(0)}, ahora ${(await filaEnPantalla()).toFixed(0)}`);

// 4. Si se entra al índice por otro lado, no se restaura nada
await p.ev(`document.querySelectorAll('.song-row')[8].click()`); await wait(1500);
await p.go('/index.html?cat=entrada');
check('otra categoría: arranca arriba', (await p.ev('scrollY')) === 0 && (await p.ev(`document.getElementById('si').value`)) === '');
check('sin errores', p.errors.length === 0, p.errors.join(' | '));
await p.close();
done(); c.close();
