# AGENTS.md — Cancionero Coro Virgen del Carmen

Documento vivo con las reglas de negocio, las decisiones de arquitectura y las
ideas de implementaciones futuras del cancionero. Lo leen tanto personas como
agentes de IA antes de tocar el proyecto.

**Mantenimiento:** cuando se tome una decisión nueva, se agregue una regla o se
pida una funcionalidad para más adelante, actualizar este archivo en el mismo
cambio. Las decisiones llevan fecha (AAAA-MM-DD).

---

## 1. Qué es y para quién

Cancionero web del coro de la Parroquia Virgen del Carmen (Córdoba, Argentina).
Tiene tres públicos:

| Público | Cómo entra | Qué ve |
|---|---|---|
| Músicos del coro | `index.html` | Letras con acordes, transposición, capotraste y diagramas de guitarra |
| Fieles en el banco | `?modo=banco` | Solo la letra: sin acordes, sin controles, sin búsqueda ni categorías |
| Quien arma la misa | `?admin=true` | Botones para elegir las canciones de "Misa de Hoy" y publicarlas, editar las notas y corregir los acordes (D23) |

En las vistas de músicos y admin, el botón "Modo admin" / "Salir de
admin" del encabezado pasa de una a otra (2026-10-01):
- **Qué hace:** recarga la misma página con o sin `admin=true` y conserva el
  resto de los parámetros.
- **Confirmación:** la pide si hay cambios en la misa sin publicar o una nota
  sin guardar.
- **Modo banco:** no tiene el botón; solo se sale cambiando la URL.

---

## 2. Arquitectura

### Piezas

- `songs.js`: la lista `SONGS`, fuente de verdad de qué canciones existen, y
  `CATS`, que define las categorías y su orden. La cargan las dos páginas.
- `index.html`: índice con búsqueda y categorías (CSS y script propios).
- `cancion.html`: muestra una letra (`?id=<id>`): el HTML y su CSS. El
  comportamiento está en `cancion.js`, que hace `fetch` de `letras/<id>.txt` y
  la dibuja con `letra.js` (D22). Si la letra se corrigió desde la web, la
  corrección de Firebase la pisa (D23).
- `editor.js`: el editor de acordes de `cancion.html`, solo para un admin con
  sesión (D23).
- `acordes.js`: escala, transposición, diccionario de diagramas de guitarra y
  su dibujo en SVG. Funciones puras, probadas en Node (D18).
- `letra.js`: el formato de las letras (acordes anclados a su sílaba): lo lee,
  lo escribe y arma su HTML. Funciones puras, probadas en Node (D22).
- `comun.js` y `comun.css`: lo compartido por las dos páginas (D18).
- `letras/*.txt`: un archivo de texto por canción, en el formato de §3.
- `assets/`: logos, imágenes e íconos de la app (`icon-192.png`, `icon-512.png`,
  `apple-touch-icon.png`, generados desde `virgen-icono-color.jpg`), y los
  íconos de la interfaz (`iconos.svg`, D21).
- `sw.js`: service worker para funcionar sin internet (D15).
- `offline.js`: registra el service worker y muestra los avisos "Sin conexión"
  y "Listo para usar sin internet".
- `manifest.webmanifest`: permite instalar el sitio como app ("Agregar a
  pantalla de inicio").
- `tema.js`: decide el tema claro u oscuro (D17); los colores están en
  `comun.css`.
- `sesion.js`: barra de sesión del modo admin (login con Google) y la variable
  `esAdminOk` (D16).
- `qr.html`: página para imprimir el QR de los fieles (§4e).
- `avisos.html` + `avisos.js`: avisos del coro (§4f).
- `liturgia.js`: calendario litúrgico (tiempo, color, fiestas), calculado sin
  internet (D19).
- `database.rules.json`: reglas de la base. Son la referencia: se aplican a mano
  en la consola de Firebase (§7).
- `firebase-config.js`: config de Firebase compartida, más:
  - `cargarFirebase()`: carga el SDK bajo demanda.
  - `leerFirebase(ruta)`: lectura puntual por REST.
  - `seguirDato()`, `suscribirMisa()` y `escribirDato()` (D18).
  - Lo de la sesión de admin (D16).
- `tests/`: pruebas en Chrome headless y en Node (§5, `tests/README.md`).
- `herramientas/pasar-web-al-repo.mjs`: pasa al repo lo cargado desde la web
  (D25).
- Firebase Realtime Database: guarda solo datos que se editan desde la web.
  - `misa_actual`: array con los ids de "Misa de Hoy".
  - `notas/<id>`: texto con la nota para músicos de cada canción (ver §4b).
  - `misa_meta`: `{ por, cuando }`, quién publicó la misa y cuándo (§4).
  - `avisos/<id>`: `{ fecha, hora, tipo, titulo, lugar, detalle }`, los avisos
    del coro (§4f).
  - `tonos/<id>`: `{ transponer, capo }`, el tono en que canta el coro cada
    canción (ver §4c).
  - `medios/<id>`: lista de hasta 5 `{ url, etiqueta }`, los audios y links
    cargados desde la app (D12).
  - `canciones/<id>`: `{ letra, por, cuando, anterior }`, la letra corregida
    desde la web; pisa a `letras/<id>.txt` (D23). También la letra de las
    canciones cargadas desde la web (D24).
  - `canciones_indice/<id>`: `{ titulo, categoria, num }`, las canciones
    cargadas desde la web; se suman a `SONGS` (D24).
  - `eliminadas/<id>`: `{ titulo, por, cuando }`, las canciones eliminadas
    desde la web; no se ven en ningún lado hasta que se recuperan (D26).
  - `admins/<email>`: `true` para cada admin autorizado. El email va en
    minúsculas y con los puntos cambiados por comas (`claveAdmin()`).
- Hosting: GitHub Pages.

### Decisiones de arquitectura

**D1. Sitio estático, sin build y sin dependencias.** Se edita a mano y se
publica tal cual en GitHub Pages. No agregar frameworks, bundlers, `npm` ni
pasos de compilación. Las librerías externas solo vienen por CDN: hoy Firebase,
Google Fonts y `qrious` (cdnjs, solo en `qr.html`).

**D2. Letras como archivos de texto cargados por `fetch`** (`letras/<id>.txt`
desde 2026-11-17; antes eran fragmentos HTML). Así agregar una canción es solo
crear un archivo. Consecuencia: el sitio no funciona abriéndolo con `file://`;
para probarlo hay que servirlo por HTTP (ver §5). Una letra corregida desde la
web (Firebase `canciones/<id>`) pisa a su archivo (D23).

**D3. `SONGS` en `songs.js` es la fuente de verdad del índice** (archivo propio
desde 2026-10-01). Lo cargan `index.html`, `cancion.html` y el service worker
(para saber qué letras guardar). `cancion.html` toma el título de `SONGS`. El parámetro `?t=`
queda solo como respaldo para links viejos.

**D4. El contexto de navegación viaja por la URL.** `modo`, `admin` y `cat`
(categoría activa, `todas` = sin filtro) pasan de `index.html` a `cancion.html` y
vuelven con el botón "Volver". No usar `localStorage` para esto.

**D5. Firebase solo para lo que se edita desde la web.** Hoy son "Misa de Hoy",
las notas, el tono del coro de cada canción, los audios cargados desde la app,
los avisos y las letras corregidas desde la web (D23). Lo que se edita como
código (letras, índice, links de audio de `songs.js`) va en el repo. La config de Firebase (`firebase-config.js`) es
pública por diseño (así funciona Firebase web); la seguridad depende de las
reglas de la base (`database.rules.json`, D16).

**D6. `?admin=true` no es seguridad.** Solo cambia la vista: cualquiera entra
con el botón del encabezado. La seguridad la dan el login con Google y las
reglas de la base (D16).

**D7. Cada acorde anclado a su sílaba** (2026-11-17, reemplaza a la
alineación con espacios). Hasta esa fecha los acordes iban en una línea propia,
alineados con espacios dentro de un `<pre>`: con la fuente proporcional (EB
Garamond) la alineación era aproximada, y no se podían mover desde la web.
Ahora cada acorde va escrito justo antes de la letra sobre la que cae
(`re[MIm]cibe`) y la página lo dibuja exacto encima. Formato en §3; dibujo y
conversión en D22.

**D8. Renglones de solo acordes** (`.solo-acordes`): el renglón que, además de
los acordes, solo tiene espacios, guiones, barras, puntos, paréntesis o un
`Intro:` al principio. Se oculta entero al esconder los acordes y en modo
banco, sin dejar un renglón en blanco. Conserva sus espacios.

**D9. Transposición y capotraste.** Acorde mostrado = original + transposición −
traste del capo. Con capo, los acordes se muestran en la posición en que se
tocan. La transposición siempre devuelve sostenidos (un `SIb` transpuesto se
muestra como `LA#`, `SI`, etc.).
- Solo entiende notación latina: la americana se convierte al cargar la letra
  (§3).
- La transposición se mantiene entre −11 y +11 (12 semitonos = una octava), que
  es lo que aceptan las reglas al guardar el tono del coro.

**D10. Modo banco sin controles** (2026-07-06). En `?modo=banco` se ocultan
todos los controles de `cancion.html`. **Excepción** (2026-10-02): los
botones A− / A+ del tamaño de letra sí se ven en banco, porque los usa gente
mayor que lee desde el celular (§4c).
- **Lector de voz quitado** (2026-11-17): el botón "Escuchar letra" (lectura
  en voz alta) se sacó porque nadie lo usaba. Para leer la letra en voz alta
  queda el lector de pantalla del celular (D11).

**D11. Accesibilidad.** Los `<c>` y los renglones `.solo-acordes` llevan
`aria-hidden` para que los lectores de pantalla lean solo la letra. Al copiar
la letra no se copian los acordes (`user-select: none`).

**D12. Audios por canción: solo links** (2026-10-01). Se cargan de dos maneras
y el reproductor lo arma `cancion.html`:
- En `songs.js`, en el campo opcional `medios` de cada canción (§3).
- Desde la app (2026-11-15): un admin con sesión pega el link en la página de
  la canción y se guarda en Firebase, en `medios/<id>` (§4c). Se muestran
  después de los de `songs.js`.

No guardar el audio en sí en GitHub ni en Firebase:
- Firebase Storage exige el plan Blaze (con tarjeta) desde febrero de 2026.
- Firebase Realtime Database no sirve para archivos.
- Subir MP3 al repo infla para siempre el historial de git (GitHub recomienda
  repos de menos de 1 GB).
- Las grabaciones propias del coro van a Google Drive (15 GB gratis), y en
  `medios` se carga solo el link.

**D13. Notas por canción en Firebase** (2026-10-01). Se guardan en Firebase y no
en el repo porque se escriben desde la web en modo admin, sin pasar por git.
Si Firebase no carga, la página funciona igual, sin nota. En modo banco ni se
consulta.

**D14. El modo banco no abre conexión en tiempo real con Firebase**
(2026-10-01). El plan gratuito admite **100 conexiones simultáneas**, y no se
puede subir. Cada página con el SDK abierto ocupa una, y con el QR puede haber
más de 100 fieles a la vez.
- Músicos y admin cargan el SDK con `cargarFirebase()` y ven los datos en vivo.
- El modo banco nunca carga el SDK: lee con `leerFirebase('misa_actual')`, un
  `fetch` puntual a la API REST.
- Toda funcionalidad nueva para los fieles tiene que respetar esta regla.
- Si Firebase no carga (sin conexión), las páginas siguen funcionando sin esos
  datos.

**D15. Funciona sin internet** (2026-10-01). Lo hace el service worker `sw.js`:
- **Qué guarda al instalarse** (en la primera visita con conexión): las
  páginas, **todas** las letras (la lista sale de `songs.js` con
  `importScripts`), los íconos, el CSS de Google Fonts y el SDK de Firebase.
- **Estrategias** (2026-11-15):
  - Páginas, JS, CSS y letras propios: la copia al instante, y en segundo
    plano se pide a la red y se actualiza la copia. Así cambiar de página no
    depende de la señal (antes se esperaba a la red hasta 3 s por archivo).
  - Imágenes, fuentes y SDK: primero la copia. Los archivos de las fuentes se
    guardan al instalar.
  - `firebaseio.com` no pasa por el service worker.
- **Versión nueva del sitio:** si la actualización en segundo plano trae un
  archivo distinto (por `ETag` o `Last-Modified`; las letras no cuentan), el
  service worker avisa a las páginas abiertas y `offline.js` decide:
  - página recién abierta y sin tocar: se recarga sola, una vez;
  - si no: aviso "Hay una versión nueva" con el botón "Actualizar".
  - **Consecuencia:** un cambio de código se ve en la segunda carga o al
    tocar "Actualizar", no en la primera.
- **Datos de Firebase:** cada página guarda su copia en `localStorage`
  (`misa_cache`, `nota_<id>`) y la muestra mientras llega la versión en vivo.
  Sin conexión se queda con la copia y aparece el aviso "Sin conexión".
- **Escrituras sin conexión:** publicar la misa o guardar una nota se bloquea
  con un aviso, para que no queden encoladas sin que nadie lo sepa.
- **Al cambiar `sw.js`, subir `VERSION`:** así se descarta la caché anterior.
  Las letras y canciones nuevas no requieren tocarlo, porque salen de
  `songs.js`. Un archivo propio nuevo (otra página, otro script o CSS) sí hay que
  agregarlo a `PROPIOS`.
- **Aviso de que está listo:** en el pie del índice aparece "Listo para usar
  sin internet" cuando la caché ya tiene todas las letras (`offline.js`). Para
  probarlo: abrir el sitio con conexión, esperar el aviso y poner modo avión.
- **iPhone:** Safari borra los datos de un sitio que no se abre en 7 días. Para
  evitarlo, recomendar "Agregar a pantalla de inicio".

**D16. Login de admin con Google** (2026-10-01).
- **En la página:** en modo admin, `sesion.js` muestra una barra con "Entrar con
  Google". Los botones de edición (publicar, ↑ ↓, quitar, `+`, editar nota,
  editar acordes) aparecen solo si el email de la sesión está en `admins/`
  (`esAdminOk` y el evento `sesion-admin`).
