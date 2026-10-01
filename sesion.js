// Barra de sesión del modo admin (AGENTS.md D16), compartida por index.html y
// cancion.html. Solo se usa con ?admin=true (nunca en banco).
//
// panelSesion(contenedor) muestra el estado y los botones Entrar / Cerrar
// sesión. Cada vez que cambia, actualiza `esAdminOk` y dispara el evento
// 'sesion-admin' en document (detail = true si puede editar).

let esAdminOk = false;

function panelSesion(contenedor) {
  const estilo = document.createElement('style');
  estilo.textContent = `
    .sesion-bar {
      display: flex; align-items: center; justify-content: space-between;
      flex-wrap: wrap; gap: 0.5rem;
      margin-bottom: 1rem; padding: 0.6rem 0.9rem;
      background: var(--bg); border: 1.5px solid var(--border-mid);
      border-left: 4px solid var(--brown-mid); border-radius: 12px;
      font-size: 1rem; color: var(--ink);
      box-shadow: 0 2px 8px rgba(107,66,38,0.08);
    }
    .sesion-bar.admin { border-left-color: #4E7A3A; }
    .sesion-bar.no-admin, .sesion-bar.sin-conexion { border-left-color: #A4452C; }
    .sesion-texto { flex: 1; min-width: 12rem; overflow-wrap: anywhere; }
    .sesion-btn {
      padding: 0.45rem 1rem; border-radius: 50px; cursor: pointer;
      border: 1.5px solid var(--border-mid); background: var(--bg);
      color: var(--text-strong); font-family: 'EB Garamond', serif; font-size: 1rem;
      white-space: nowrap;
    }
    .sesion-btn.principal { background: var(--brown-dark); color: #fff; border-color: transparent; }
    .sesion-btn:disabled { opacity: 0.6; cursor: wait; }`;
  document.head.appendChild(estilo);

  const barra = document.createElement('div');
  barra.className = 'sesion-bar';
  barra.setAttribute('role', 'status');
  const texto = document.createElement('span');
  texto.className = 'sesion-texto';
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'sesion-btn';
  barra.append(texto, boton);
  contenedor.prepend(barra);

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

  function mostrar(estado, mensaje, textoBoton, nuevaAccion, principal) {
    barra.className = 'sesion-bar ' + estado;
    texto.textContent = mensaje;
    boton.hidden = !textoBoton;
    boton.textContent = textoBoton || '';
    boton.classList.toggle('principal', !!principal);
    accion = nuevaAccion;
  }

  observarAdmin(({ estado, email }) => {
    if (estado === 'cargando') mostrar(estado, 'Verificando sesión…');
    else if (estado === 'sin-sesion') mostrar(estado, 'Para editar, entrá con tu cuenta de Google.', 'Entrar con Google', entrarConGoogle, true);
    else if (estado === 'no-admin') mostrar(estado, `Tu cuenta (${email}) no está autorizada para editar.`, 'Cerrar sesión', salirDeSesion);
    else if (estado === 'admin') mostrar(estado, `✓ Admin: ${email}`, 'Cerrar sesión', salirDeSesion);
    else mostrar(estado, '📴 Sin conexión: no se puede verificar la sesión ni editar.');

    esAdminOk = estado === 'admin';
    document.dispatchEvent(new CustomEvent('sesion-admin', { detail: esAdminOk }));
  });
}
