// Calendario litúrgico (AGENTS.md D19): tiempo, nombre del día, color y
// fiestas principales, calculados sin internet a partir de la fecha de Pascua.
// Calendario de Argentina: Epifanía, Ascensión y Corpus se celebran en
// domingo. Funciones puras; se prueban en Node con tests/liturgia.node.mjs.
//
// Las fechas se manejan como días UTC (sin hora) para no depender del horario
// de verano. diaLiturgico(fecha) recibe un Date local y usa su día calendario.

const DIA_MS = 86400000;
const ROMANOS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV',
  'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI', 'XXII', 'XXIII', 'XXIV', 'XXV', 'XXVI', 'XXVII',
  'XXVIII', 'XXIX', 'XXX', 'XXXI', 'XXXII', 'XXXIII', 'XXXIV'];

const dia = (a, m, d) => new Date(Date.UTC(a, m - 1, d));
const sumar = (f, n) => new Date(f.getTime() + n * DIA_MS);
const entre = (a, b) => Math.round((b - a) / DIA_MS);      // días de a hasta b
const dds = f => f.getUTCDay();                              // 0 = domingo
const iso = f => f.toISOString().slice(0, 10);
const domingoAntes = f => sumar(f, -dds(f));                 // el domingo de esa semana

// Domingo de Pascua (algoritmo de Meeus/Jones/Butcher, calendario gregoriano)
function pascua(anio) {
  const a = anio % 19, b = Math.floor(anio / 100), c = anio % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const d2 = ((h + l - 7 * m + 114) % 31) + 1;
  return dia(anio, mes, d2);
}

// Primer domingo de Adviento: 4 domingos antes de Navidad
function adviento(anio) {
  const navidad = dia(anio, 12, 25);
  const cuarto = sumar(navidad, -(dds(navidad) || 7));
  return sumar(cuarto, -21);
}

// Epifanía en Argentina: el domingo entre el 2 y el 8 de enero. El Bautismo
// es el domingo siguiente, o el lunes si la Epifanía cae el 7 o el 8
function epifania(anio) {
  const dos = dia(anio, 1, 2);
  return sumar(dos, (7 - dds(dos)) % 7);
}
function bautismo(anio) {
  const ep = epifania(anio);
  return ep.getUTCDate() >= 7 ? sumar(ep, 1) : sumar(ep, 7);
}

// Fechas clave del año civil `anio`
function fechasClave(anio) {
  const p = pascua(anio);
  return {
    pascua: p,
    ceniza: sumar(p, -46),
    ramos: sumar(p, -7),
    pentecostes: sumar(p, 49),
    adviento: adviento(anio),
    cristoRey: sumar(adviento(anio), -7),
    epifania: epifania(anio),
    bautismo: bautismo(anio)
  };
}