- **En la base:** las reglas de `database.rules.json` dejan escribir solo a esos
  emails, verificados. Bloquean también a quien intente escribir por REST sin
  pasar por la página. Lectura pública en todo menos `admins/`, donde cada
  admin puede leer únicamente su propia entrada.
- **Popup, no redirect:** el login usa popup. El redirect falla en GitHub Pages
  porque el navegador bloquea el almacenamiento de terceros de
  `firebaseapp.com`. Si el popup está bloqueado, se intenta con redirect.
- **Cuándo se carga Auth:** solo en modo admin. Músicos y banco no lo cargan.
- **Sesión recordada y sin saltos** (2026-11-15). Confirmar la sesión tarda,
  porque carga el login y consulta `admins/`. Mientras tanto, la barra
  aparecía tarde y empujaba la página hacia abajo. Ahora:
  - La última sesión de admin del celular queda en `localStorage.sesion_admin`
    (`{ email, nombre }`) y se muestra al instante, con `esAdminOk` listo.
    Firebase la confirma después; si ya no es admin, la corrige y la olvida.
    Es solo vista: lo que se puede escribir lo deciden las reglas.
  - Sin conexión se mantiene la sesión recordada: el borrador de la misa se
    arma igual, y escribir ya avisa que no hay red.
  - `tema.js`, en el `<head>`, marca `data-admin` en `<html>` antes de pintar
    (`"ok"` si hay sesión recordada, `"si"` si no). Con eso el CSS reserva:
    - siempre en modo admin: el lugar de la barra (`#sesion-slot`, de alto
      fijo);
    - con `"ok"`: el de los botones que solo ve un admin (`#admin-bar`,
      `#misa-agregar`, `#nota`, `#nuevoAviso`, `#editarAcordes`).
  - **Regla:** un bloque nuevo que aparezca solo para admins en la parte de
    arriba de una página va en el HTML con `hidden`, y lleva su reserva
    `:root[data-admin="ok"] #id[hidden] { display: … !important; visibility: hidden; }`.
    Lo prueba `tests/saltos.mjs`.
- **Agregar un admin:** en la consola de Firebase (§7), sin tocar el código.


**D17. Modo oscuro** (2026-10-01). Lo manejan `tema.js` (qué tema se ve) y
`comun.css` (los colores), que cargan las dos páginas en el `<head>`.
- **Qué tema se ve:**
  - `tema.js` pone `data-theme="light"` o `"dark"` en `<html>` antes de pintar,
    así no hay destello claro.
  - Arranca con el tema del celular (`prefers-color-scheme`) y sigue sus
    cambios.
  - Si la persona toca la luna / el sol del encabezado, su elección queda en
    `localStorage.tema` y ya no sigue al sistema.
  - El botón está en todos los modos, banco incluido.
- **Cómo está armado:** `comun.css` redefine las variables bajo
  `:root[data-theme="dark"]` (`--bg`, `--ink`, `--border`, `--brown-mid`…) y
  activa `color-scheme: dark`. También ajusta lo que no sale de variables:
  - activos y botones principales en dorado con texto oscuro;
  - flecha del selector de capo;
  - diagrama de acordes, por clases `cd-*`;
  - sombras.
- **Regla para el texto:** usar `--text-strong` y `--text-accent`.
  `--brown-dark` y `--brown` quedan para **fondos** (encabezado, banner, botones
  activos), que son oscuros en los dos temas.
- **Color nuevo sobre una superficie clara:** tiene que funcionar en los dos
  temas. Usar una variable, o agregar su ajuste en `comun.css`.
- **Excepción:** `qr.html` queda siempre clara, porque es para imprimir.

**D18. Código compartido** (2026-10-02). Lo que usan las dos páginas está una
sola vez:
- **`comun.js`:**
  - `MODO` (banco, admin, cat, leídos de la URL).
  - `linkCon(página, extra)`: links que conservan modo, admin y categoría (D4).
  - `botonModo()`: el botón "Modo admin".
  - `normalize` y `escaparHtml`.
  - `ico(nombre)` y `ponerConIcono(el, nombre, texto)`: íconos (D21).
  - `leerCopia` / `guardarCopia`.
  - Misa de Hoy: `insertarEnMisa` (orden por momento) y el borrador
    (`leerBorradorMisa`, `guardarBorradorMisa`, `borrarBorradorMisa`; §4).
  - `avisar(texto, link)`: aviso flotante que confirma una acción. Para lo que
    salió bien se usa esto y no `alert`; los errores siguen con `alert`.
- **`firebase-config.js`:**
  - `seguirDato(ruta, claveCopia, cb)`: entrega primero la copia local y
    después el dato publicado. En banco lo lee una vez por REST (D14); en el
    resto, en vivo.
  - `suscribirMisa(cb)`: lo mismo para la misa, ya normalizada.
  - `escribirDato(ref, valor, botón, acción)`: sin conexión no escribe,
    deshabilita el botón y avisa errores.
  - **Todo dato nuevo de Firebase tiene que usar estas funciones.**
- **`acordes.js`:** funciones puras de acordes, y `normalizarAcorde` (lo que
  se escribe en el editor, a notación latina; D23). Si se agrega un acorde a
  una letra, `tests/acordes.node.mjs` avisa si le falta diagrama.
