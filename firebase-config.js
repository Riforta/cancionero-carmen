// Config de Firebase compartida por index.html y cancion.html.
// Es pública por diseño (así funciona Firebase web): la seguridad depende
// de las reglas de la base, no de esconder estos valores.
const firebaseConfig = {
  apiKey: "AIzaSyAS91FegRQfqV-iRYT2Qeo10bj_wN3rbJE",
  authDomain: "coro-97958.firebaseapp.com",
  databaseURL: "https://coro-97958-default-rtdb.firebaseio.com",
  projectId: "coro-97958",
  storageBucket: "coro-97958.firebasestorage.app",
  messagingSenderId: "126954599133",
  appId: "1:126954599133:web:fd604b7e551b514040a134",
  measurementId: "G-MK1R5WF7G4"
};

// El plan gratuito admite 100 conexiones en tiempo real simultáneas. Por eso
// el SDK se carga bajo demanda: músicos y admin lo usan (datos en vivo), el
// modo banco nunca lo carga y lee con leerFirebase() (ver AGENTS.md D14).
const FIREBASE_SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
let firebaseListo = null;
let authListo = null;

function cargarScript(src) {
  return new Promise((ok, falla) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = ok;
    s.onerror = falla;
    document.head.appendChild(s);
  });
}

// Devuelve una promesa con `firebase` ya inicializado. Se rechaza si el SDK
// no carga (sin conexión): quien la usa debe seguir funcionando sin datos.
function cargarFirebase() {
  if (!firebaseListo) {
    firebaseListo = cargarScript(FIREBASE_SDK + 'firebase-app-compat.js')
      .then(() => cargarScript(FIREBASE_SDK + 'firebase-database-compat.js'))
      .then(() => {
        if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
        return firebase;
      });
  }
  return firebaseListo;
}

// ── Sesión de admin con Google (AGENTS.md D16) ──
// Los admins están en la base: admins/<email en minúsculas con los puntos
// cambiados por comas>: true. Las reglas (database.rules.json) solo dejan
// escribir a esos emails; esto decide qué botones mostrar.
function claveAdmin(email) {
  return String(email || '').toLowerCase().replace(/\./g, ',');
}

// Auth se carga solo en modo admin (músicos y banco no lo necesitan)
function cargarAuth() {
  if (!authListo) {
    authListo = cargarFirebase()
      .then(fb => fb.auth ? fb : cargarScript(FIREBASE_SDK + 'firebase-auth-compat.js').then(() => fb))
      .then(fb => fb.auth());
  }
  return authListo;
}

// Llama a cb({ estado, email }) cada vez que cambia la sesión. Estados:
// 'cargando', 'sin-sesion', 'no-admin', 'admin', 'sin-conexion'
function observarAdmin(cb) {
  cb({ estado: 'cargando' });
  cargarAuth().then(auth => {
    auth.onAuthStateChanged(user => {
      if (!user) { cb({ estado: 'sin-sesion' }); return; }
      firebase.database().ref('admins/' + claveAdmin(user.email)).once('value')
        .then(snap => cb({ estado: snap.val() === true ? 'admin' : 'no-admin', email: user.email, nombre: user.displayName }))
        .catch(() => cb({ estado: 'no-admin', email: user.email, nombre: user.displayName }));
    });
  }).catch(() => cb({ estado: 'sin-conexion' }));
}

// Popup (el redirect falla en GitHub Pages: el navegador bloquea el
// almacenamiento de terceros de firebaseapp.com). Si el popup está
// bloqueado, se intenta igual con redirect
function entrarConGoogle() {
  return cargarAuth().then(auth => {
    const proveedor = new firebase.auth.GoogleAuthProvider();
    proveedor.setCustomParameters({ prompt: 'select_account' });
    return auth.signInWithPopup(proveedor).catch(err => {
      if (err && err.code === 'auth/popup-blocked') return auth.signInWithRedirect(proveedor);
      throw err;
    });
  });
}

function salirDeSesion() {
  return cargarAuth().then(auth => auth.signOut());
}

// Lectura puntual por la API REST: no abre conexión en tiempo real
function leerFirebase(ruta) {
  return fetch(`${firebaseConfig.databaseURL}/${ruta}.json`)
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
}

// ── Leer y escribir datos (AGENTS.md D18) ──
// Usan leerCopia/guardarCopia y MODO de comun.js.

// Sigue un dato: cb(valor) primero con la copia local (si hay) y después con
// cada valor publicado. En banco, una sola lectura por REST (D14); en el
// resto, en vivo con el SDK. La copia se entrega en un microtask, así la
// página termina de definir todo antes del primer cb. Devuelve una promesa
// con la ref del SDK para escribir (null en banco o sin conexión).
function seguirDato(ruta, claveCopia, cb) {
  const copia = leerCopia(claveCopia);
  if (copia !== null) Promise.resolve().then(() => cb(copia));
  const recibir = val => { guardarCopia(claveCopia, val); cb(val); };
  if (MODO.banco) {
    leerFirebase(ruta).then(recibir).catch(() => {});
    return Promise.resolve(null);
  }
  return cargarFirebase()
    .then(fb => {
      const ref = fb.database().ref(ruta);
      ref.on('value', snap => recibir(snap.val()));
      return ref;
    })
    .catch(() => null);
}

// Ids de la misa publicada que siguen existiendo en SONGS (Firebase puede
// devolver el array como objeto)
function normalizarMisa(val) {
  const ids = Array.isArray(val) ? val : (val ? Object.values(val) : []);
  return ids.filter(id => SONGS.some(s => s.id === id));
}

// Misa de Hoy (misa_actual), ya normalizada. La usan las dos páginas
function suscribirMisa(cb) {
  return seguirDato('misa_actual', 'misa_cache', val => cb(normalizarMisa(val)));
}

// Escribe un dato desde la web (null o '' lo borra): sin conexión no lo
// intenta (no quedaría encolado sin que nadie se entere), deshabilita el botón
// mientras tanto y avisa si falla. La promesa se rechaza si no se escribió.
// `accion`: "publicar la misa", "guardar la nota"… (para los avisos)
function escribirDato(ref, valor, boton, accion) {
  if (!ref || !navigator.onLine) {
    alert(`❌ Sin conexión: no se puede ${accion} ahora.`);
    return Promise.reject(new Error('sin conexión'));
  }
  if (boton) boton.disabled = true;
  const borrar = valor === null || valor === '';
  return (borrar ? ref.remove() : ref.set(valor))
    .catch(err => { alert(`❌ No se pudo ${accion}: ${err.message}`); throw err; })
    .finally(() => { if (boton) boton.disabled = false; });
}

// Como escribirDato, pero varias rutas en una sola operación: se guardan
// todas o ninguna. `ref` es cualquier ref del SDK (se usa su raíz);
// `cambios` = { 'ruta': valor, … }
function escribirVarios(ref, cambios, boton, accion) {
  if (!ref || !navigator.onLine) {
    alert(`❌ Sin conexión: no se puede ${accion} ahora.`);
    return Promise.reject(new Error('sin conexión'));
  }
  if (boton) boton.disabled = true;
  return ref.root.update(cambios)
    .catch(err => { alert(`❌ No se pudo ${accion}: ${err.message}`); throw err; })
    .finally(() => { if (boton) boton.disabled = false; });
}

// Hora del servidor de Firebase (para "cuándo" se publicó algo)
function horaServidor() {
  return firebase.database.ServerValue.TIMESTAMP;
}
