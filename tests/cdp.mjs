// Ayudante CDP para verificar el cancionero en Chrome headless (Node 22+, sin
// dependencias). Se usa a través de run.ps1, que levanta el servidor y Chrome.
// Ver tests/README.md.
import fs from 'fs';
import { fileURLToPath } from 'url';
export const BASE = 'http://127.0.0.1:8642';
export const OUT = process.argv[2] || fileURLToPath(new URL('./salida', import.meta.url));
fs.mkdirSync(OUT, { recursive: true });
export const wait = ms => new Promise(r => setTimeout(r, ms));

// Firebase falso en memoria: reemplaza el SDK real (nunca escribe en la base)
export const FAKE_FIREBASE = (db = {}, auth = null) => `
window.__db = ${JSON.stringify(db)}; window.__subs = {}; window.__writes = [];
window.__auth = ${JSON.stringify(auth)}; window.__authSubs = [];
const __emit = p => (__subs[p] || []).forEach(cb => cb({ val: () => __db[p] ?? null }));
window.firebase = {
  apps: [], initializeApp() { this.apps.push({}); },
  database() { return { ref(p) { return {
    on(ev, cb) { (__subs[p] = __subs[p] || []).push(cb); setTimeout(() => cb({ val: () => __db[p] ?? null }), 0); },
    once() { return Promise.resolve({ val: () => __db[p] ?? null }); },
    set(v) { __writes.push(['set', p, v]); __db[p] = v; __emit(p); return Promise.resolve(); },
    remove() { __writes.push(['remove', p]); delete __db[p]; __emit(p); return Promise.resolve(); }
  }; } }; },
  auth() { return {
    get currentUser() { return __auth; },
    onAuthStateChanged(cb) { __authSubs.push(cb); setTimeout(() => cb(__auth), 0); },
    signInWithPopup() { __auth = window.__loginAs || null; __authSubs.forEach(cb => cb(__auth)); return Promise.resolve({ user: __auth }); },
    signOut() { __auth = null; __authSubs.forEach(cb => cb(null)); return Promise.resolve(); }
  }; }
};
window.firebase.auth.GoogleAuthProvider = function () {};
window.firebase.auth.GoogleAuthProvider.prototype.setCustomParameters = function () {};
`;

export async function connect() {
  const ver = await (await fetch('http://127.0.0.1:9223/json/version')).json();
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0; const pend = {}; const handlers = [];
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend[m.id]) { pend[m.id](m); delete pend[m.id]; } else if (m.method) handlers.forEach(h => h(m)); };
  const send = (method, params = {}, sessionId) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params, sessionId })); });

  // fake: Firebase falso (FAKE_FIREBASE) en lugar del SDK real.
  // rest: { 'misa_actual': [...] } responde las lecturas REST (modo banco).
  // blockFirebase: el SDK no carga (simula sin conexión a Firebase).
  async function newPage({ fake = null, rest = null, width = 420, height = 900, dialogAccept = false, blockFirebase = false } = {}) {
    const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
    const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
    const s = (m, p) => send(m, p, sessionId);
    await s('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
    await s('Page.enable'); await s('Runtime.enable'); await s('Network.enable');
    const errors = [], dialogs = [], requests = [];
    handlers.push(m => {
      if (m.sessionId !== sessionId) return;
      if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
      if (m.method === 'Page.javascriptDialogOpening') { dialogs.push(m.params.message); s('Page.handleJavaScriptDialog', { accept: dialogAccept }); }
      if (m.method === 'Network.requestWillBeSent') requests.push(m.params.request.url);
      if (m.method === 'Network.webSocketCreated') requests.push('WS ' + m.params.url);
      if (m.method === 'Fetch.requestPaused') {
        const url = m.params.request.url;
        if (url.includes('firebaseio.com/')) {
          const ruta = new URL(url).pathname.replace(/^\//, '').replace(/\.json$/, '');
          const cuerpo = JSON.stringify(rest && ruta in rest ? rest[ruta] : null);
          return s('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: '*' }], body: Buffer.from(cuerpo).toString('base64') });
        }
        if (blockFirebase) return s('Fetch.failRequest', { requestId: m.params.requestId, errorReason: 'Failed' });
        const body = url.includes('firebase-app-compat') ? fake : '';
        s('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'text/javascript' }], body: Buffer.from(body).toString('base64') });
      }
    });
    if (fake || blockFirebase || rest) {
      // Sin esto, el service worker serviría el SDK REAL desde su caché y la
      // página escribiría en la base de verdad
      await s('Network.setBypassServiceWorker', { bypass: true });
      const patterns = [];
      if (fake || blockFirebase) patterns.push({ urlPattern: '*gstatic.com/firebasejs/*' });
      if (rest) patterns.push({ urlPattern: '*firebaseio.com/*' });
      await s('Fetch.enable', { patterns });
    }
    const ev = async expr => { const r = await s('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); return r.result.result?.value ?? (r.result.exceptionDetails ? 'EXC: ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text) : undefined); };
    const go = async (url, ms = 2000) => { requests.length = 0; await s('Page.navigate', { url: BASE + url }); await wait(ms); };
    const shot = async (name, h = height) => { const r = await s('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width, height: h, scale: 1 } }); fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.result.data, 'base64')); };
    const close = () => send('Target.closeTarget', { targetId });
    return { s, ev, go, shot, close, errors, dialogs, requests };
  }
  // Corta o devuelve la red a todos los service workers (la emulación de la
  // página no alcanza a las peticiones que hace el propio service worker)
  async function swOffline(offline) {
    const { result: { targetInfos } } = await send('Target.getTargets');
    const sws = targetInfos.filter(t => t.type === 'service_worker' && t.url.startsWith('http'));
    if (process.env.DEBUG_SW) console.log('  targets:', JSON.stringify(targetInfos.map(t => [t.type, t.url, t.attached])));
    const reqs = [];
    for (const t of sws) {
      const r = await send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
      if (!r.result) { console.log('  (no se pudo adjuntar al SW', t.url, JSON.stringify(r.error), ')'); continue; }
      const { sessionId } = r.result;
      await send('Network.enable', {}, sessionId);
      await send('Network.emulateNetworkConditions', { offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }, sessionId);
      handlers.push(m => { if (m.sessionId === sessionId && m.method === 'Network.requestWillBeSent') reqs.push(m.params.request.url); });
    }
    return { count: sws.length, reqs };
  }
  return { newPage, swOffline, close: () => ws.close() };
}

// Mini aserciones: imprime OK/FALLA y cuenta fallas
let fails = 0;
export function check(name, cond, extra = '') { if (!cond) fails++; console.log(`${cond ? 'OK   ' : 'FALLA'} ${name}${extra ? ' — ' + extra : ''}`); }
export function done() { console.log(fails ? `\n${fails} FALLA(S)` : '\nTODO OK'); }