- **`letra.js`** (D22): `parsearLetra`, `escribirLetra`, `htmlDeLetra`,
  `lineasDeTexto` (la usa la búsqueda por letra), `acordesDeLetra`,
  `colapsarEspacios` y `armarRenglon`. Para el editor (D23):
  `acordesDeRenglon`, `renglonDeAcordes`, `normalizarRenglon` y
  `ubicarAcorde`; para la pestaña "Texto" (D24): `normalizarNombres`,
  `revisarLetra` y `desdeAcordesArriba`.
- **`comun.js`, canciones de la web y eliminadas** (D24, D26): `PREFIJOS`,
  `slugDe`, `SONGS_REPO`, `cancionesEliminadas`, `armarCanciones`,
  `mezclarCancionesWeb`, `mezclarEliminadas` y `seguirCancionesWeb`.
- **`comun.css`:** paleta, base, encabezado, `[hidden]` global, la base de los
  botones píldora, la barra de sesión y el aviso sin conexión.
  - Las páginas no inyectan estilos desde JS.
  - En `cancion.html`, todo lo que no ven los fieles lleva la clase
    `.no-banco`.
- **Eventos:** sin `onclick` en el HTML. El índice dibuja todo con un único
  `render()` y usa listeners delegados (`data-action`, `data-cat`,
  `data-href`).

**D19. Calendario litúrgico calculado** (2026-10-02). `liturgia.js` calcula
todo a partir de la fecha de Pascua (algoritmo de Meeus/Jones/Butcher), sin
internet ni datos cargados a mano.
- **Tiempos:**
  - Adviento: 4 domingos antes de Navidad.
  - Navidad: hasta el Bautismo del Señor.
  - Tiempo Ordinario I.
  - Cuaresma: desde Ceniza, Pascua − 46.
  - Semana Santa y Triduo.
  - Pascua: hasta Pentecostés.
  - Tiempo Ordinario II, numerado hacia atrás desde Cristo Rey (semana 34).
- **Colores:** verde, morado, blanco y rojo; rosa en Gaudete y Laetare.
- **Calendario de Argentina:**
  - Epifanía, Ascensión y Corpus, en domingo.
  - Si la Epifanía cae el 7 o el 8, el Bautismo pasa al lunes.
  - Traslados de la Inmaculada, San José y la Anunciación.
  - Nuestra Señora de Luján (8/5) y la **Virgen del Carmen (16/7) como fiesta
    patronal**.
- **Uso en el sitio:** la franja del índice y las fiestas automáticas de los
  avisos.
- **Pruebas:** `tests/liturgia.node.mjs` cubre fechas de 2008 a 2038 y revisa
  cada día de 2020 a 2035. Una fiesta nueva se agrega en `fiestas()` con su
  prueba.
- **`window.FECHA_PRUEBA`** (`'AAAA-MM-DD'`, en `fechaHoy()` de `comun.js`) fija
  el día: solo lo usan las pruebas.

**D20. Distribución de las pantallas** (2026-11-17). Rediseño sin cambios de
funcionalidad, pensado para el celular: lo que más se usa queda arriba y los
botones, del tamaño de un dedo. Se respetan la paleta y las fuentes.
- **Regla general:** en el índice, la lista de canciones tiene que empezar
  dentro de la primera pantalla; en la canción, la letra. Un bloque nuevo
  arriba de ellas tiene que ser bajo o ir después.
- **Encabezado:** en pantallas de hasta 560 px el botón de modo dice "Admin" /
  "Salir" (`.mt-largo` se oculta) y el subtítulo queda en "Coro Virgen del
  Carmen". Así el título no se corta.
- **Índice:**
  - La estampa (`.carmel-banner`) es una franja baja, con la imagen a la
    izquierda. Debajo, pegada, va la placa del día litúrgico (`.liturgia`); el
    color del día cuelga como la cinta de un misal (`.liturgia-color`).
  - Debajo, "Próximos avisos" en un renglón: solo el más cercano (§4f).
  - El buscador se esconde detrás del encabezado al bajar y vuelve al subir
    o al tocarlo. No se esconde cerca del principio ni mientras se escribe.
  - Las categorías no llevan título propio.
  - En cada fila, el momento de la misa (`.song-tag`) va arriba del título,
    como una rúbrica. Dentro de una sola categoría no se muestra
    (`.una-categoria`).
  - "Publicada por…" y "Compartir" comparten renglón (`.misa-barra`).
  - Los tres botones de admin van en un renglón; "Publicar Misa" es el
    principal.
- **Canción** (agrupada por para qué sirve):
  - Un renglón con lo del tono (`.toolbar`): `− ½ tono · + ½ tono · capo`.
    Justo debajo (`.tono-info`), en qué tono está: el tono del coro y el aviso
    de capo.
  - Justo arriba de la letra (`.letra-barra`), cómo se ve: "Acordes" a la
    izquierda y A− / A+ a la derecha.
  - Anterior / siguiente va inmediatamente después de la letra, antes de los
    audios.
- **Tarjetas:** un solo radio y una sola sombra (`--radio`, `--sombra` en
  `comun.css`).
- **Nombre:** en todo el sitio es "Coro Virgen del Carmen" (2026-11-17).

**D21. Íconos de línea propios, sin emojis** (2026-11-17). Los emojis se ven
distinto en cada celular y desentonan con la paleta. La interfaz usa íconos
dibujados para el sitio, en `assets/iconos.svg`.
- **Cómo se usan:** en HTML,
  `<svg class="ico" aria-hidden="true"><use href="assets/iconos.svg#caliz"/></svg>`;
  en JS, `ico('caliz')` o `ponerConIcono(el, 'caliz', texto)` (`comun.js`).
  `ico(nombre, true)` es un ícono sin texto al lado.
- **Estilo:** trazo redondeado de 1,75 en una grilla de 24 × 24, sin relleno.
  Toman el color del texto (`currentColor`), así que funcionan en los dos temas
  sin ajustes. En los botones claros van en `--brown-mid` (`.ico` en
  `comun.css`). Son decorativos (`aria-hidden`): el texto o el `aria-label`
  del botón dice qué hace.
- **Categorías:** el cuarto campo de `CATS` (`songs.js`) es el ícono; el
  tercero, el emoji, se usa solo en el texto que se comparte por WhatsApp.
  Una categoría nueva lleva los dos.
- **Dónde siguen los emojis:** en el texto de "Compartir la misa" (WhatsApp)
  y en los `alert()` de error, que son del sistema.
- **Ícono nuevo:** agregar un `<symbol>` a `iconos.svg` con el mismo estilo.
  El service worker lo actualiza como al código (no hace falta subir
  `VERSION`).
- **`offline.js` no depende de `comun.js`:** el aviso de versión nueva tiene
  que funcionar aunque la página guardada sea de otra versión. Si falta
  `ponerConIcono`, muestra solo el texto.

**D22. Formato y dibujo de las letras** (2026-11-17, etapa 1 del plan de
canciones editables, §6). Base para mover acordes y cargar canciones desde la
web.
- **Formato** (`letras/<id>.txt`, detalle en §3): texto plano con cada acorde
  anclado a su sílaba (`[SOL]Toma, Señor, y re[MIm]cibe`). Lo leen y escriben
  `parsearLetra` / `escribirLetra` de `letra.js`. Leer y volver a escribir da el
  mismo texto: lo prueba `tests/letra.node.mjs` con todas las letras.
- **Dibujo** (`htmlDeLetra` + CSS de `cancion.html`):
  - Cada palabra con acordes va en un `.palabra` (no se corta), y cada acorde
    con su sílaba en un `.tramo`: el `<c>` arriba, la `.sil` abajo.
  - El acorde no ocupa lugar en la letra (`position: absolute`), así la letra
    se lee de corrido. Un puntal invisible (`.tramo::before`) hace más alto
    solo el renglón de pantalla que tiene acordes.
  - Un renglón largo sigue abajo, con sangría, en vez de desplazarse de
    costado: cada acorde viaja con su sílaba. En un celular no hay que
    desplazarse de costado en ninguna letra.
  - Todo el texto va escapado: las letras van a poder venir de la web.
- **Espacio solo donde hace falta** (`acomodarAcordes()` en `cancion.js`):
  - Un acorde sin sílaba (después de una palabra o al final del renglón) ocupa
    su ancho: es el hueco de la palabra que se sostiene (`mí,[DO7] tan`).
  - Dos acordes del mismo renglón que quedarían encimados: se corre el
    segundo. Entre palabras se agranda el espacio; dentro de una palabra va un
    guion (`"a- mor"`, clase `.estirado`).
  - Un acorde que se saldría por la derecha: su palabra pasa al renglón de
    abajo (`<br class="salto">`).
  - Depende de los anchos: se repite al transponer, al mostrar los acordes, al
    cambiar el tamaño de letra o el ancho de la pantalla, y al cargar las
    fuentes. Con los acordes ocultos y en banco no hace nada: texto corrido.
- **Conversión de las 108 letras** (2026-11-17): se midió en pantalla, con el
  dibujo viejo, dónde se veía cada acorde, y se lo ancló a la letra más
  cercana. Así quedó cada acorde donde lo veían los músicos, aunque en el
  original estuviera corrido: eso se corrige con el editor (etapa 2).
  - No se ancla en espacios ni en signos de cierre (`,` `.`); sí en los guiones
    de una sílaba sostenida (`pa---az`).
  - Un acorde en un hueco largo entre palabras (más de 0,5 em de toda letra)
    quedó después de la palabra anterior.
  - Los espacios de más dentro de la letra (estaban para hacer lugar a los
    acordes) quedaron en uno. Los huecos dobles alrededor del estribillo (las
    marcas `<b>` se veían como renglones vacíos) quedaron en uno.
  - Verificado: los 5651 acordes en el mismo orden, el mismo texto y cada
    acorde a 0,1 em de su letra (mediana).
  - Arreglado a mano: `com_alma-misionera`, que tenía un renglón de letra y uno
    de acordes pegados.