// Fiestas principales del año civil, con su color. Traslados: Inmaculada en
// domingo → lunes; San José y la Anunciación según caigan en Cuaresma,
// Semana Santa u Octava de Pascua
function fiestas(anio) {
  const k = fechasClave(anio);
  const p = k.pascua;
  const lista = [];
  const agregar = (fecha, nombre, color) => lista.push({ fecha: iso(fecha), nombre, color });

  agregar(dia(anio, 1, 1), 'Santa María, Madre de Dios', 'blanco');
  agregar(k.epifania, 'Epifanía del Señor', 'blanco');
  agregar(k.bautismo, 'Bautismo del Señor', 'blanco');

  let sanJose = dia(anio, 3, 19);
  if (sanJose >= k.ramos && sanJose <= p) sanJose = sumar(k.ramos, -1);
  else if (dds(sanJose) === 0 && sanJose >= k.ceniza) sanJose = sumar(sanJose, 1);
  agregar(sanJose, 'San José, esposo de la Virgen María', 'blanco');

  let anunciacion = dia(anio, 3, 25);
  if (anunciacion >= k.ramos && anunciacion <= sumar(p, 7)) anunciacion = sumar(p, 8);
  else if (dds(anunciacion) === 0 && anunciacion >= k.ceniza) anunciacion = sumar(anunciacion, 1);
  agregar(anunciacion, 'Anunciación del Señor', 'blanco');

  agregar(k.ceniza, 'Miércoles de Ceniza', 'morado');
  agregar(k.ramos, 'Domingo de Ramos', 'rojo');
  agregar(sumar(p, -3), 'Jueves Santo', 'blanco');
  agregar(sumar(p, -2), 'Viernes Santo', 'rojo');
  agregar(sumar(p, -1), 'Sábado Santo (Vigilia Pascual)', 'blanco');
  agregar(p, 'Domingo de Pascua', 'blanco');
  agregar(dia(anio, 5, 8), 'Nuestra Señora de Luján', 'blanco');
  agregar(sumar(p, 42), 'Ascensión del Señor', 'blanco');
  agregar(k.pentecostes, 'Pentecostés', 'rojo');
  agregar(sumar(p, 56), 'Santísima Trinidad', 'blanco');
  agregar(sumar(p, 63), 'Cuerpo y Sangre de Cristo', 'blanco');
  agregar(sumar(p, 68), 'Sagrado Corazón de Jesús', 'blanco');
  agregar(dia(anio, 7, 16), 'Nuestra Señora del Carmen (fiesta patronal)', 'blanco');
  agregar(dia(anio, 8, 15), 'Asunción de la Virgen María', 'blanco');
  agregar(dia(anio, 11, 1), 'Todos los Santos', 'blanco');
  agregar(k.cristoRey, 'Jesucristo, Rey del Universo', 'blanco');

  let inmaculada = dia(anio, 12, 8);
  if (dds(inmaculada) === 0) inmaculada = sumar(inmaculada, 1);
  agregar(inmaculada, 'Inmaculada Concepción de la Virgen María', 'blanco');

  // Sagrada Familia: domingo entre el 26 y el 31 de diciembre; si no hay, el 30
  const navidad = dia(anio, 12, 25);
  agregar(dds(navidad) === 0 ? dia(anio, 12, 30) : sumar(navidad, 7 - dds(navidad)), 'Sagrada Familia', 'blanco');
  agregar(navidad, 'Natividad del Señor', 'blanco');

  return lista.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// Tiempo, nombre y color de un día (fecha = Date local)
function diaLiturgico(fecha) {
  const f = dia(fecha.getFullYear(), fecha.getMonth() + 1, fecha.getDate());
  const anio = f.getUTCFullYear();
  const k = fechasClave(anio);
  const p = k.pascua;
  const domingo = dds(f) === 0;
  const fiesta = fiestas(anio).find(x => x.fecha === iso(f)) || null;
  let tiempo, nombre, color, categoria = null;

  if (f >= k.adviento && f < dia(anio, 12, 25)) {
    const semana = Math.floor(entre(k.adviento, f) / 7) + 1;
    tiempo = 'adviento'; categoria = 'adviento';
    nombre = domingo ? `Domingo ${ROMANOS[semana]} de Adviento` : `Semana ${ROMANOS[semana]} de Adviento`;
    color = domingo && semana === 3 ? 'rosa' : 'morado';
  } else if (f >= dia(anio, 12, 25) || f <= k.bautismo) {
    tiempo = 'navidad'; categoria = 'navidad'; color = 'blanco';
    nombre = 'Tiempo de Navidad';
  } else if (f < k.ceniza) {
    const semana = Math.floor(entre(domingoAntes(k.bautismo), f) / 7) + 1;
    tiempo = 'ordinario'; color = 'verde';
    nombre = domingo ? `Domingo ${ROMANOS[semana]} del Tiempo Ordinario` : `Semana ${ROMANOS[semana]} del Tiempo Ordinario`;
  } else if (f < k.ramos) {
    tiempo = 'cuaresma'; categoria = 'cuaresma'; color = 'morado';
    const primerDomingo = sumar(p, -42);
    if (f < primerDomingo) nombre = 'Tiempo de Cuaresma';
    else {
      const semana = Math.floor(entre(primerDomingo, f) / 7) + 1;
      nombre = domingo ? `Domingo ${ROMANOS[semana]} de Cuaresma` : `Semana ${ROMANOS[semana]} de Cuaresma`;
      if (domingo && semana === 4) color = 'rosa';
    }
  } else if (f < sumar(p, -3)) {
    tiempo = 'semana-santa'; categoria = 'cuaresma'; color = 'morado';
    nombre = 'Semana Santa';
  } else if (f < p) {
    tiempo = 'triduo'; categoria = 'cuaresma'; color = 'blanco';
    nombre = 'Triduo Pascual';
  } else if (f <= k.pentecostes) {
    const semana = Math.floor(entre(p, f) / 7) + 1;
    tiempo = 'pascua'; categoria = 'pascua'; color = 'blanco';
    nombre = semana === 1 ? 'Octava de Pascua'
      : domingo ? `Domingo ${ROMANOS[semana]} de Pascua` : `Semana ${ROMANOS[semana]} de Pascua`;
  } else {
    const semana = 34 - entre(domingoAntes(f), k.cristoRey) / 7;
    tiempo = 'ordinario'; color = 'verde';
    nombre = domingo ? `Domingo ${ROMANOS[semana]} del Tiempo Ordinario` : `Semana ${ROMANOS[semana]} del Tiempo Ordinario`;
  }

  // Una fiesta le da su nombre y su color al día; el tiempo queda de contexto
  return {
    fecha: iso(f),
    tiempo, categoria,
    nombre: fiesta ? fiesta.nombre : nombre,
    nombreTiempo: nombre,
    color: fiesta ? fiesta.color : color,
    fiesta: !!fiesta
  };
}

// Fiestas desde hoy hasta `dias` días adelante (para los avisos)
function proximasFiestas(desde, dias) {
  const ini = iso(dia(desde.getFullYear(), desde.getMonth() + 1, desde.getDate()));
  const fin = iso(sumar(dia(desde.getFullYear(), desde.getMonth() + 1, desde.getDate()), dias));
  return [...fiestas(desde.getFullYear()), ...fiestas(desde.getFullYear() + 1)]
    .filter(x => x.fecha >= ini && x.fecha <= fin);
}

// Para Node (tests/liturgia.node.mjs); en el navegador no hace nada
if (typeof module !== 'undefined') {
  module.exports = { pascua, adviento, epifania, bautismo, fechasClave, fiestas, diaLiturgico, proximasFiestas };
}
