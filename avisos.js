// Página de avisos del coro (avisos.html, AGENTS.md §4f): los próximos
// ensayos, celebraciones y avisos (Firebase avisos/<id>), más las fiestas
// litúrgicas de los próximos 60 días (liturgia.js). Un admin con sesión
// agrega, edita y borra. Solo para el coro: en modo banco vuelve al índice.

if (MODO.banco) {
  window.location.replace(linkCon('index.html'));
  throw new Error('Los avisos no se muestran en modo banco');
}

document.querySelector('.back-link').href = linkCon('index.html');
const formAviso = document.getElementById('formAviso');
botonModo(() => formAviso.hidden ? null : 'Hay un aviso sin guardar. ¿Salir igual?');
if (MODO.admin) panelSesion(document.querySelector('main'));

const DIAS_FIESTAS = 60;
let avisos = {};
let avisosRef = null;
let eventos = [];          // lo que se está mostrando (para los botones)
let editandoId = null;     // null = aviso nuevo

const puedeEditar = () => MODO.admin && esAdminOk;

seguirDato('avisos', 'avisos_cache', val => { avisos = val || {}; render(); })
  .then(ref => { avisosRef = ref; });

// ── Lista ──
function render() {
  document.getElementById('nuevoAviso').hidden = !puedeEditar() || !formAviso.hidden;
  eventos = proximosEventos(avisos, DIAS_FIESTAS);
  const lista = document.getElementById('listaAvisos');
  document.getElementById('sinAvisos').hidden = eventos.length > 0;
  let mesActual = '';
  lista.innerHTML = eventos.map((ev, i) => {
    const [a, m, d] = ev.fecha.split('-').map(Number);
    const mes = `${MESES[m - 1]} ${a}`;
    const cabecera = mes !== mesActual ? `<h2 class="mes">${mes}</h2>` : '';
    mesActual = mes;
    const tipo = TIPOS_AVISO[ev.tipo];
    const datos = [ev.hora ? ev.hora + ' h' : '', ev.lugar, tipo.nombre].filter(Boolean).map(escaparHtml).join(' · ');
    const editar = ev.id && puedeEditar()
      ? `<button class="aviso-btn" type="button" data-accion="editar" data-i="${i}">✏️ Editar</button>
         <button class="aviso-btn" type="button" data-accion="borrar" data-i="${i}">🗑️ Borrar</button>`
      : '';
    return `${cabecera}<article class="aviso${ev.tipo === 'liturgia' ? ' liturgia' : ''}">
      <div class="aviso-dia"><div class="num">${d}</div><div class="sem">${DIAS_CORTOS[new Date(a, m - 1, d).getDay()]}</div></div>
      <div class="aviso-cuerpo">
        <div class="aviso-titulo">${tipo.icono} ${escaparHtml(ev.titulo)}</div>
        <div class="aviso-datos">${datos}</div>
        ${ev.detalle ? `<div class="aviso-detalle">${escaparHtml(ev.detalle)}</div>` : ''}
        <div class="aviso-botones">
          <button class="aviso-btn" type="button" data-accion="calendario" data-i="${i}">📅 Agregar a mi calendario</button>
          ${editar}
        </div>
      </div>
    </article>`;
  }).join('');
}

document.getElementById('listaAvisos').addEventListener('click', e => {
  const btn = e.target.closest('[data-accion]');
  if (!btn) return;
  const ev = eventos[Number(btn.dataset.i)];
  if (!ev) return;
  if (btn.dataset.accion === 'calendario') descargarIcs(ev);
  else if (btn.dataset.accion === 'editar') abrirFormulario(ev);
  else if (btn.dataset.accion === 'borrar' && confirm(`¿Borrar "${ev.titulo}"?`)) {
    escribirDato(avisosRef && avisosRef.child(ev.id), null, null, 'borrar el aviso').catch(() => {});
  }
});

document.addEventListener('sesion-admin', () => {
  if (!puedeEditar()) cerrarFormulario();
  render();
});

// ── Formulario (admin) ──
const campo = id => document.getElementById(id);

function abrirFormulario(ev) {
  editandoId = ev ? ev.id : null;
  campo('fFecha').value = ev ? ev.fecha : isoLocal(fechaHoy());
  campo('fHora').value = ev ? ev.hora : '';
  campo('fTipo').value = ev ? ev.tipo : 'ensayo';
  campo('fTitulo').value = ev ? ev.titulo : '';
  campo('fLugar').value = ev ? ev.lugar : '';
  campo('fDetalle').value = ev ? ev.detalle : '';
  formAviso.hidden = false;
  render();
  campo('fTitulo').focus();
}

function cerrarFormulario() {
  formAviso.hidden = true;
  editandoId = null;
  render();
}

document.getElementById('nuevoAviso').addEventListener('click', () => abrirFormulario(null));
campo('fCancelar').addEventListener('click', cerrarFormulario);

formAviso.addEventListener('submit', e => {
  e.preventDefault();
  const datos = {
    fecha: campo('fFecha').value,
    hora: campo('fHora').value,
    tipo: campo('fTipo').value,
    titulo: campo('fTitulo').value.trim(),
    lugar: campo('fLugar').value.trim(),
    detalle: campo('fDetalle').value.trim()
  };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha) || !datos.titulo) {
    alert('Completá la fecha y el título.');
    return;
  }
  const ref = !avisosRef ? null : editandoId ? avisosRef.child(editandoId) : avisosRef.push();
  escribirDato(ref, datos, campo('fGuardar'), 'guardar el aviso')
    .then(cerrarFormulario)
    .catch(() => {});
});

// ── "Agregar a mi calendario": archivo .ics, sin servidor ──
// Hora local del celular (sin zona horaria); sin hora = evento de día completo
function icsDe(ev) {
  const esc = t => String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const dos = n => String(n).padStart(2, '0');
  const local = d => `${d.getFullYear()}${dos(d.getMonth() + 1)}${dos(d.getDate())}T${dos(d.getHours())}${dos(d.getMinutes())}00`;
  const fecha = ev.fecha.replace(/-/g, '');
  const ahora = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const [a, mes, d] = ev.fecha.split('-').map(Number);
  let cuando;
  if (ev.hora) {
    const [h, m] = ev.hora.split(':').map(Number);
    const inicio = new Date(a, mes - 1, d, h, m);
    const fin = new Date(inicio.getTime() + 60 * 60 * 1000);   // 1 hora
    cuando = [`DTSTART:${local(inicio)}`, `DTEND:${local(fin)}`];
  } else {
    cuando = [`DTSTART;VALUE=DATE:${fecha}`, `DTEND;VALUE=DATE:${isoLocal(new Date(a, mes - 1, d + 1)).replace(/-/g, '')}`];
  }
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Coro Virgen del Carmen//Cancionero//ES', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${ev.id || 'liturgia-' + fecha}@cancionero-carmen`,
    `DTSTAMP:${ahora}`,
    ...cuando,
    `SUMMARY:${esc(ev.titulo)}`,
    ev.lugar ? `LOCATION:${esc(ev.lugar)}` : null,
    ev.detalle ? `DESCRIPTION:${esc(ev.detalle)}` : null,
    'END:VEVENT', 'END:VCALENDAR'
  ].filter(Boolean).join('\r\n') + '\r\n';
}

function descargarIcs(ev) {
  const blob = new Blob([icsDe(ev)], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${ev.fecha} ${ev.titulo}`.replace(/[^\wáéíóúñü -]/gi, '').slice(0, 60) + '.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

render();