**D23. Editor de acordes y letras corregidas desde la web** (2026-11-17,
etapa 2 del plan de canciones editables, §6). Un admin con sesión corrige los
acordes desde el celular, sin pasar por el repo.
- **Dónde se guarda:** en Firebase, `canciones/<id>` =
  `{ letra, por, cuando, anterior }`. Si existe, **pisa** a
  `letras/<id>.txt` (`cancion.js`, LÓGICA 0).
  - Se dibuja lo primero que haya (la copia local o el archivo) y se vuelve a
    dibujar si llega otra versión.
  - Músicos y admin: `seguirDato('canciones/<id>')`, en vivo, con copia en
    `localStorage.cancion_<id>`.
  - Banco: una lectura por REST de `canciones/<id>/letra`, solo el texto (D14).
  - `anterior`: la corrección que se reemplazó. Si lo reemplazado era el
    archivo, no se guarda (para eso está "Volver a la versión original").
  - **Corregir el `.txt` de una canción corregida desde la web no alcanza:**
    se sigue viendo la de Firebase. Primero pasarla al repo
    (`herramientas/pasar-web-al-repo.mjs`, D25) o usar "Volver a la versión
    original".
- **Quién y cuándo:** "Corregida por Mateo · 17/11", debajo de la letra
  (después de anterior / siguiente, D20). Lo ven músicos y admin, no banco.
  El admin con sesión ve además, con confirmación:
  - "Deshacer el último cambio" (si hay `anterior`): vuelve esa versión, y ya
    no hay otra para deshacer;
  - "Volver a la versión original": borra la corrección.
- **Editor (`editor.js`):**
  - **Entrada:** el lápiz al lado de "Acordes" (`#editarAcordes`). Desde 480 px
    dice además "Editar". Así no ocupa un renglón arriba de la letra (D20) y
    aparecer no corre nada; igual tiene su reserva (D16).
  - **Tono:** se edita en el tono original, que es como se guarda
    (`renderChords()` no transpone mientras `editandoLetra`). El tono,
    "Acordes" y la corrección quedan quietos (`inert`) y el autoscroll se
    esconde.
  - **Barra fija abajo**, oscura en los dos temas (como el encabezado). Una
    fila según lo elegido:
    - nada: ayuda, "Sin cambios" / "Hay cambios sin guardar", Salir /
      Descartar y Guardar;
    - un acorde: ◀ ▶ (una letra por toque), Cambiar, Borrar y Listo, con el
      acorde y la palabra ("LAm sobre re_c_ibe");
    - una letra sin acorde: "+ Acorde acá";
    - el nombre: un campo que acepta minúsculas, notación americana y `La-`
      (`normalizarAcorde`), dice cómo queda y avisa si no tiene diagrama.
  - **Toques:** tocar un acorde lo elige y tocarlo otra vez lo suelta. Con un
    acorde elegido, tocar una letra lo lleva ahí (también a otro renglón); sin
    acorde elegido, la marca para agregar uno. La letra tocada sale de
    `caretPositionFromPoint`. La letra sobre la que cae el elegido se resalta
    con la CSS Custom Highlight API (sin ella, se ve solo el acorde).
  - **Posiciones:** cada acorde es `{ nombre, opcional, pos }` sobre el texto
    del renglón (`acordesDeRenglon` / `renglonDeAcordes`). Al abrir, un solo
    espacio entre palabras (`normalizarRenglon`): cada posición es una letra o
    el hueco de una palabra (acorde después de la palabra). Con ◀ ▶ un acorde
    no salta por encima de otro en la misma letra; al tocar una letra, queda
    él encima (`ubicarAcorde`).
  - **Renglones de solo acordes** (Intro): se cambia o se borra el acorde, no
    se mueve. Si se borra el último, se va el renglón, con un renglón vacío
    de al lado.
  - **Guardar:** `escribirDato`, una sola escritura. Si mientras tanto otro
    admin guardó, la barra lo dice y Guardar pregunta antes de reemplazarla
    (gana el último, como estaba planeado).
  - **Cambios sin guardar:** "Volver", anterior / siguiente y el botón de modo
    preguntan antes de salir; recargar o cerrar, el navegador
    (`beforeunload`; el iPhone no lo hace, por eso lo de los links).
  - **Teclado** (compu): ← → corren el acorde, Supr lo borra y Esc lo suelta.
  - **Teclado del celular:** con el campo del nombre abierto, la barra sube
    con el teclado (`visualViewport`).
- **Reglas** (`database.rules.json`, §7): escribe solo un admin; el id con
  forma de canción; `letra` de 1 a 20 000 caracteres; `por` hasta 80;
  `cuando` la hora del servidor (`== now`); `anterior` hasta 20 000; nada más.
  Lectura pública (la necesita el banco).
- **Pruebas:** `tests/editor.mjs` (navegador, con el Firebase falso),
  `letra.node.mjs` y `acordes.node.mjs`.
- **Renombrar el `id`** de una canción deja huérfana su corrección, igual que
  la nota y el tono (§4b).

**D24. Texto y canciones nuevas desde la web** (2026-11-20, etapa 3 del plan
de canciones editables, §6).
- **Pestaña "Texto" del editor** (`editor.js`): el botón "Texto" / "Acordes"
  de la barra pasa de una a otra, y las dos editan el mismo texto.
  - Arriba de la letra, un cuadro con la letra en el formato de corchetes; la
    letra de abajo es la vista previa en vivo (no se toca).
  - Debajo del cuadro, lo que conviene mirar (`revisarLetra`, letra.js):
    acordes que no se reconocen, en notación americana ("«Am» queda LAm"),
    sin diagrama, corchetes sin cerrar, llaves fuera de lugar, estribillo sin
    cerrar.
  - Al pasar a "Acordes" y al guardar, los nombres quedan en notación latina
    (`normalizarNombres`). No se guarda una letra vacía ni de más de 20 000.
- **"Pegar con acordes arriba"** (`desdeAcordesArriba`, letra.js): convierte
  lo que viene de internet o WhatsApp y reemplaza la letra (pregunta si había
  una). Reglas:
  - Cada acorde va a la letra que tiene debajo de su primera letra (columnas
    de ancho fijo, tab = 4).
  - Sobre un espacio: a la palabra siguiente si está pegada; si está pegado a
    la anterior, después de ella (se sostiene). Entre dos palabras pegadas,
    a la siguiente, **con duda**.
  - Un renglón de acordes sin letra debajo queda de solo acordes (`Intro:`
    incluido). `|`, `-`, `x2` y paréntesis alrededor se ignoran; `(MI)` solo
    es opcional.
  - "Estribillo" o "Coro" solos en un renglón, seguidos de letra, marcan el
    estribillo hasta el próximo renglón vacío; si no les sigue letra, quedan
    como "(Estribillo)".
  - Un renglón de "la", "mi", "si"… en minúscula queda como letra, **con
    duda** ("¿acordes o letra?").
  - Las dudas se muestran con su número de renglón.
- **Canciones nuevas:**
  - **Dónde:** `canciones_indice/<id>` = `{ titulo, categoria, num }` y su
    letra en `canciones/<id>` (D23). No tienen archivo en `letras/`.
  - **"Nueva canción"** (índice, admin con sesión, al final de la lista):
    título, momento y número (opcional). Arranca en la categoría elegida.
    - Título igual a otra canción (sin mayúsculas ni tildes): no la crea.
    - Mismo número en el mismo momento: pregunta (los números del cancionero
      impreso se repiten entre momentos).
    - `id` = prefijo del momento + slug del título (`slugDe`, `PREFIJOS` en
      `comun.js`); si ya existe, `-2`, `-3`…
    - Escribe en una sola operación (`escribirVarios`) la entrada del índice
      y una letra `{pendiente}`, y abre la canción con `?editar=texto`: el
      editor arranca solo en "Texto" (y saca el parámetro de la dirección).
  - **En `SONGS`:** `comun.js` las suma con `web: true` (`mezclarCancionesWeb`)
    desde la copia `localStorage.canciones_indice`, antes de que la página use
    `SONGS`, y después con `seguirCancionesWeb()` (en banco, por REST), que
    dispara `canciones-web`. Así lista, chips, búsqueda, Misa de Hoy,
    anterior / siguiente y "Compartir" las tratan como a las del repo. Una del
    repo con el mismo id gana.
  - `suscribirMisa` vuelve a entregar la misa cuando llega la lista: una
    canción nueva no se descarta por llegar antes que su entrada.
  - **Letras sin conexión:** el índice baja por REST, en segundo plano, la
    letra de cada canción de la web (en banco, solo las de la misa) a
    `localStorage.cancion_<id>`. La búsqueda usa esa copia (y las
    correcciones vistas en el celular) antes que el archivo.
  - **En la canción:** no se pide `letras/<id>.txt`. Abajo dice "Cargada por
    …", sin "Volver a la versión original" (no hay original).
  - **"Listo para usar sin internet"** cuenta solo las letras del repo.
  - **Títulos de la web:** van siempre escapados (`escaparHtml`).
- **Prefijos nuevos** (2026-11-20, elegidos por el usuario): `sjose_`,
  `adv_`, `nav_`, `cuar_`, `pasc_` (§3).
- **Reglas** (§7): `canciones_indice/<id>`: escribe un admin; id con forma de
  canción; `titulo` de 1 a 120; `categoria` una clave de `CATS` (no `misa`);
  `num` entero de 0 a 999; nada más. Lectura pública.
- **Borrar una canción:** "Eliminar esta canción" (D26).
- **Pruebas:** `tests/canciones-web.mjs`, más casos en `letra.node.mjs`.

