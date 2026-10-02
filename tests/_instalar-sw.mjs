// Corre f0 y f1 en el mismo navegador, después de que el service worker ya
// esté instalado y controlando, para confirmar que el Firebase falso se sigue usando
import { connect, check, wait } from './cdp.mjs';
const c = await connect();
const p = await c.newPage();
await p.go('/index.html', 3000);
await p.ev('navigator.serviceWorker.ready.then(() => true)'); await wait(3000);
await p.go('/index.html', 2000);
check('SW controlando antes de la regresión', await p.ev('!!navigator.serviceWorker.controller'));
await p.close(); c.close();
