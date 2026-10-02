// Prueba de liturgia.js en Node puro (sin navegador):
//   node tests/liturgia.node.mjs      (ver tests/README.md)
// Fechas conocidas del calendario litúrgico (Argentina) de varios años.
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const L = require(path.join(raiz, 'liturgia.js'));

let fallas = 0;
const check = (nombre, ok, extra = '') => { if (!ok) fallas++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${extra ? ' — ' + extra : ''}`); };
const iso = f => f.toISOString().slice(0, 10);
const local = s => { const [a, m, d] = s.split('-').map(Number); return new Date(a, m - 1, d, 12); };
const fiesta = (anio, nombre) => (L.fiestas(anio).find(f => f.nombre.startsWith(nombre)) || {}).fecha;

// Pascua y fechas móviles
for (const [anio, p] of [[2008, '2008-03-23'], [2024, '2024-03-31'], [2025, '2025-04-20'], [2026, '2026-04-05'], [2027, '2027-03-28'], [2038, '2038-04-25']]) {
  check(`Pascua ${anio} = ${p}`, iso(L.pascua(anio)) === p, iso(L.pascua(anio)));
}
const k26 = L.fechasClave(2026);
check('Ceniza 2026 = 18/2', iso(k26.ceniza) === '2026-02-18');
check('Pentecostés 2026 = 24/5', iso(k26.pentecostes) === '2026-05-24');
check('Adviento 2025 = 30/11', iso(L.adviento(2025)) === '2025-11-30');
check('Adviento 2026 = 29/11', iso(L.adviento(2026)) === '2026-11-29');
check('Adviento 2027 = 28/11', iso(L.adviento(2027)) === '2027-11-28');
check('Adviento 2022 (Navidad en domingo) = 27/11', iso(L.adviento(2022)) === '2022-11-27');
check('Cristo Rey 2026 = 22/11', iso(k26.cristoRey) === '2026-11-22');

// Calendario argentino: Epifanía, Bautismo, Ascensión y Corpus en domingo
check('Epifanía 2026 = dom 4/1', iso(L.epifania(2026)) === '2026-01-04');
check('Bautismo 2026 = dom 11/1', iso(L.bautismo(2026)) === '2026-01-11');
check('Epifanía 2024 = dom 7/1 → Bautismo lunes 8/1', iso(L.epifania(2024)) === '2024-01-07' && iso(L.bautismo(2024)) === '2024-01-08');
check('Ascensión 2026 = dom 17/5', fiesta(2026, 'Ascensión') === '2026-05-17');
check('Corpus 2026 = dom 7/6', fiesta(2026, 'Cuerpo y Sangre') === '2026-06-07');
check('Virgen del Carmen = 16/7', fiesta(2026, 'Nuestra Señora del Carmen') === '2026-07-16');

// Traslados
check('Inmaculada 2024 (domingo) → lunes 9/12', fiesta(2024, 'Inmaculada') === '2024-12-09');
check('San José 2008 (Semana Santa) → sábado 15/3', fiesta(2008, 'San José') === '2008-03-15');
check('Anunciación 2024 (Lunes Santo) → lunes 8/4', fiesta(2024, 'Anunciación') === '2024-04-08');
check('Sagrada Familia 2026 = dom 27/12', fiesta(2026, 'Sagrada Familia') === '2026-12-27');
check('Sagrada Familia 2022 (Navidad en domingo) = 30/12', fiesta(2022, 'Sagrada Familia') === '2022-12-30');

// Nombre, tiempo y color del día
for (const [fecha, nombre, color, tiempo] of [
  ['2026-10-04', 'Domingo XXVII del Tiempo Ordinario', 'verde', 'ordinario'],
  ['2026-10-07', 'Semana XXVII del Tiempo Ordinario', 'verde', 'ordinario'],
  ['2026-01-18', 'Domingo II del Tiempo Ordinario', 'verde', 'ordinario'],
  ['2026-02-15', 'Domingo VI del Tiempo Ordinario', 'verde', 'ordinario'],
  ['2026-05-25', 'Semana VIII del Tiempo Ordinario', 'verde', 'ordinario'],
  ['2026-11-22', 'Jesucristo, Rey del Universo', 'blanco', 'ordinario'],
  ['2026-11-29', 'Domingo I de Adviento', 'morado', 'adviento'],
  ['2026-12-13', 'Domingo III de Adviento', 'rosa', 'adviento'],
  ['2026-12-25', 'Natividad del Señor', 'blanco', 'navidad'],
  ['2026-02-18', 'Miércoles de Ceniza', 'morado', 'cuaresma'],
  ['2026-02-22', 'Domingo I de Cuaresma', 'morado', 'cuaresma'],
  ['2026-03-15', 'Domingo IV de Cuaresma', 'rosa', 'cuaresma'],
  ['2026-03-29', 'Domingo de Ramos', 'rojo', 'semana-santa'],
  ['2026-04-03', 'Viernes Santo', 'rojo', 'triduo'],
  ['2026-04-05', 'Domingo de Pascua', 'blanco', 'pascua'],
  ['2026-04-08', 'Octava de Pascua', 'blanco', 'pascua'],
  ['2026-04-12', 'Domingo II de Pascua', 'blanco', 'pascua'],
  ['2026-04-19', 'Domingo III de Pascua', 'blanco', 'pascua'],
  ['2026-05-24', 'Pentecostés', 'rojo', 'pascua'],
  ['2026-07-16', 'Nuestra Señora del Carmen (fiesta patronal)', 'blanco', 'ordinario']
]) {
  const d = L.diaLiturgico(local(fecha));
  check(`${fecha}: ${nombre} (${color})`, d.nombre === nombre && d.color === color && d.tiempo === tiempo, `${d.nombre} · ${d.color} · ${d.tiempo}`);
}

// Categoría del tiempo (para ordenar las categorías del índice)
check('Adviento → categoría adviento', L.diaLiturgico(local('2026-12-01')).categoria === 'adviento');
check('Semana Santa → categoría cuaresma', L.diaLiturgico(local('2026-03-31')).categoria === 'cuaresma');
check('Tiempo Ordinario → sin categoría', L.diaLiturgico(local('2026-10-04')).categoria === null);

// Cada día de 2020 a 2035 tiene nombre y color válidos (sin huecos ni semanas raras)
const colores = new Set(['verde', 'morado', 'blanco', 'rojo', 'rosa']);
let malos = [];
for (let t = new Date(2020, 0, 1, 12); t.getFullYear() < 2036; t.setDate(t.getDate() + 1)) {
  const d = L.diaLiturgico(t);
  if (!d.nombre || !colores.has(d.color) || /undefined|NaN/.test(d.nombreTiempo)) malos.push(d.fecha + ' ' + d.nombreTiempo);
}
check('2020–2035: todos los días con nombre y color', malos.length === 0, malos.slice(0, 3).join(', '));

// Próximas fiestas
const prox = L.proximasFiestas(local('2026-12-01'), 40);
check('próximas fiestas desde 1/12/2026 (40 días)', prox.map(f => f.fecha).join(',') === '2026-12-08,2026-12-25,2026-12-27,2027-01-01,2027-01-03,2027-01-10', prox.map(f => f.fecha).join(','));

console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTODO OK');
process.exitCode = fallas ? 1 : 0;