**D25. Respaldo en el repo de lo cargado desde la web** (2026-11-20, etapa 4
del plan de canciones editables, §6). El plan gratuito de Firebase no hace
copias de seguridad: lo cargado desde la web se pasa al repo cada tanto,
cuando el usuario lo pide ("pasá las canciones de la web al repo").
- **El script:** `node herramientas/pasar-web-al-repo.mjs` (Node 22, sin
  dependencias; `--probar` muestra qué haría sin escribir). Lee por REST, sin
  sesión, `canciones` y `canciones_indice`, y:
  - escribe `letras/<id>.txt` de cada letra corregida o cargada desde la web,
    en el formato del repo (`escribirLetra(parsearLetra())`: LF, sin
    espacios al final);
  - agrega a `SONGS` cada canción nueva, después de la última de su momento;
    si el momento no tiene ninguna, en un bloque nuevo al final con su
    comentario (`// --- NAVIDAD (nav_) ---`);
  - una canción nueva sin letra queda `{pendiente}`;
  - no toca lo que ya es igual al repo y avisa lo que no puede pasar (letra
    sin entrada en el índice, entrada inválida). `anterior` no se pasa.
  - Si `canciones_indice` no se puede leer (reglas sin pegar), avisa y pasa
    igual las correcciones.
- **Después:** correr las pruebas (`letra.node.mjs` revisa que cada canción
  tenga su archivo y que todas las letras se lean y escriban iguales; 
  `acordes.node.mjs`, los diagramas), commit y push.
- **Borrar de Firebase lo ya pasado:** el script no puede (escribir necesita
  sesión de admin). Lo hace el índice: con la sesión de un admin confirmada
  por Google (no basta la recordada), una vez por carga
  (`limpiarLoPasadoAlRepo`), en una sola operación (`escribirVarios`):
  - `canciones/<id>` de una canción del repo cuya letra es igual al archivo;
  - `canciones_indice/<id>` de una canción que ya está en `songs.js`.
  - Como es igual a lo publicado, no cambia nada en pantalla. Un admin que
    tiene en el celular el archivo de antes no limpia: lo hace en otra visita,
    cuando el service worker ya trajo el nuevo. Aviso: "✓ Se sacó de la web
    lo que ya está en el repo (N)".
  - Una corrección distinta del archivo (alguien la cambió después del paso)
    se queda: sigue pisando al archivo.
- **Pruebas:** `tests/pasar-al-repo.node.mjs` (el script, con datos
  inventados) y la limpieza en `tests/canciones-web.mjs`.

**D26. Eliminar canciones** (2026-11-20). Un admin con sesión saca una
canción del cancionero desde la web, sea del repo o cargada desde la web, y
se puede recuperar.
- **Cómo:** "Eliminar esta canción", al final de la página de la canción
  (admin con sesión), con confirmación. Marca `eliminadas/<id>` =
  `{ titulo, por, cuando }` y vuelve al índice. No borra nada todavía.
- **Qué pasa:** `comun.js` arma `SONGS` = las de `songs.js` (`SONGS_REPO`) +
  las de la web, **sin las eliminadas** (`armarCanciones`). Con eso deja de
  verse en la lista, las categorías, la búsqueda, la Misa de Hoy (también en
  banco: se lee `eliminadas` por REST) y anterior / siguiente. La lista se
  sigue con `seguirCancionesWeb()` y tiene copia en
  `localStorage.eliminadas`.
- **Recuperar:** al final del índice (admin con sesión), la lista
  "Eliminadas", cada una con "Recuperar". También desde el link de la canción
  eliminada ("Recuperar esta canción"). Borra la marca.
- **Borrado del todo:**
  - Del repo: `herramientas/pasar-web-al-repo.mjs` saca su entrada de
    `songs.js` (`quitarDeSongs`; si el bloque queda vacío, también su
    comentario) y borra `letras/<id>.txt`. Una eliminada de la web no se pasa.
  - De Firebase: la limpieza del índice (D25) borra `eliminadas`,
    `canciones_indice`, `canciones`, `notas`, `tonos` y `medios` de una
    eliminada que ya no está en `songs.js` (la sacó el script), o de una de la
    web eliminada hace más de 30 días. Hasta entonces se puede recuperar.
- **Nueva canción** no reusa el id de una eliminada.
- **Reglas** (§7): `eliminadas/<id>`: escribe un admin; id con forma de
  canción; `titulo` hasta 120; `por` hasta 80; `cuando` la hora del servidor;
  nada más. Lectura pública.
- **Pruebas:** `tests/eliminar.mjs` y casos en `pasar-al-repo.node.mjs`.
---

## 3. Reglas de negocio: canciones

### Archivo y entrada en el índice

1. Crear `letras/<prefijo>_<slug>.txt` (UTF-8, fin de línea LF; `.gitattributes`
   lo asegura aunque Git convierta a CRLF en Windows). El slug va en
   minúsculas, sin tildes ni ñ, con palabras separadas por guiones (`senor`,
   `oracion-del-alma-enamorada`).
2. Agregar la entrada en `SONGS` (`songs.js`), dentro del bloque comentado de
   su prefijo:
   ```js
   { "id": "com_mi-cancion", "num": 0, "title": "Mi canción", "category": "comunion" },
   ```
   - `id`: igual al nombre del archivo, sin `.txt`.
   - `num`: número de la canción en el cancionero impreso del coro. Usar `0` si
     no tiene.
   - `title`: con tildes y mayúsculas normales.
   - `category`: una de las claves de `CATS`.
   - `medios` (opcional): audios y links para escucharla, debajo de la letra.
     Lista de `{ url, etiqueta }`. Ejemplo:
     ```js
     { "id": "ofert_toma", "num": 45, "title": "Toma", "category": "ofertorio",
       "medios": [
         { "url": "https://www.youtube.com/watch?v=XXXXXXXXXXX", "etiqueta": "Versión de referencia" },
         { "url": "https://drive.google.com/file/d/ID/view", "etiqueta": "Ensayo del coro" }
       ] },
     ```
     El tipo se deduce de la URL. Si hace falta forzarlo, se agrega `tipo`
     (`"youtube"` o `"audio"`):
     - YouTube: reproductor de `youtube-nocookie`.
     - Spotify: track, álbum o playlist.
     - Google Drive: el archivo tiene que estar compartido como "cualquiera con
       el link".
     - `.mp3`, `.m4a`, etc.: reproductor de audio.
     - Cualquier otra URL `https://`: un link común.
     Solo músicos y admin. No aparece en banco ni sin conexión. También se
     pueden cargar desde la app, sin tocar el repo (§4c).
3. Antes de crear una canción, **verificar que no exista ya** (buscar por título
   y por número). Si existe y la letra coincide, no tocarla.
4. Antes de corregir una letra en el repo, **ver si tiene una corrección hecha
   desde la web**: si la tiene, es la que se ve (D23). Se consulta sin
   sesión, por ejemplo:
   `curl https://coro-97958-default-rtdb.firebaseio.com/canciones/<id>.json`
   (`null` = no tiene).

### Prefijos y categorías

| Prefijo | `category` | Categoría visible |
|---|---|---|
| `ent_` | `entrada` | Entrada |
| `glo_` | `gloria` | Gloria / Kyrie |
| `ale_` | `aleluya` | Aleluya |
| `ofert_` | `ofertorio` | Ofrenda |
| `snt_` | `santo` | Santo / Cordero |
| `com_` | `comunion` | Comunión |
| `ador_` | `adoracion` | Adoración / Post-Comunión |
| `ador_` | `carmelitanos` | Carmelitanos (Santa Teresita, San Juan de la Cruz, Santa Teresa…) |
| `mar_` | `marianos` | A María |
| `var_` | `varias` | Varios |
| `sjose_` | `sanjose` | San José |
| `adv_` | `adviento` | Adviento |
| `nav_` | `navidad` | Navidad |
| `cuar_` | `cuaresma` | Cuaresma |
| `pasc_` | `pascua` | Pascua |

- Las categorías `sanjose`, `adviento`, `navidad`, `cuaresma` y `pascua` todavía
  no tienen canciones en el repo. Su botón aparece solo al cargar la primera.
  Sus prefijos se definieron el 2026-11-20 (están también en `PREFIJOS`, en
  `comun.js`: una categoría nueva lleva su prefijo ahí).
- "Misa de Hoy" (`misa`) no es una categoría de `SONGS`: se arma desde
  Firebase.

### Títulos

- Si sirve para buscarla, agregar entre paréntesis el autor o el grupo:
  `(San Juan de la Cruz)`, `(Jesed)`, `(Pascua Joven)`, `(Fones)`.
- No incluir las marcas de tono del cancionero impreso (`T1`, `T2/3`, `T3/4`).
  "La fonte T5" es una excepción histórica.

### Formato de la letra (2026-11-17, D7 y D22)

- Cada acorde va entre corchetes, **justo antes de la letra sobre la que cae**,
  dentro del verso:
  ```
  [SOL]Toma, Señor, y re[MIm]cibe toda mi [DO]libertad,
  ```
  La página lo dibuja exactamente encima de esa letra. No hay que alinear nada
  con espacios: un solo espacio entre palabras.
- **Acorde después de una palabra** (se toca mientras se sostiene, o al final
  del verso): pegado al final de la palabra, antes del espacio o al final del
  renglón: `tan cerca de mí,[DO7] tan cerca de mí,[SOL]`.
- Así se escriben los acordes:
  - Menores: `m` después del sostenido (`FA#m`, no `FAm#`).
  - Séptimas y otros: `RE7`, `FA#m7`, `SOLmaj7`, `REsus4`, `DOadd9`.
  - Bemoles: se aceptan (`SIb`).
  - Con bajo: `RE/FA#`.
  - Optativos: paréntesis adentro de los corchetes (`[(MI)]`).
- Las fuentes llegan con otras notaciones. Se convierten siempre:
  - Americana: `Am` → `LAm`, `G/F#` → `SOL/FA#`.
  - Latina en minúscula: `Rem` → `REm`.
  - Menor con guion: `La-` → `LAm`.
