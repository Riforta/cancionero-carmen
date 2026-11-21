// Editor de acordes de una canción (AGENTS.md D23; etapa 2 del plan de
// canciones editables, §6). Solo para un admin con sesión (D16), nunca en
// banco. Pensado para el celular: se toca, no se arrastra (el dedo taparía la
// sílaba).
//
// - El lápiz de al lado de "Acordes" abre el editor. Los acordes se ven en el
//   tono original, que es como se guardan.
// - Tocar un acorde lo elige. ◀ ▶ lo corren una letra; tocar otra letra (de
//   cualquier renglón) lo lleva ahí. "Cambiar" le pone otro nombre, "Borrar"
//   lo saca y "Listo" lo suelta.
// - Tocar una letra sin un acorde elegido la marca: "+ Acorde acá" pide el
//   nombre. Se escribe como venga (lam, Am, La-…) y queda en notación latina
//   (normalizarAcorde, acordes.js); avisa si no tiene diagrama de guitarra.
// - Se ve igual a como va a quedar: la letra se dibuja con el mismo código.
//   Nada cambia hasta "Guardar"; "Descartar" deja todo como estaba.
// - Pestaña "Texto" (D24): la letra entera en el formato de corchetes, con la
//   vista previa abajo, y "Pegar con acordes arriba" (desdeAcordesArriba,
//   letra.js). Una canción nueva abre directo acá (?editar=texto).
//
// Al guardar se escribe canciones/<id> = { letra, por, cuando, anterior }:
// pisa a letras/<id>.txt (cancion.js, LÓGICA 0). `anterior` es la versión
// que se reemplaza, para "Deshacer el último cambio"; "Volver a la versión
// original" borra la corrección.
//
// Usa de cancion.js: letraBox, idValido, isAdmin, esBanco, correccion,
// cancionRef, editandoLetra, textoVigente, dibujarLetra, actualizarLetra y
// pintarCorreccion; de letra.js y acordes.js, sus funciones puras.

