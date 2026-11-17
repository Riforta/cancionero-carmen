import { connect, check, done, wait } from './cdp.mjs';
const c = await connect();

// Buscador: se esconde al bajar y vuelve al subir o al tocarlo (D20)
{
  // Base real (solo lectura): un Firebase falso dejaría otra misa en la copia
  // local (misa_cache), que leen las pruebas siguientes
  const p = await c.newPage({ width: 390, height: 760 });
  await p.go('/index.html?cat=todas', 2500);
  const escondido = () => p.ev(`document.getElementById('searchWrap').classList.contains('escondido')`);
  const bajarA = async y => { await p.ev(`window.scrollTo(0, ${y})`); await wait(150); };
  check('buscador: visible al entrar', !(await escondido()));
  await bajarA(100);
  check('buscador: cerca del principio no se esconde', !(await escondido()));
  await bajarA(600);
  check('buscador: al bajar se esconde', await escondido());
  check('buscador: escondido detrás del encabezado', await p.ev(`document.getElementById('searchWrap').getBoundingClientRect().bottom <= document.querySelector('header').getBoundingClientRect().bottom + 1`), '');
  await bajarA(560);
  check('buscador: al subir vuelve', !(await escondido()));
  await bajarA(1200);
  await p.ev(`document.getElementById('si').focus()`); await wait(100);
  check('buscador: al tocarlo vuelve', !(await escondido()));
  await bajarA(1600);
  check('buscador: mientras se escribe no se esconde', !(await escondido()));
  check('buscador: sin errores', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}
done(); c.close();
