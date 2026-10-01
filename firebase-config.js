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

// Devuelve una promesa con `firebase` ya inicializado. Se rechaza si el SDK
// no carga (sin conexión): quien la usa debe seguir funcionando sin datos.
function cargarFirebase() {
  if (!firebaseListo) {
    firebaseListo = ['firebase-app-compat.js', 'firebase-database-compat.js']
      .reduce((cadena, archivo) => cadena.then(() => new Promise((ok, falla) => {
        const s = document.createElement('script');
        s.src = FIREBASE_SDK + archivo;
        s.onload = ok;
        s.onerror = falla;
        document.head.appendChild(s);
      })), Promise.resolve())
      .then(() => {
        if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
        return firebase;
      });
  }
  return firebaseListo;
}

// Lectura puntual por la API REST: no abre conexión en tiempo real
function leerFirebase(ruta) {
  return fetch(`${firebaseConfig.databaseURL}/${ruta}.json`)
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
}