- **Fuente con los acordes en una línea encima del verso** (lo habitual en
  internet y WhatsApp): cada acorde va a la letra que tiene debajo de su
  primera letra, contando columnas como en una fuente de ancho fijo, y después
  se revisa. Desde la web lo hace "Pegar con acordes arriba" (D24); al cargar
  por el chat se siguen las mismas reglas.
- **Estribillo:** `{estribillo}` y `{/estribillo}`, cada marca en su propio
  renglón. Si el estribillo se repite sin escribirlo entero, va solo su
  comienzo entre las marcas: `(Estribillo) Primeras palabras…`.
- **Repeticiones:** `(bis)` al final del verso, o `/…/ (bis)` para marcar el
  tramo.
- **Intro:** un renglón `Intro: [DO] [FA] …` al principio, seguido de un
  renglón vacío. También vale una progresión entre paréntesis. Un renglón de
  solo acordes conserva sus espacios (D8).
- **Subtítulos** dentro de una letra (varias canciones en un archivo, como
  Antífonas): `{titulo: A la tarde}`. **Aclaraciones** (en cursiva):
  `{nota: (Porque sólo Él te puede salvar…)}`.
- Estrofas separadas por un renglón vacío. Sin espacios al final de línea.
- **Letra pendiente:** si la canción está en el índice pero falta la letra, el
  archivo tiene solo `{pendiente}` (ver `com_eucaristia.txt`).
- No usar `[`, `]`, `{` ni `}` en la letra: son marcas del formato.

### Correcciones al cargar

- Se pueden corregir errores evidentes de ortografía y tildes, y agregar signos
  de puntuación faltantes (`¿?`, `¡!`). Hay que **avisarle al usuario la lista de
  cambios**.
- No reescribir versos ni "corregir" contra el poema original si el coro canta
  otra versión (ej.: "pastorcito" en vez de "pastorcico").
- Marcar un estribillo con `{estribillo}` es una interpretación: avisar al
  usuario cuando no está indicado en la fuente.
- Si la fuente trae los acordes amontonados o sin alinear, no inventar en qué
  sílaba cae cada uno: dejarlos como vienen y avisar.

---

## 4. Reglas de negocio: Misa de Hoy

- Se arma en `index.html?admin=true`, con sesión de admin (D16): `+` agrega,
  "Quitar" (✕) saca y "Publicar Misa" guarda en Firebase (`misa_actual`, un
  array de ids).
- **Orden** (2026-10-01): `+` inserta cada canción en su momento litúrgico,
  según el orden de `CATS` (entrada → gloria → aleluya → ofrenda → santo →
  comunión → adoración → marianos…), después de las que ya están en ese
  momento. El orden fino se ajusta con ↑ ↓ en la vista de la misa. El orden del
  array es el orden de la misa.
- "Limpiar Misa" vacía solo la lista local hasta que se publique.
- **Borrador** (2026-11-15): lo armado y todavía no publicado se guarda en el
  celular (`localStorage.misa_borrador` = `{ ids, base }`), así no se pierde al
  entrar a ver una canción ni al recargar.
  - `base` es la misa publicada sobre la que se empezó a editar.
  - Solo se usa en modo admin. Aparece "● Hay cambios en la Misa de Hoy sin
    publicar".
  - Se borra al publicar, al cargar la versión publicada o si la lista vuelve
    a quedar igual a la publicada.
- **Agregar desde la canción** (2026-11-15): en `cancion.html`, un admin con
  sesión ve "+ Agregar a la Misa de Hoy" bajo el título.
  - Suma la canción al borrador, en su momento litúrgico. **No publica.**
  - Después muestra "✓ En la Misa de Hoy · Quitar" y "Falta publicar · Ir a
    Misa de Hoy". El renglón de "Falta publicar" queda reservado aunque no se
    vea, así tocar el botón no corre la letra.
- **El `+` del índice** pasa a `✓` dorado cuando la canción ya está en la
  misa, y tocarlo otra vez la quita. Cada toque muestra un aviso flotante con
  la cantidad de canciones.
- **Quién publicó** (2026-10-02): al publicar se guardan en una sola operación
  (`escribirVarios`) la misa y `misa_meta`.
  - `por`: el nombre de Google del admin o, si no hay, su email.
  - `cuando`: hora del servidor.
  - En Misa de Hoy se ve "Publicada por Mateo · sáb 3/10, 19:40". Lo ven
    músicos y admin; el modo banco no lo lee.
- **Otra versión publicada mientras se edita** (2026-10-02): si un admin tiene
  cambios sin publicar y llega otra versión (otro admin publicó), su lista no
  se pisa. Aparece el aviso "Se publicó otra versión…" con "Cargar la
  publicada", que pide confirmación porque descarta los cambios. El eco de su
  propia publicación no dispara el aviso: la marca de cambios se baja antes del
  `set()`. Con un borrador guardado, "otra versión" es una distinta de su
  `base`.
- **Ids que ya no existen** en `SONGS` se descartan al recibir la misa: no
  cuentan en el chip, no se reordenan y no se vuelven a publicar.
- **Anterior / siguiente:** en `cancion.html`, si se llegó desde Misa de Hoy
  (`cat=misa`), abajo de la letra aparecen la canción anterior y la siguiente,
  y la posición ("2 / 6"). Está en todos los modos, incluido banco.
- **Copia local:** cada vez que se recibe la misa se guarda en
  `localStorage.misa_cache`. Anterior/siguiente la muestra mientras llega la
  versión publicada.
- Al entrar sin `?cat=`, el índice arranca en "Misa de Hoy". Si no hay
  canciones, muestra "Aún no se han seleccionado las canciones…".
- **Renombrar un `id`** saca esa canción de la misa publicada que la contenga.

## 4b. Reglas de negocio: notas de las canciones

- **Para qué sirven:** indicaciones para el coro, como el tono en que se canta,
  dónde entra cada voz o una aclaración del ensayo.
- **Quién las ve:** la vista de músicos y la de admin, en una tarjeta "Nota"
  arriba de la letra. **Nunca en `?modo=banco`.**
- **Quién las edita:** un admin con sesión de Google autorizada (D16), con
  "Agregar nota" o "Editar".
  - **Guardar vacío borra la nota.**
  - Máximo 500 caracteres.
  - Texto plano: los saltos de línea se respetan y no se interpreta HTML.
- **Dónde se guardan:** en Firebase, en `notas/<id>`. **Renombrar el `id` de una
  canción deja su nota huérfana:** hay que moverla a mano en la base.
- **Tiempo real:** como "Misa de Hoy", una nota guardada aparece al instante en
  las páginas abiertas.

## 4c. Ayudas para tocar (`cancion.html`, músicos y admin)

Ninguna aparece en modo banco.

- **Tamaño de letra** (2026-10-02, también en banco, excepción a D10):
  - Botones A− / A+ arriba de la letra, con 6 tamaños (de 0,85 a 1,6 veces).
  - Escala la letra con la variable CSS `--escala-letra`. Los acordes son
    `em`, así que crecen con la letra y siguen sobre su sílaba. Con la letra
    grande, los versos largos siguen en el renglón de abajo (D22).
  - Se recuerda en el celular (`localStorage.tam_letra`).
- **Pantalla encendida**, con dos mecanismos:
  - **Wake Lock API:** se pide al abrir la canción y se renueva al volver a la
    pestaña y con cada toque.
  - **Respaldo para iPhone:** un video mudo e invisible en bucle
    (`assets/pantalla-encendida.mp4`/`.webm`, de NoSleep.js, licencia MIT).
    iOS no apaga la pantalla mientras hay un video reproduciéndose. Se usa si
    no hay Wake Lock, si el pedido falla (bajo consumo, ahorro de batería) o
    siempre en iPhone abierto desde el ícono de inicio
    (`navigator.standalone`), porque hasta iOS 18.4 el Wake Lock ahí no hacía
    nada. iOS solo lo deja arrancar después de un toque.
  - **Límite:** en iPhone con modo de bajo consumo puede seguir apagándose.
    Recomendar actualizar a iOS 18.4 o posterior, o desactivar el bajo consumo
    durante la misa.
- **Desplazamiento automático:** botón flotante ▶ abajo a la derecha.
  - Mientras corre muestra − / velocidad / + / ⏸, con 10 velocidades (6 a
    60 px/s).
  - Se detiene al tocar o desplazar a mano fuera del control, o al llegar al
    final.
  - La velocidad se recuerda en el celular (`localStorage.autoscroll_nivel`).
- **Tono del coro** (`tonos/<id>` en Firebase, `{ transponer, capo }`):
  - Al abrir la canción, los acordes se muestran ya en el tono del coro.
    Arriba se indica "Tono del coro: empieza en RE · capo 2", calculado con
    el primer acorde.
  - "Ver tono original" / "Volver al tono del coro" alterna entre los dos.
  - Si el músico transpone o pone capo a mano, eso queda solo en su celular y
    el indicador dice "(estás viendo otro tono)".
  - Un admin con sesión ve "Guardar como tono del coro" cuando el tono que
    tiene en pantalla es distinto del guardado. Guardar el original sin capo
    borra el tono del coro.
  - Copia local en `localStorage.tono_<id>`.
- **Audios y links:** debajo de la letra. Salen del campo `medios` de
  `songs.js` (§3) y de Firebase (`medios/<id>`, 2026-11-15):
  - Un admin con sesión ve "Agregar audio o link": pega el link (tiene que
    empezar con `https://`) y una etiqueta opcional de hasta 60 caracteres.
  - Hasta 5 por canción. Cada uno tiene "Quitar", con confirmación.
  - Los de `songs.js` no se editan desde la web. Si un link está en los dos
    lados, se muestra una sola vez.
  - Copia local en `localStorage.medios_<id>`.
  - **Renombrar el `id` de una canción deja sus audios huérfanos**, igual que
    la nota y el tono.