if (isAdmin && !esBanco && idValido) {
  const $ = id => document.getElementById(id);
  const btnEditar = $('editarAcordes');
  const barra = $('editor-barra');
  const info = $('ebInfo');
  const filas = { nada: $('ebNada'), acorde: $('ebAcorde'), silaba: $('ebSilaba'), campo: $('ebCampo') };
  const inputNombre = $('ebNombre');
  const aviso = $('ebAviso');
  // Quietos mientras se edita: el tono (se edita en el original), mostrar u
  // ocultar los acordes, el lápiz y la corrección (deshacer, volver)
  const QUIETOS = [document.querySelector('.toolbar'), document.querySelector('.tono-info'), $('toggleChords'), btnEditar, $('correccion')];
  const hayResaltado = !!(window.CSS && CSS.highlights && window.Highlight);

  let texto = null;      // la letra que se está editando, en el formato de letras/
  let inicial = null;    // cómo estaba al empezar: si es igual, no hay cambios
  let base = null;       // la versión vigente al empezar: si cambia, otro admin guardó
  let sel = null;        // acorde elegido: { r, k } = renglón y n.º de acorde en él
  let marca = null;      // letra elegida para agregar un acorde: { r, pos }
  let campo = null;      // 'agregar' | 'cambiar' mientras se escribe un nombre
  let saliendo = false;  // ya se confirmó salir con cambios sin guardar
  let modo = 'acordes';  // 'acordes' (tocar) | 'texto' (escribir)
  let dudasPegado = [];  // lo dudoso del último "Pegar con acordes arriba"
  const panelTexto = $('editorTexto');
  const area = $('etArea');

  // El texto como se guardaría: nombres en notación latina, sin espacios al
  // final ni renglones vacíos en las puntas
  const textoFinal = () => escribirLetra(parsearLetra(normalizarNombres(texto, normalizarAcorde)));
  const hayCambios = () => editandoLetra && (modo === 'texto' ? textoFinal() : texto) !== inicial;
  const tieneAcordesOLetra = t => parsearLetra(t).some(r => r.tipo === 'letra' || r.tipo === 'acordes');
  const renglones = () => parsearLetra(texto);
  // Un elemento por renglón de parsearLetra, en el mismo orden (htmlDeLetra)
  const elementos = () => [...letraBox.querySelectorAll('.renglon, .subtitulo, .letra-pendiente')];
  const nombreDe = a => a.opcional ? `(${a.nombre})` : a.nombre;

  // También una letra pendiente: se carga en la pestaña "Texto"
  const puedeEditar = () => esAdminOk && textoVigente() !== null;
  function pintarBoton() {
    btnEditar.hidden = !editandoLetra && !puedeEditar();
  }

  // Los acordes de un renglón (de letra o de solo acordes), en orden
  function acordesDe(rg) {
    if (!rg) return [];
    if (rg.tipo === 'letra') return acordesDeRenglon(rg).acordes;
    if (rg.tipo === 'acordes') return rg.partes.filter(p => p.acorde).map(p => ({ ...p.acorde, pos: null }));
    return [];
  }

  // ── Abrir y cerrar ──
  function empezar(modoInicial) {
    if (editandoLetra || !puedeEditar()) return;
    if (letraBox.classList.contains('no-chords')) $('toggleChords').click();
    $('chord-popover').style.display = 'none';
    base = textoVigente();
    // Un solo espacio entre palabras: cada posición es una letra o un hueco
    texto = inicial = escribirLetra(parsearLetra(base).map(normalizarRenglon));
    sel = marca = campo = null;
    saliendo = false;
    dudasPegado = [];
    editandoLetra = true;
    ponerModo(modoInicial === 'texto' || !tieneAcordesOLetra(base) ? 'texto' : 'acordes');
    document.body.classList.add('editando-acordes');
    letraBox.classList.add('editando');
    btnEditar.classList.add('active');
    QUIETOS.forEach(el => { if (el) el.inert = true; });
    pintarCorreccion();
    barra.hidden = false;
    dibujar();
    pintarBarra();
    ajustarAlTeclado();
  }

  function terminar() {
    editandoLetra = false;
    texto = inicial = base = sel = marca = campo = null;
    if (hayResaltado) CSS.highlights.delete('editor-letra');
    document.body.classList.remove('editando-acordes');
    letraBox.classList.remove('editando');
    btnEditar.classList.remove('active');
    QUIETOS.forEach(el => { if (el) el.inert = false; });
    barra.hidden = true;
    inputNombre.blur();
    panelTexto.hidden = true;
    letraBox.classList.remove('solo-vista');
    modo = 'acordes';
    actualizarLetra(true);   // la versión vigente, en el tono que se estaba viendo
    pintarBoton();
  }

  // ── Dibujo ──
  function dibujar() {
    dibujarLetra(texto);   // el mismo dibujo de siempre (tono original mientras se edita)
    marcar();
  }

  // El acorde elegido y la letra sobre la que cae (o la marcada)
  function marcar() {
    letraBox.querySelectorAll('c.sel').forEach(c => c.classList.remove('sel'));
    if (hayResaltado) CSS.highlights.delete('editor-letra');
    const els = elementos();
    const rs = renglones();
    let lugar = marca;
    if (sel) {
      const c = els[sel.r] && els[sel.r].querySelectorAll('c')[sel.k];
      if (c) c.classList.add('sel');
      const a = acordesDe(rs[sel.r])[sel.k];
      lugar = a && a.pos !== null ? { r: sel.r, pos: a.pos } : null;
    }
    if (lugar) resaltar(els[lugar.r], lugar.pos);
  }

  // Los nodos de texto de la letra de un renglón (sin los nombres de los
  // acordes) y dónde empieza cada uno en el texto del renglón
  function nodosDeTexto(div) {
    const nodos = [];
    let desde = 0;
    const w = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (n.parentElement.closest('c')) continue;
      nodos.push({ nodo: n, desde });
      desde += n.data.length;
    }
    return nodos;
  }

  // Resalta una letra (CSS Custom Highlight API; si el navegador no la tiene,
  // se ve solo el acorde elegido)
  function resaltar(div, pos) {
    if (!div || !hayResaltado) return;
    const t = nodosDeTexto(div).find(({ nodo, desde }) => pos >= desde && pos < desde + nodo.data.length);
    if (!t) return;
    const rango = document.createRange();
    rango.setStart(t.nodo, pos - t.desde);
    rango.setEnd(t.nodo, pos - t.desde + 1);
    CSS.highlights.set('editor-letra', new Highlight(rango));
  }

  // "sobre re_c_ibe" (la letra subrayada) o "después de «mí,»"
  function describirLugar(el, t, pos) {
    if (pos < t.length && t[pos] !== ' ') {
      let a = pos, b = pos + 1;
      while (a > 0 && t[a - 1] !== ' ') a--;
      while (b < t.length && t[b] !== ' ') b++;
      const u = document.createElement('u');
      u.textContent = t[pos];
      el.append('sobre ', t.slice(a, pos), u, t.slice(pos + 1, b));
    } else {
      let b = pos;
      while (b > 0 && t[b - 1] === ' ') b--;
      let a = b;
      while (a > 0 && t[a - 1] !== ' ') a--;
      el.append(b > 0 ? `después de «${t.slice(a, b)}»` : 'al principio del renglón');
    }
  }

  function negrita(texto) {
    const b = document.createElement('b');
    b.textContent = texto;
    return b;
  }

  // La barra muestra una fila según lo elegido: nada, un acorde, una letra o
  // el campo para escribir un nombre
  function pintarBarra() {
    const rs = renglones();
    if (sel && !acordesDe(rs[sel.r])[sel.k]) sel = null;
    if ((campo === 'cambiar' && !sel) || (campo === 'agregar' && !marca)) campo = null;
    const estado = campo ? 'campo' : sel ? 'acorde' : marca ? 'silaba' : 'nada';
    Object.entries(filas).forEach(([k, el]) => { el.hidden = k !== estado; });
    $('ebEstado').hidden = estado !== 'nada';
    aviso.hidden = estado !== 'campo' || !aviso.textContent;
    info.replaceChildren();
    if (estado === 'nada') {
      info.append(modo === 'texto'
        ? 'Escribí o pegá la letra arriba; abajo se ve cómo queda. Tono original.'
        : 'Tocá un acorde para moverlo o cambiarlo, o una letra para agregar uno. Se edita en el tono original.');
      $('ebModo').textContent = modo === 'texto' ? 'Acordes' : 'Texto';
      $('ebModo').setAttribute('aria-label', modo === 'texto' ? 'Mover acordes tocando' : 'Escribir la letra como texto');
      const otra = textoVigente() !== base;
      $('ebEstado').textContent = otra ? 'Se guardó otra versión mientras editabas'
        : hayCambios() ? 'Hay cambios sin guardar' : 'Sin cambios';
      $('ebSalir').textContent = hayCambios() ? 'Descartar' : 'Salir';
      $('ebGuardar').disabled = !hayCambios();
    } else if (estado === 'acorde') {
      const rg = rs[sel.r];
      const a = acordesDe(rg)[sel.k];
      info.append(negrita(nombreDe(a)), ' ');
      if (rg.tipo === 'letra') {
        const t = acordesDeRenglon(rg).texto;
        describirLugar(info, t, a.pos);
        $('ebIzq').disabled = a.pos <= 0;
        $('ebDer').disabled = a.pos >= t.length;
      } else {
        info.append('en un renglón de solo acordes');
        $('ebIzq').disabled = $('ebDer').disabled = true;
      }
    } else if (estado === 'silaba') {
      info.append('Acorde nuevo ');
      describirLugar(info, acordesDeRenglon(rs[marca.r]).texto, marca.pos);
    } else if (campo === 'cambiar') {
      info.append('Otro nombre para ', negrita(nombreDe(acordesDe(rs[sel.r])[sel.k])));
    } else {
      info.append('Acorde nuevo ');
      describirLugar(info, acordesDeRenglon(rs[marca.r]).texto, marca.pos);
    }
  }

  // ── Cambios ──
  // `cambio(rs)` modifica la lista de renglones (null = renglón borrado) y
  // devuelve la selección nueva
  function editar(cambio) {
    const rs = renglones();
    sel = cambio(rs);
    marca = null;
    texto = escribirLetra(rs.filter(Boolean));
    dibujar();
    pintarBarra();
    const c = letraBox.querySelector('c.sel');
    if (c) c.scrollIntoView({ block: 'nearest' });
  }

  // Saca el acorde `k` de un renglón: { renglon, acorde }. Un renglón de solo
  // acordes une el texto de los costados (sin juntar dos espacios); si se
  // queda sin acordes, `renglon` es null
  function sacarAcorde(rg, k) {
    if (rg.tipo === 'letra') {
      const { texto: t, acordes } = acordesDeRenglon(rg);
      const [acorde] = acordes.splice(k, 1);
      return { renglon: renglonDeAcordes(t, acordes, rg.estribillo), acorde };
    }
    const partes = rg.partes.slice();
    const j = partes.findIndex(p => p.acorde && k-- === 0);
    const [{ acorde }] = partes.splice(j, 1);
    const unidas = [];
    for (const p of partes) {
      const ult = unidas[unidas.length - 1];
      if (!p.acorde && ult && !ult.acorde) ult.texto += /\s$/.test(ult.texto) ? p.texto.replace(/^\s/, '') : p.texto;
      else unidas.push({ ...p });
    }
    return { renglon: unidas.some(p => p.acorde) ? { ...rg, partes: unidas } : null, acorde };
  }

  // Pone un acorde en una letra de un renglón de letra: queda él sobre la
  // letra (después de otros que ya estén ahí). Devuelve su número en el renglón
  function ponerAcorde(rs, r, acorde, pos) {
    const { texto: t, acordes } = acordesDeRenglon(rs[r]);
    acordes.push({ nombre: acorde.nombre, opcional: !!acorde.opcional, pos });
    const res = ubicarAcorde(acordes, acordes.length - 1, pos, false);
    rs[r] = renglonDeAcordes(t, res.acordes, rs[r].estribillo);
    return res.k;
  }

  // ◀ ▶: una letra. No salta por encima de otro acorde en la misma letra
  function moverPaso(delta) {
    const rg = sel && renglones()[sel.r];
    if (!rg || rg.tipo !== 'letra') return;
    const { texto: t, acordes } = acordesDeRenglon(rg);
    const pos = acordes[sel.k].pos + delta;
    if (pos < 0 || pos > t.length) return;
    editar(rs => {
      const res = ubicarAcorde(acordes, sel.k, pos, delta > 0);
      rs[sel.r] = renglonDeAcordes(t, res.acordes, rg.estribillo);
      return { r: sel.r, k: res.k };
    });
  }

  // Tocar una letra con un acorde elegido: lo lleva ahí (también a otro renglón)
  function moverA(lugar) {
    editar(rs => {
      const { renglon, acorde } = sacarAcorde(rs[sel.r], sel.k);
      rs[sel.r] = renglon;
      return { r: lugar.r, k: ponerAcorde(rs, lugar.r, acorde, lugar.pos) };
    });
  }

  function borrar() {
    if (!sel) return;
    editar(rs => {
      const { renglon } = sacarAcorde(rs[sel.r], sel.k);
      rs[sel.r] = renglon;
      // Un renglón de solo acordes que quedó vacío se va, con un renglón en
      // blanco de al lado (si no, quedarían dos seguidos)
      if (!renglon) {
        const vecino = rs[sel.r + 1] && rs[sel.r + 1].tipo === 'vacio' ? sel.r + 1
          : rs[sel.r - 1] && rs[sel.r - 1].tipo === 'vacio' ? sel.r - 1 : -1;
        if (vecino >= 0) rs[vecino] = null;
      }
      return null;
    });
  }

  // Cambiar el nombre del elegido o agregar uno en la letra marcada
  function aplicarNombre(acorde) {
    const m = marca, tipo = campo;
    campo = null;
    inputNombre.blur();
    if (tipo === 'cambiar') {
      editar(rs => {
        const rg = rs[sel.r];
        if (rg.tipo === 'letra') {
          const { texto: t, acordes } = acordesDeRenglon(rg);
          acordes[sel.k] = { ...acordes[sel.k], nombre: acorde.nombre, opcional: acorde.opcional };
          rs[sel.r] = renglonDeAcordes(t, acordes, rg.estribillo);
        } else {
          let k = sel.k;
          rs[sel.r] = { ...rg, partes: rg.partes.map(p => p.acorde && k-- === 0 ? { acorde: { nombre: acorde.nombre, opcional: acorde.opcional } } : p) };
        }
        return sel;
      });
    } else if (m) {
      // El acorde nuevo queda elegido: se puede correr enseguida con ◀ ▶
      editar(rs => ({ r: m.r, k: ponerAcorde(rs, m.r, acorde, m.pos) }));
    } else {
      pintarBarra();
    }
  }

  // ── El campo para el nombre ──
  function abrirCampo(tipo) {
    campo = tipo;
    inputNombre.value = tipo === 'cambiar' ? nombreDe(acordesDe(renglones()[sel.r])[sel.k]) : '';
    $('ebAceptar').textContent = tipo === 'cambiar' ? 'Cambiar' : 'Agregar';
    revisarCampo();
    pintarBarra();
    inputNombre.focus();
    inputNombre.select();
  }

  function cerrarCampo() {
    campo = null;
    inputNombre.blur();
    pintarBarra();
  }

  // Mientras se escribe: cómo va a quedar el nombre y si tiene diagrama
  function revisarCampo() {
    const escrito = inputNombre.value.replace(/\s+/g, '');
    const a = normalizarAcorde(escrito);
    $('ebAceptar').disabled = !a;
    aviso.replaceChildren();
    if (escrito && !a) {
      aviso.innerHTML = ico('alerta') + 'No se reconoce el acorde. Así: DO, REm, FA#7, SOL/SI';
    } else if (a) {
      const partes = [];
      if (nombreDe(a) !== escrito) partes.push('Queda ' + nombreDe(a));
      if (!chordLookup(a.nombre)) partes.push('no tiene diagrama de guitarra (se puede agregar igual)');
      if (partes.length) aviso.innerHTML = (chordLookup(a.nombre) ? '' : ico('alerta')) + escaparHtml(partes.join(' · '));
    }
    aviso.hidden = !campo || !aviso.textContent;
  }

  // ── Toques en la letra ──
  // La letra que quedó bajo el dedo: { r, pos } en un renglón de letra, o null
  function letraEnPunto(x, y) {
    let nodo = null, off = 0;
    if (document.caretPositionFromPoint) {
      const p = document.caretPositionFromPoint(x, y);
      if (p) { nodo = p.offsetNode; off = p.offset; }
    } else if (document.caretRangeFromPoint) {
      const rg = document.caretRangeFromPoint(x, y);
      if (rg) { nodo = rg.startContainer; off = rg.startOffset; }
    }
    if (!nodo || nodo.nodeType !== 3 || nodo.parentElement.closest('c')) return null;
    const div = nodo.parentElement.closest('.renglon');
    if (!div || !letraBox.contains(div)) return null;
    const r = elementos().indexOf(div);
    const rg = renglones()[r];
    if (!rg || rg.tipo !== 'letra') return null;
    const n = nodosDeTexto(div).find(t => t.nodo === nodo);
    if (!n) return null;
    // El cursor queda entre dos letras: la tocada es la de la izquierda si el
    // dedo cayó antes de su borde derecho
    let i = off;
    if (off > 0) {
      const caja = document.createRange();
      caja.setStart(nodo, off - 1);
      caja.setEnd(nodo, off);
      if (x < caja.getBoundingClientRect().right) i = off - 1;
    }
    return { r, pos: Math.min(acordesDeRenglon(rg).texto.length, n.desde + i) };
  }

  letraBox.addEventListener('click', e => {
    if (!editandoLetra || modo === 'texto') return;   // en "Texto", la letra es solo la vista previa
    if (campo) cerrarCampo();
    const c = e.target.closest('c');
    if (c) {
      const div = c.closest('.renglon');
      const r = elementos().indexOf(div);
      const k = [...div.querySelectorAll('c')].indexOf(c);
      sel = sel && sel.r === r && sel.k === k ? null : { r, k };   // tocar el elegido lo suelta
      marca = null;
    } else {
      const lugar = letraEnPunto(e.clientX, e.clientY);
      const rs = renglones();
      // Un acorde de un renglón de solo acordes no se lleva a la letra
      if (lugar && sel && rs[sel.r].tipo === 'letra') { moverA(lugar); return; }
      sel = null;
      marca = lugar;
    }
    marcar();
    pintarBarra();
  });

  // ── Pestaña "Texto" ──
  // Pasar de una a otra conserva lo hecho: las dos editan el mismo texto
  function ponerModo(nuevo) {
    if (nuevo === 'acordes' && modo === 'texto') {
      // Lo escrito, con los nombres en notación latina y un espacio entre palabras
      texto = escribirLetra(parsearLetra(normalizarNombres(texto, normalizarAcorde)).map(normalizarRenglon));
    }
    modo = nuevo;
    sel = marca = campo = null;
    panelTexto.hidden = modo !== 'texto';
    letraBox.classList.toggle('solo-vista', modo === 'texto');
    if (modo === 'texto') {
      area.value = texto;
      $('etPegado').hidden = true;
      pintarDudas();
    }
  }

  function pintarDudas() {
    const lista = $('etDudas');
    const dudas = [...dudasPegado.map(d => ({ ...d, pegado: true })), ...revisarLetra(texto, normalizarAcorde, chordLookup)];
    lista.replaceChildren(...dudas.map(d => {
      const li = document.createElement('li');
      if (d.renglon) {
        const b = document.createElement('b');
        b.textContent = `Renglón ${d.renglon}: `;
        li.append(b);
      }
      li.append(d.motivo);
      return li;
    }));
    lista.hidden = !dudas.length;
  }

  // Mientras se escribe, la vista previa se redibuja con una pausa corta
  let relojVista = null;
  area.addEventListener('input', () => {
    texto = area.value;
    dudasPegado = [];
    clearTimeout(relojVista);
    relojVista = setTimeout(() => { if (editandoLetra && modo === 'texto') { dibujar(); pintarDudas(); pintarBarra(); } }, 250);
  });

  $('ebModo').addEventListener('click', () => {
    ponerModo(modo === 'texto' ? 'acordes' : 'texto');
    dibujar();
    pintarBarra();
  });

  $('etPegar').addEventListener('click', () => {
    $('etPegado').hidden = false;
    $('etFuente').value = '';
    $('etFuente').focus();
  });
  $('etPegadoCancelar').addEventListener('click', () => { $('etPegado').hidden = true; });
  $('etConvertir').addEventListener('click', () => {
    const fuente = $('etFuente').value;
    if (!fuente.trim()) return;
    // Lo pegado reemplaza la letra (una letra pendiente, sin preguntar)
    if (tieneAcordesOLetra(texto) && !confirm('Lo pegado reemplaza la letra que está escrita. ¿Seguir?')) return;
    const r = desdeAcordesArriba(fuente, normalizarAcorde);
    texto = area.value = r.texto;
    dudasPegado = r.dudas;
    $('etPegado').hidden = true;
    dibujar();
    pintarDudas();
    pintarBarra();
    avisar(r.dudas.length ? `Convertida: revisá ${r.dudas.length === 1 ? 'lo marcado' : 'las ' + r.dudas.length + ' cosas marcadas'}` : '✓ Convertida');
  });

  // ── Botones ──
  btnEditar.addEventListener('click', () => empezar());
  $('ebIzq').addEventListener('click', () => moverPaso(-1));
  $('ebDer').addEventListener('click', () => moverPaso(1));
  $('ebCambiar').addEventListener('click', () => abrirCampo('cambiar'));
  $('ebBorrar').addEventListener('click', borrar);
  $('ebListo').addEventListener('click', () => { sel = null; marcar(); pintarBarra(); });
  $('ebAgregar').addEventListener('click', () => abrirCampo('agregar'));
  $('ebCancelar').addEventListener('click', () => { marca = null; marcar(); pintarBarra(); });
  $('ebCerrarCampo').addEventListener('click', cerrarCampo);
  inputNombre.addEventListener('input', revisarCampo);
  inputNombre.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarCampo(); });
  filas.campo.addEventListener('submit', e => {
    e.preventDefault();
    const a = normalizarAcorde(inputNombre.value);
    if (a) aplicarNombre(a);
  });

  $('ebSalir').addEventListener('click', () => {
    if (hayCambios() && !confirm('¿Descartar los cambios en los acordes?')) return;
    terminar();
  });

  // { letra, por, cuando, anterior }. La versión que se reemplaza queda como
  // `anterior`; si era la del archivo no hace falta (se vuelve con "Volver a
  // la versión original")
  function correccionNueva(letra, conAnterior) {
    const por = (usuarioAdmin && (usuarioAdmin.nombre || usuarioAdmin.email)) || 'admin';
    const valor = { letra, por: por.slice(0, 80), cuando: horaServidor() };
    // (una letra pendiente no hace falta guardarla para deshacer)
    if (conAnterior && correccion && tieneAcordesOLetra(correccion.letra)) valor.anterior = correccion.letra;
    return valor;
  }

  $('ebGuardar').addEventListener('click', () => {
    if (!hayCambios()) return;
    // Dos admins a la vez: gana el último que guarda, pero se le avisa
    const final = textoFinal();
    if (!final.trim()) { alert('❌ La letra no puede quedar vacía.'); return; }
    if (final.length > 20000) { alert('❌ La letra es demasiado larga (más de 20 000 letras).'); return; }
    if (textoVigente() !== base && !confirm('Mientras editabas se guardó otra versión de esta canción. Si guardás, la tuya la reemplaza (se puede deshacer). ¿Guardar igual?')) return;
    escribirDato(cancionRef, cancionRef ? correccionNueva(final, true) : null, $('ebGuardar'), 'guardar la letra')
      .then(() => { terminar(); avisar('✓ Letra guardada'); })
      .catch(() => {});
  });

  $('correccionDeshacer').addEventListener('click', () => {
    if (!correccion || !correccion.anterior) return;
    if (!confirm('¿Deshacer el último cambio? Vuelve la versión anterior de esta canción.')) return;
    escribirDato(cancionRef, cancionRef ? correccionNueva(correccion.anterior, false) : null, $('correccionDeshacer'), 'deshacer el cambio')
      .then(() => avisar('✓ Cambio deshecho'))
      .catch(() => {});
  });

  $('correccionOriginal').addEventListener('click', () => {
    if (!correccion) return;
    if (!confirm('¿Volver a la versión original? Se borra la corrección hecha desde la web.')) return;
    escribirDato(cancionRef, null, $('correccionOriginal'), 'volver a la versión original')
      .then(() => avisar('✓ Volvió la versión original'))
      .catch(() => {});
  });

  // Teclado (compu): ← → corren el acorde, Supr lo borra, Esc lo suelta
  document.addEventListener('keydown', e => {
    if (!editandoLetra || campo || (e.target.closest && e.target.closest('input, textarea, select'))) return;
    if (e.key === 'Escape') { sel = marca = null; marcar(); pintarBarra(); return; }
    if (!sel) return;
    if (e.key === 'ArrowLeft') moverPaso(-1);
    else if (e.key === 'ArrowRight') moverPaso(1);
    else if (e.key === 'Delete' || e.key === 'Backspace') borrar();
    else return;
    e.preventDefault();
  });

  // Salir con cambios sin guardar: los links de la página (Volver, anterior
  // y siguiente…) y el botón de modo preguntan antes; recargar o cerrar, el
  // navegador (el iPhone no pregunta: por eso lo de los links)
  document.addEventListener('click', e => {
    if (!hayCambios() || saliendo || !e.target.closest('a[href], #modeToggle')) return;
    if (confirm('Hay cambios en los acordes sin guardar. ¿Salir igual?')) { saliendo = true; return; }
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);
  window.addEventListener('beforeunload', e => {
    if (hayCambios() && !saliendo) { e.preventDefault(); e.returnValue = ''; }
  });

  // Con el teclado abierto (al escribir el nombre), la barra sube con él
  function ajustarAlTeclado() {
    const vv = window.visualViewport;
    if (!vv || barra.hidden) return;
    const tapa = document.documentElement.clientHeight - vv.height - vv.offsetTop;
    barra.style.transform = tapa > 1 ? `translateY(${-tapa}px)` : '';
  }
  if (window.visualViewport) {
    visualViewport.addEventListener('resize', ajustarAlTeclado);
    visualViewport.addEventListener('scroll', ajustarAlTeclado);
  }

  // El lápiz aparece con la sesión de admin y la letra cargada; la corrección
  // muestra sus botones con la sesión
  document.addEventListener('sesion-admin', () => { pintarBoton(); pintarCorreccion(); });
  document.addEventListener('letra-cargada', pintarBoton);
  document.addEventListener('correccion-cambio', () => { pintarBoton(); if (editandoLetra) pintarBarra(); });
  pintarBoton();

  // ── Eliminar la canción (D26) ──
  // Marca eliminadas/<id>: deja de verse en todos lados. Se recupera desde el
  // índice (o acá mismo, si se abre su link). Del todo se borra después: las
  // del repo con herramientas/pasar-web-al-repo.mjs, las de la web a los 30 días
  const cajaEliminar = $('eliminar');
  const btnEliminar = $('eliminarBtn');
  const estaEliminada = () => !!cancionesEliminadas[idCancion];
  function pintarEliminar() {
    cajaEliminar.hidden = !esAdminOk || textoVigente() === null && !estaEliminada();
    const texto = $('eliminarTexto');
    texto.hidden = !estaEliminada();
    texto.textContent = 'Esta canción está eliminada: no se ve en la lista ni en la Misa de Hoy.';
    btnEliminar.innerHTML = estaEliminada() ? ico('actualizar') + 'Recuperar esta canción' : ico('papelera') + 'Eliminar esta canción';
  }
  btnEliminar.addEventListener('click', () => {
    if (estaEliminada()) {
      escribirVarios(cancionRef, cancionRef ? { ['eliminadas/' + idCancion]: null } : null, btnEliminar, 'recuperar la canción')
        .then(() => { mezclarEliminadas({ ...cancionesEliminadas, [idCancion]: undefined }); pintarEliminar(); avisar('✓ Recuperada'); })
        .catch(() => {});
      return;
    }
    if (!confirm(`¿Eliminar «${tituloCancion}» del cancionero? Deja de verse en la lista, en la búsqueda y en la Misa de Hoy. Se puede recuperar desde el índice.`)) return;
    const por = (usuarioAdmin && (usuarioAdmin.nombre || usuarioAdmin.email)) || 'admin';
    escribirVarios(cancionRef, cancionRef ? { ['eliminadas/' + idCancion]: { titulo: tituloCancion.slice(0, 120), por: por.slice(0, 80), cuando: horaServidor() } } : null,
      btnEliminar, 'eliminar la canción')
      .then(() => {
        guardarCopia('eliminadas', { ...cancionesEliminadas, [idCancion]: { titulo: tituloCancion } });
        window.location.href = linkCon('index.html');
      })
      .catch(() => {});
  });
  document.addEventListener('sesion-admin', pintarEliminar);
  document.addEventListener('letra-cargada', pintarEliminar);
  document.addEventListener('canciones-web', pintarEliminar);
  pintarEliminar();

  // Canción recién creada en el índice (?editar=texto): el editor se abre
  // solo en la pestaña "Texto", una vez, cuando hay sesión y letra
  if (urlParams.get('editar') === 'texto') {
    const abrir = () => {
      if (editandoLetra || !puedeEditar()) return;
      const url = new URL(window.location);
      url.searchParams.delete('editar');
      history.replaceState(null, '', url);
      document.removeEventListener('letra-cargada', abrir);
      document.removeEventListener('sesion-admin', abrir);
      empezar('texto');
      area.focus();
    };
    document.addEventListener('letra-cargada', abrir);
    document.addEventListener('sesion-admin', abrir);
  }
}
