// Barra de sesión del modo admin (AGENTS.md D16), compartida por index.html y
// cancion.html. Solo se usa con ?admin=true (nunca en banco).
//
// panelSesion(contenedor) muestra el estado y los botones Entrar / Cerrar
// sesión. Cada vez que cambia, actualiza `esAdminOk` y dispara el evento
// 'sesion-admin' en document (detail = true si puede editar).
//
// Confirmar la sesión tarda (carga el login de Google y consulta admins/ en
// la base). Para que la página no espere ni se corra, la última sesión de
// admin de este celular queda guardada (localStorage.sesion_admin) y se
// muestra al instante; Firebase la confirma después. Es solo para la vista:
// lo que se puede escribir lo deciden las reglas de la base.
// La barra va dentro de #sesion-slot, cuyo lugar ya está reservado por CSS
// (tema.js marca data-admin en <html> antes de pintar).

let esAdminOk = false;
let usuarioAdmin = null;   // { email, nombre } del admin con sesión (para "Publicada por…")

function panelSesion(contenedor) {
  const recordada = leerCopia('sesion_admin');
  const barra = document.createElement('div');
  barra.className = 'sesion-bar';
  barra.setAttribute('role', 'status');
  const texto = document.createElement('span');
  texto.className = 'sesion-texto';
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'sesion-btn';
  barra.append(texto, boton);
  const lugar = document.getElementById('sesion-slot');
  if (lugar) lugar.appendChild(barra);
  else contenedor.prepend(barra);

  let accion = null;
  boton.addEventListener('click', () => {
    if (!accion) return;
    boton.disabled = true;
    accion()
      .catch(err => {
        if (err && (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request')) return;
        alert('❌ No se pudo iniciar sesión: ' + (err && err.message ? err.message : err));
      })
      .finally(() => { boton.disabled = false; });
  });

  // Sin botón, el lugar del botón queda igual (invisible): la barra no cambia
  // de alto entre "Verificando…" y "Admin"
  function mostrar(estado, mensaje, textoBoton, nuevaAccion, principal) {
    barra.className = 'sesion-bar ' + estado;
    texto.textContent = mensaje;
    texto.title = mensaje;
    boton.textContent = textoBoton || 'Cerrar sesión';
    boton.style.visibility = textoBoton ? '' : 'hidden';
    boton.classList.toggle('principal', !!principal);
    accion = nuevaAccion;
  }

  function avisarCambio(admin, email, nombre) {
    esAdminOk = admin;
    usuarioAdmin = admin ? { email, nombre: nombre || '' } : null;
    document.dispatchEvent(new CustomEvent('sesion-admin', { detail: esAdminOk }));
  }

  // Sesión recordada: se muestra ya. esAdminOk queda listo antes de que la
  // página dibuje; el evento sale cuando termina el script que llamó a esto
  if (recordada && recordada.email) {
    mostrar('admin', `✓ Admin: ${recordada.email}`, 'Cerrar sesión', salirDeSesion);
    esAdminOk = true;
    usuarioAdmin = { email: recordada.email, nombre: recordada.nombre || '' };
    Promise.resolve().then(() => avisarCambio(true, recordada.email, recordada.nombre));
  }

  observarAdmin(({ estado, email, nombre }) => {
    if (recordada && (estado === 'cargando' || estado === 'sin-conexion')) {
      // Mientras se confirma (o sin conexión) sigue la sesión recordada: el
      // borrador de la misa se arma igual, y escribir ya avisa si no hay red
      if (estado === 'sin-conexion') texto.textContent = `✓ Admin: ${recordada.email} (sin conexión)`;
      return;
    }
    if (estado === 'cargando') mostrar(estado, 'Verificando sesión…');
    else if (estado === 'sin-sesion') mostrar(estado, 'Para editar, iniciá sesión.', 'Entrar con Google', entrarConGoogle, true);
    else if (estado === 'no-admin') mostrar(estado, `Tu cuenta (${email}) no está autorizada para editar.`, 'Cerrar sesión', salirDeSesion);
    else if (estado === 'admin') mostrar(estado, `✓ Admin: ${email}`, 'Cerrar sesión', salirDeSesion);
    else mostrar(estado, 'Sin conexión: no se puede verificar la sesión ni editar.');

    if (estado === 'admin') guardarCopia('sesion_admin', { email, nombre: nombre || '' });
    else if (estado === 'sin-sesion' || estado === 'no-admin') guardarCopia('sesion_admin', null);

    const admin = estado === 'admin';
    // Confirmó lo mismo que ya se mostraba: no hace falta redibujar
    if (admin && esAdminOk && usuarioAdmin && usuarioAdmin.email === email) {
      usuarioAdmin.nombre = nombre || '';
      return;
    }
    avisarCambio(admin, email, nombre);
  });
}