## 4d. Índice: búsqueda y compartir

- **Búsqueda:** primero las canciones cuyo título coincide. Desde 3 letras,
  también las que tienen la frase en la letra, con el verso encontrado y la
  coincidencia resaltada.
  - La primera búsqueda descarga todas las letras (sin conexión salen de la
    caché del service worker) y arma un índice en memoria.
  - Las líneas de solo acordes no cuentan.
- **Volver al mismo lugar** (2026-11-15): al entrar a una canción, el índice
  anota la categoría, la búsqueda y la posición (`sessionStorage.indice_vuelta`).
  Al volver las restaura, una sola vez. Es estado efímero de pantalla, no
  contexto de navegación: D4 no cambia.
- **Compartir la misa:** en Misa de Hoy (músicos y admin), "Compartir la misa"
  arma un texto con las canciones por momento, un link para músicos
  (`?cat=misa`) y otro para fieles (`?modo=banco`).
  - Usa el menú de compartir del celular (`navigator.share`).
  - Si no está disponible, abre WhatsApp (`wa.me`).

## 4e. QR para los fieles (`qr.html`)

- **Qué abre:** la Misa de Hoy en modo banco
  (`https://riforta.github.io/cancionero-carmen/index.html?modo=banco`). Como la
  dirección no cambia, se imprime una sola vez y sirve para todas las misas.
- **Formatos:** cartel de hoja completa o 4 tarjetas por hoja A4, para recortar.
- **Dónde está:** en la barra de admin, "QR para fieles".
- **Si se abre fuera de GitHub Pages** (por ejemplo, probando en la compu), el
  QR apunta igual al sitio publicado.
- **Antes de difundirlo:** tienen que estar publicadas las fases 0 (banco sin
  conexión en vivo, D14) y 3 (escrituras protegidas, §7).


## 4f. Avisos del coro y tiempo litúrgico

- **Tiempo litúrgico** (D19): en el índice, en todos los modos, una franja con
  el nombre del día y el color litúrgico.
  - Ejemplos: "Domingo XXVII del Tiempo Ordinario", o el nombre de la fiesta si
    hay una.
  - En Adviento, Navidad, Cuaresma y Pascua, esa categoría aparece justo después
    de Misa de Hoy, si tiene canciones.
- **Avisos** (`avisos.html`, 2026-10-02): **solo para el coro**. En modo banco
  la página vuelve al índice y el índice no los muestra.
  - **Qué hay:** ensayos, celebraciones y avisos, cargados de a uno (sin
    repetición), más las fiestas litúrgicas de los próximos 60 días,
    que aparecen solas y no se editan.
  - **Lista:** agrupada por mes. Lo que ya pasó no aparece.
  - **"Agregar a mi calendario":** baja un `.ics` con la hora local del
    celular (1 h de duración), o de día completo si no tiene hora.
  - **Edición:** un admin con sesión agrega, edita y borra (`escribirDato`;
    `push` para los nuevos).
  - **Sin conexión:** copia local en `localStorage.avisos_cache`.
  - **En el índice** (2026-11-17): el aviso más cercano de los próximos 30
    días, en un solo renglón (el título se corta con … si no entra). Toda la
    tarjeta lleva a la página de avisos.
- **Pendiente:** la vista de calendario (grilla del mes) queda para más
  adelante (§6).
---

## 5. Cómo trabajar en el repo

- **Pruebas en `tests/`** (ver `tests/README.md`): Chrome headless manejado por
  CDP desde Node, sin dependencias.
  - `powershell -File tests/run.ps1` corre la regresión completa (`todo.mjs`).
    Correrla antes de cada commit que toque código.
  - Funcionalidad nueva: agregar su prueba en `tests/` y sumarla a `todo.mjs`.
  - **Cambios visuales o refactor de CSS:** antes de empezar,
    `tests/run.ps1 capturas.mjs --referencia`; al terminar, `capturas.mjs` sin
    flag compara píxel por píxel.
  - **Nunca escribir en la base real:** las escrituras se prueban con el
    Firebase falso de `tests/cdp.mjs`.
- **Node:** el `node` por defecto de esta máquina es v16 (no tiene `fetch` ni
  `WebSocket`). `run.ps1` usa `%LOCALAPPDATA%\nvm\v22.14.0\node.exe`.
- **Commits:** solo cuando el usuario lo pide. Mensaje corto en español,
  describiendo el cambio (ej.: "Navegacion que conserva categoria activa y modo
  admin"). En PowerShell 5.1 usar `git commit -F <archivo>`.
- **Zoom:** las dos páginas tienen `html { touch-action: manipulation; }`, que
  saca el zoom por doble toque (molesta al tocar rápido los botones). No usar
  `user-scalable=no`: el pellizco para agrandar tiene que seguir funcionando,
  para quien ve poco.
- **Respuesta al tocar** (2026-11-15): todos los botones se achican y cambian
  de brillo al apretarlos (`:active` en `comun.css`). Una clase de botón nueva
  se agrega a esa lista. Lo que cambia un estado tiene que notarse: color del
  botón o `avisar()`.
- **Pruebas que cortan la salida:** no usar `Select-Object -First` sobre
  `run.ps1`. Corta el script antes de que cierre Chrome, y las corridas
  siguientes se conectan a ese Chrome viejo.
- **Modo oscuro:** al agregar estilos, probar la pantalla en los dos temas
  (botón luna / sol). Ningún color fijo pensado para fondo claro debe quedar sin su
  ajuste en `comun.css` (D17).
- **Diagramas de guitarra:** un acorde nuevo que no esté en `CHORD_DICTIONARY`
  muestra "Diagrama no disponible". Si aparece en una letra, agregar su voicing.

---

## 6. Implementaciones futuras

### Plan de mejoras aprobado (2026-10-01)

Se implementa por fases, con un commit y una verificación en el navegador por
fase:

| Fase | Contenido | Estado |
|---|---|---|
| 0 | `songs.js` compartido; modo banco por REST (D14) | Hecha |
| 1 | Pantalla encendida, desplazamiento automático, orden de la misa, anterior/siguiente | Hecha |
| 2 | Sin internet: service worker, manifest (instalable), copia local de datos | Hecha |
| 3 | Login de admin con Google + reglas de Firebase | Hecha (reglas aplicadas en la consola; verificado el 2026-11-17) |
| 4 | Tono del coro por canción, compartir por WhatsApp, buscar por letra, audios y links | Hecha |
| 5 | QR para fieles (requiere las fases 0 y 3 publicadas) | Hecha |

Ya decidido:
- Los fieles (modo banco) tienen anterior/siguiente y funcionan sin internet.
  No tienen pantalla encendida, desplazamiento automático ni audios.
- El login de admin es con cuenta de Google y una lista de emails autorizados.

### Revisión del código (2026-10-02)

Hecha en 7 commits, cada uno verificado con `tests/`:
- arreglo de un XSS en `cancion.html`;
- pruebas en el repo y capturas de referencia;
- arreglos de la misa (ids borrados, otra versión publicada) y reglas más
  estrictas;
- código muerto;
- `comun.js` y funciones de datos;
- `acordes.js` / `cancion.js` y `render()` único;
- `comun.css`.

Sin cambios visuales: las capturas son idénticas al píxel.

### Plan: canciones editables desde la web (aprobado 2026-11-17; terminado 2026-11-20)

**Objetivo:** que un admin pueda, desde el celular, corregir una canción (mover
un acorde a la sílaba justa, cambiarlo, agregarlo o borrarlo, corregir el
texto) y cargar canciones nuevas, sin pasar por el repo ni por un chat.

**Ya decidido con el usuario:**
- Los acordes se mueven **tocando**, no arrastrando: en el celular el dedo tapa
  la sílaba. Se toca el acorde y después ◀ ▶ (una letra por toque) o la sílaba
  de destino.
- Se pueden corregir también las canciones que ya están en el repo.
- Edita solo quien tiene sesión de admin (D16).
- No hay modo proyector.

**Formato:** cada acorde anclado a su sílaba (§3, D7 y D22). El mismo texto
sirve para el repo (`letras/<id>.txt`) y para Firebase
(`canciones/<id>/letra`). Lo interpretan y escriben las funciones de
`letra.js` (`parsearLetra`, `escribirLetra`, `armarRenglon`…), que van a usar
también el editor y la carga de canciones nuevas.

#### Etapa 1 — Nuevo dibujo y conversión de todas las letras: HECHA (2026-11-17)

- `letra.js` con sus pruebas en Node (`tests/letra.node.mjs`), el dibujo nuevo
  en `cancion.js` / `cancion.html` y la búsqueda con `lineasDeTexto`.
- Las 108 letras pasaron de `letras/<id>.html` a `letras/<id>.txt`, midiendo
  en pantalla dónde se veía cada acorde (detalle y reglas en D22). Verificado:
  mismos acordes y mismo texto, y antes / después lado a lado de cada canción.
- Cambios respecto de lo planeado:
  - El acorde no ocupa lugar en la letra: se lee de corrido, como antes, y solo
    se abre espacio donde dos acordes chocarían (`acomodarAcordes()`).
  - Se agregó el "acorde después de una palabra" (`mí,[DO7] tan`), para los
    huecos que marcaban una palabra sostenida.
- Pruebas nuevas: `tests/dibujo-letra.mjs` (dibujo en el navegador) y
  `tests/letra.node.mjs`. Se actualizaron las que miraban `pre c`.
- `sw.js`: `LETRAS` a `.txt`, `letra.js` en `PROPIOS`, `VERSION` v13.

#### Etapa 2 — Editor de acordes (admin): HECHA (2026-11-17)

Cómo quedó: D23. Pruebas: `tests/editor.mjs`, más casos en `letra.node.mjs`
y `acordes.node.mjs`. `sw.js`: `editor.js` en `PROPIOS`, `VERSION` v14.
Reglas de `canciones` en `database.rules.json` (hay que pegarlas, §7).

Cambios respecto de lo planeado:
- La entrada es un lápiz al lado de "Acordes" (con la palabra "Editar" desde
  480 px), no un botón con texto: entra en ese renglón y no suma uno arriba de
  la letra (D20).
- "Corregida por…" va después de anterior / siguiente (D20), con los botones
  del admin.
- Deshacer es de un paso: vuelve `anterior` y no queda otro. `anterior` solo
  se guarda si lo reemplazado era una corrección.
- Se edita en el tono original; el campo del nombre acepta minúsculas y
  notación americana y dice cómo queda.
- Si otro admin guarda mientras se edita, se avisa y Guardar pregunta (sigue
  ganando el último).
- Banco lee solo `canciones/<id>/letra`.

Lo planeado:
- **Entrada:** botón "Editar acordes" en la canción, que solo ve un admin con
  sesión. Se reserva su lugar como manda D16.
- **Acorde tocado:** queda marcado y aparece una barra con ◀ ▶, "Cambiar",
  "Borrar" y "Listo". Tocar otra sílaba lleva el acorde ahí.
- **Sílaba sin acorde:** "+ Acorde acá", con un campo para escribirlo. Avisa si
  no tiene diagrama en `CHORD_DICTIONARY`.
- **Edición:** se ve igual a como va a quedar. "Guardar" y "Descartar"; nada
  cambia hasta guardar.
- **Datos (Firebase):**
  - `canciones/<id>`: `{ letra, por, cuando, anterior }`. Si existe, **pisa** a
    `letras/<id>.txt`.
  - `anterior` guarda la versión previa, para un "Deshacer el último cambio".
  - "Volver a la versión original" borra la corrección y vuelve a la del repo.
- **Quién y cuándo:** "Corregida por Mateo · 17/11", visible para músicos y
  admin, como "Publicada por…".
- **Lectura:**
  - Músicos y admin: `seguirDato('canciones/<id>', …)` (D18), con copia local.
  - Banco: una lectura por REST al abrir la canción (D14).

#### Etapa 3 — Texto y canciones nuevas: HECHA (2026-11-20)

Cómo quedó: D24. Pruebas: `tests/canciones-web.mjs` y casos nuevos en
`letra.node.mjs`. Reglas de `canciones_indice` en `database.rules.json` (hay
que pegarlas, §7).

Cambios respecto de lo planeado:
- "Nueva canción" crea la canción con la letra pendiente y abre el editor en
  "Texto": la letra se carga ahí, con "Pegar con acordes arriba", y no en el
  formulario del índice.
- El número repetido en el mismo momento pregunta en vez de impedir (los
  números del cancionero impreso se repiten entre momentos).
- Las letras de la web se bajan por REST también para músicos y admin (no
  ocupan la conexión en vivo); en banco, solo las de la misa.
- Todavía no hay botón para borrar una canción de la web (se hace en la
  consola).

Lo planeado:
- **Pestaña "Texto"** en el editor: la letra en el formato de corchetes, para
  corregir palabras o estrofas, con vista previa en vivo.
- **"Pegar con acordes arriba":** convierte el formato habitual de internet y
  WhatsApp:
  - pasa de notación americana a latina y aplica las conversiones de §3;
  - ancla cada acorde por columna;
  - marca lo dudoso para revisarlo.
- **"Nueva canción"** (índice, admin):
  - Pide título, categoría y número del cancionero (opcional).
  - El `id` se arma con el prefijo y el slug de §3.
  - Antes de crear, revisa que no exista una canción con el mismo título o
    número (§3, regla 3).
- **Índice liviano:** `canciones_indice/<id>`: `{ titulo, categoria, num }`.
  - El índice y la búsqueda mezclan esto con `SONGS`.
  - Las letras se bajan aparte, para no cargar todos los textos al abrir el
    índice.
  - Una misa con una canción nueva funciona en todos los modos, banco incluido.
- **Sin internet (D15):** las canciones de la web quedan en `localStorage` al
  abrirlas. Con conexión, el índice las baja todas en segundo plano (son
  pocas).

#### Etapa 4 — Respaldo en el repo: HECHA (2026-11-20)

Cómo quedó: D25. Cambio respecto de lo planeado: el script no borra de
Firebase (no tiene sesión de admin); lo que quedó igual al repo lo saca el
índice abierto por un admin con sesión.

Lo planeado:
- **Por qué:** el plan gratuito de Firebase no hace copias de seguridad.
- **Cómo:** un script (Node, leyendo por REST) baja `canciones/` y
  `canciones_indice/` y escribe `letras/<id>.txt` y las entradas de `SONGS`.
- **Después:** se borran de Firebase las ya pasadas.
- **Cuándo:** el usuario lo pide cada tanto ("pasá las canciones de la web al
  repo").

#### Reglas de la base (§7), para pegar en la consola con cada etapa

- `canciones/<id>` (etapa 2, ya en `database.rules.json`):
  - escribe solo un admin;
  - `letra` es texto de hasta 20 000 caracteres;
  - `por` es texto, y `cuando` es la hora del servidor.
- `canciones_indice/<id>` (etapa 3, ya en `database.rules.json`): la
  `categoria` tiene que ser una clave de `CATS` y el `titulo` tiene hasta 120
  caracteres.
- Lectura pública de las dos (la necesita el banco).

#### Riesgos y cómo se cubren

- **Cambia el aspecto de todas las letras:** capturas de las 106 antes y
  después, y prueba en iPhone (Safari) antes de publicar la etapa 1.
- **Dos admins corrigen la misma canción:** gana el último que guarda, y el
  aviso "Corregida por…" muestra quién fue.
- **Renombrar el `id` de una canción:** su corrección queda huérfana, igual
  que la nota y el tono (§4b).
- **Pruebas:** cada etapa suma las suyas a `tests/` y a `todo.mjs`. Las
  escrituras van siempre contra el Firebase falso.

### Otros pendientes

- **Editar y cargar canciones desde la web:** ver "Plan: canciones editables
  desde la web", arriba. Terminado (2026-11-20); para pasar lo de la web al
  repo, D25.
- **Más de una misa a la vez** (pedido 2026-11-20): preparar las canciones de
  varias misas (por ejemplo, sábado y domingo, o la de la semana que viene
  mientras sigue publicada la de hoy). Falta decidir con el usuario cómo
  (opciones planteadas en el chat del 2026-11-20).

- Vista de calendario de los avisos (grilla del mes con puntos en los días con
  eventos; al tocar un día, sus avisos). Decidido: después de la lista.

- Cargar los links de audio (`medios` en `songs.js`). Al 2026-10-01 tienen 6
  canciones carmelitanas (La confianza, Porque te amo oh Madre, El abandono,
  Una lluvia de rosas, No conozco otro medio, Lo que agrada a Dios).
- Cargar las letras de `com_eucaristia` y `var_glorioso-rey-en-la-cruz` (hoy
  tienen el aviso de "letra pendiente").
- `ador_noche-oscura-jesed`: los acordes vinieron amontonados al principio de
  cada verso. Reacomodarlos con el editor (D23) cuando alguien del coro
  confirme en qué sílaba cae cada cambio.

---

## 7. Configuración de Firebase (se hace una vez, en la consola)

Proyecto `coro-97958` en https://console.firebase.google.com. Hacerlo en este
orden: los pasos 1 a 3 no rompen nada, y las reglas van al final.

1. **Activar el login con Google:** Authentication → Comenzar → Sign-in method
   → Google → Habilitar → elegir el email de asistencia → Guardar.
2. **Autorizar el dominio del sitio:** Authentication → Configuración →
   Dominios autorizados → Agregar dominio → `riforta.github.io`.
3. **Cargar los admins:** Realtime Database → Datos → en la raíz, agregar el
   nodo `admins`. Dentro, una entrada por admin, con el email en minúsculas y
   los puntos cambiados por comas, y el valor `true`. Ejemplo:
   `admins` → `nombre,apellido@gmail,com` : `true`.
4. **Publicar el código** (push a `main`) y probar el login desde el celular.
5. **Aplicar las reglas:** Realtime Database → Reglas → reemplazar todo por el
   contenido de `database.rules.json` → Publicar.

**Cada vez que cambia `database.rules.json`**, hay que volver a pegarlo en la
consola, después de publicar el código. Desde 2026-10-02 las reglas validan
además los rangos del tono (transponer de −11 a 11, capo de 0 a 8, sin campos
extra) y que la misa sea una lista de ids de texto. Desde la misma fecha se
suman `misa_meta` (quién y cuándo) y `avisos` (fecha, hora, tipo y largos
validados); sin pegar las reglas nuevas, publicar la misa y guardar avisos da
"Permission denied". Desde 2026-11-15 se suma `medios` (hasta 5 links `https`
por canción); sin pegarlas, agregar un audio desde la app da "Permission
denied". Desde 2026-11-17 se suma `canciones` (letras corregidas desde la web,
D23); sin pegarlas, guardar los acordes da "Permission denied". Desde
2026-11-20 se suma `canciones_indice` (canciones nuevas desde la web, D24); sin
pegarlas, "Nueva canción" da "Permission denied". Desde la misma fecha se
suma `eliminadas` (D26); sin pegarlas, eliminar una canción da "Permission
denied".

**Para comprobar las reglas:** sin sesión, escribir por REST tiene que dar
`Permission denied`. Por ejemplo:
`curl -X PUT -d '"x"' https://coro-97958-default-rtdb.firebaseio.com/notas/prueba.json`.

**Para sacar a un admin:** borrar su entrada en `admins`.
