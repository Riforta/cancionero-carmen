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
| Quien arma la misa | `?admin=true` | Botones para elegir las canciones de "Misa de Hoy" y publicarlas, y para editar las notas |

En las vistas de músicos y admin, el botón "🔧 Modo admin" / "🎵 Salir de
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
- `index.html`: índice con búsqueda y categorías.
- `cancion.html`: muestra una letra (`?id=<id>`). Hace `fetch` de
  `letras/<id>.html` y la renderiza dentro de un `<pre>`.
- `letras/*.html`: un archivo por canción. Contiene solo un fragmento HTML (sin
  `<html>` ni `<head>`).
- `assets/`: logos, imágenes e íconos de la app (`icon-192.png`, `icon-512.png`,
  `apple-touch-icon.png`, generados desde `virgen-icono-color.jpg`).
- `sw.js`: service worker para funcionar sin internet (D15).
- `offline.js`: registra el service worker, muestra el aviso "Sin conexión" y
  trae `leerCopia()` y `guardarCopia()` para las copias locales.
- `manifest.webmanifest`: permite instalar el sitio como app ("Agregar a
  pantalla de inicio").
- `tema.js` y `tema.css`: modo oscuro (D17).
- `sesion.js`: barra de sesión del modo admin (login con Google) y la variable
  `esAdminOk` (D16).
- `qr.html`: página para imprimir el QR de los fieles (§4e).
- `database.rules.json`: reglas de la base. Son la referencia: se aplican a mano
  en la consola de Firebase (§7).
- `firebase-config.js`: config de Firebase compartida por las dos páginas, más
  `cargarFirebase()` (carga el SDK bajo demanda) y `leerFirebase(ruta)`
  (lectura puntual por REST).
- Firebase Realtime Database: guarda solo datos que se editan desde la web.
  - `misa_actual`: array con los ids de "Misa de Hoy".
  - `notas/<id>`: texto con la nota para músicos de cada canción (ver §4b).
  - `tonos/<id>`: `{ transponer, capo }`, el tono en que canta el coro cada
    canción (ver §4c).
  - `admins/<email>`: `true` para cada admin autorizado. El email va en
    minúsculas y con los puntos cambiados por comas (`claveAdmin()`).
- Hosting: GitHub Pages.

### Decisiones de arquitectura

**D1. Sitio estático, sin build y sin dependencias.** Se edita a mano y se
publica tal cual en GitHub Pages. No agregar frameworks, bundlers, `npm` ni
pasos de compilación. Las librerías externas solo vienen por CDN: hoy Firebase,
Google Fonts y `qrious` (cdnjs, solo en `qr.html`).

**D2. Letras como fragmentos HTML cargados por `fetch`.** Así agregar una
canción es solo crear un archivo. Consecuencia: el sitio no funciona abriéndolo
con `file://`; para probarlo hay que servirlo por HTTP (ver §5).

**D3. `SONGS` en `songs.js` es la fuente de verdad del índice** (archivo propio
desde 2026-10-01). Lo cargan `index.html` y `cancion.html`, y también lo usará el
service worker. `cancion.html` toma el título de `SONGS`. El parámetro `?t=`
queda solo como respaldo para links viejos.

**D4. El contexto de navegación viaja por la URL.** `modo`, `admin` y `cat`
(categoría activa, `todas` = sin filtro) pasan de `index.html` a `cancion.html` y
vuelven con el botón "Volver". No usar `localStorage` para esto.

**D5. Firebase solo para lo que se edita desde la web.** Hoy son "Misa de Hoy"
y las notas de las canciones. Lo que se edita como código (letras, índice,
links de audio) va en el repo. La config de Firebase (`firebase-config.js`) es
pública por diseño (así funciona Firebase web); la seguridad depende de las
reglas de la base (`database.rules.json`, D16).

**D6. `?admin=true` no es seguridad.** Solo cambia la vista: cualquiera entra
con el botón del encabezado. La seguridad la dan el login con Google y las
reglas de la base (D16).

**D7. Acordes en `<c>`, alineados con espacios dentro de un `<pre>`.** La fuente
es proporcional (EB Garamond), así que la alineación es aproximada. Al cargar
letras se conserva el espaciado del original, que suele venir de un documento
con fuente proporcional y cae razonablemente bien.

**D8. Las líneas que solo tienen acordes se envuelven en `.chord-line`.** Lo
hace `wrapChordLines` en `cancion.html`. Así se ocultan enteras al esconder los
acordes y en modo banco, sin dejar renglones en blanco. Cuenta como línea de
acordes la que, además de los `<c>`, solo tiene espacios, guiones, barras,
puntos, paréntesis o un prefijo `Intro:`.

**D9. Transposición y capotraste.** Acorde mostrado = original + transposición −
traste del capo. Con capo, los acordes se muestran en la posición en que se
tocan. La transposición siempre devuelve sostenidos (un `SIb` transpuesto se
muestra como `LA#`, `SI`, etc.).

**D10. Modo banco sin lector de voz** (2026-07-06). El lector de letra en voz
alta está en `cancion.html` para personas invidentes, pero en `?modo=banco` se
oculta junto con el resto de los controles.

**D11. Accesibilidad.** Los `<c>` y las `.chord-line` llevan `aria-hidden` para
que los lectores de pantalla lean solo la letra.

**D12. Audios por canción: solo links, en `songs.js`** (2026-10-01). Van en el
campo opcional `medios` de cada canción (§3); el reproductor lo arma
`cancion.html`. No guardar audio en GitHub ni en Firebase:
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
- **Estrategias:**
  - Páginas y JS propios: primero la red (3 s de espera) y, si falla, la copia.
    Por eso con conexión nunca se ve una versión vieja.
  - Letras: la copia al instante y se actualiza en segundo plano.
  - Imágenes, fuentes y SDK: primero la copia.
  - `firebaseio.com` no pasa por el service worker.
- **Datos de Firebase:** cada página guarda su copia en `localStorage`
  (`misa_cache`, `nota_<id>`) y la muestra mientras llega la versión en vivo.
  Sin conexión se queda con la copia y aparece el aviso "📴 Sin conexión".
- **Escrituras sin conexión:** publicar la misa o guardar una nota se bloquea
  con un aviso, para que no queden encoladas sin que nadie lo sepa.
- **Al cambiar `sw.js`, subir `VERSION`:** así se descarta la caché anterior.
  Las letras y canciones nuevas no requieren tocarlo, porque salen de
  `songs.js`. Un archivo propio nuevo (otra página, otro script) sí hay que
  agregarlo a `PROPIOS`.
- **Aviso de que está listo:** en el pie del índice aparece "📥 Listo para usar
  sin internet" cuando la caché ya tiene todas las letras (`offline.js`). Para
  probarlo: abrir el sitio con conexión, esperar el aviso y poner modo avión.
- **iPhone:** Safari borra los datos de un sitio que no se abre en 7 días. Para
  evitarlo, recomendar "Agregar a pantalla de inicio".

**D16. Login de admin con Google** (2026-10-01).
- **En la página:** en modo admin, `sesion.js` muestra una barra con "Entrar con
  Google". Los botones de edición (publicar, ↑ ↓, ❌, `+`, editar nota)
  aparecen solo si el email de la sesión está en `admins/` (`esAdminOk` y el
  evento `sesion-admin`).
- **En la base:** las reglas de `database.rules.json` dejan escribir solo a esos
  emails, verificados. Bloquean también a quien intente escribir por REST sin
  pasar por la página. Lectura pública solo en `misa_actual`, `notas` y
  `tonos`; cada admin puede leer únicamente su propia entrada en `admins/`.
- **Popup, no redirect:** el login usa popup. El redirect falla en GitHub Pages
  porque el navegador bloquea el almacenamiento de terceros de
  `firebaseapp.com`. Si el popup está bloqueado, se intenta con redirect.
- **Cuándo se carga Auth:** solo en modo admin. Músicos y banco no lo cargan.
- **Agregar un admin:** en la consola de Firebase (§7), sin tocar el código.


**D17. Modo oscuro** (2026-10-01). Lo manejan `tema.js` y `tema.css`, que
cargan las dos páginas en el `<head>`.
- **Qué tema se ve:**
  - `tema.js` pone `data-theme="light"` o `"dark"` en `<html>` antes de pintar,
    así no hay destello claro.
  - Arranca con el tema del celular (`prefers-color-scheme`) y sigue sus
    cambios.
  - Si la persona toca 🌙/☀️ en el encabezado, su elección queda en
    `localStorage.tema` y ya no sigue al sistema.
  - El botón está en todos los modos, banco incluido.
- **Cómo está armado:** `tema.css` redefine las variables bajo
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
  temas. Usar una variable, o agregar su ajuste en `tema.css`.
- **Excepción:** `qr.html` queda siempre clara, porque es para imprimir.
---

## 3. Reglas de negocio: canciones

### Archivo y entrada en el índice

1. Crear `letras/<prefijo>_<slug>.html`. El slug va en minúsculas, sin tildes ni
   ñ, con palabras separadas por guiones (`senor`, `oracion-del-alma-enamorada`).
2. Agregar la entrada en `SONGS` (`songs.js`), dentro del bloque comentado de
   su prefijo:
   ```js
   { "id": "com_mi-cancion", "num": 0, "title": "Mi canción", "category": "comunion" },
   ```
   - `id`: igual al nombre del archivo, sin `.html`.
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
     El tipo se deduce de la URL:
     - YouTube: reproductor de `youtube-nocookie`.
     - Spotify: track, álbum o playlist.
     - Google Drive: el archivo tiene que estar compartido como "cualquiera con
       el link".
     - `.mp3`, `.m4a`, etc.: reproductor de audio.
     - Cualquier otra URL `https://`: un link común.
     Solo músicos y admin. No aparece en banco ni sin conexión.
3. Antes de crear una canción, **verificar que no exista ya** (buscar por título
   y por número). Si existe y la letra coincide, no tocarla.

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

- Las categorías `sanjose`, `adviento`, `navidad`, `cuaresma` y `pascua` existen
  en `CATS` pero todavía no tienen canciones. Su botón aparece solo al cargar la
  primera. **Su prefijo no está definido todavía:** preguntar al usuario.
- "Misa de Hoy" (`misa`) no es una categoría de `SONGS`: se arma desde
  Firebase.

### Títulos

- Si sirve para buscarla, agregar entre paréntesis el autor o el grupo:
  `(San Juan de la Cruz)`, `(Jesed)`, `(Pascua Joven)`, `(Fones)`.
- No incluir las marcas de tono del cancionero impreso (`T1`, `T2/3`, `T3/4`).
  "La fonte T5" es una excepción histórica.

### Formato de la letra

- Acordes en notación latina y mayúsculas, dentro de `<c>`, en una línea propia
  encima del verso:
  ```
  <c>SOL</c>             <c>MIm</c>  <c>DO</c>
  Toma Señor y recibe toda mi libertad,
  ```
- Así se escriben los acordes:
  - Menores: `m` después del sostenido (`FA#m`, no `FAm#`).
  - Séptimas y otros: `RE7`, `FA#m7`, `SOLmaj7`, `REsus4`, `DOadd9`.
  - Bemoles: se aceptan (`SIb`).
  - Con bajo: `RE/FA#`.
  - Optativos: entre paréntesis por fuera de la etiqueta (`(<c>MI</c>)`).
- Las fuentes llegan con otras notaciones. Se convierten siempre:
  - Americana: `Am` → `LAm`, `G/F#` → `SOL/FA#`.
  - Latina en minúscula: `Rem` → `REm`.
  - Menor con guion: `La-` → `LAm`.
- **Estribillo** entre `<b>` y `</b>`, cada etiqueta en su propia línea. Si el
  estribillo se repite sin escribirlo entero: `<b>(Estribillo) Primeras palabras…</b>`.
- **Repeticiones:** `(bis)` al final del verso, o `/…/ (bis)` para marcar el
  tramo.
- **Intro:** una línea `Intro: <c>DO</c> <c>FA</c> …` al principio, seguida de
  una línea en blanco. También vale una progresión entre paréntesis.
- **Subtítulos** dentro de una letra (varias canciones en un archivo, como
  Antífonas): `<h3>`. **Aclaraciones:** `<i>`.
- Estrofas separadas por una línea en blanco. Sin espacios al final de línea.
- **Letra pendiente:** si la canción está en el índice pero falta la letra, usar
  el bloque `<div class="letra-pendiente">` (ver `com_eucaristia.html`).

### Correcciones al cargar

- Se pueden corregir errores evidentes de ortografía y tildes, y agregar signos
  de puntuación faltantes (`¿?`, `¡!`). Hay que **avisarle al usuario la lista de
  cambios**.
- No reescribir versos ni "corregir" contra el poema original si el coro canta
  otra versión (ej.: "pastorcito" en vez de "pastorcico").
- Marcar un estribillo con `<b>` es una interpretación: avisar al usuario cuando
  no está indicado en la fuente.
- Si la fuente trae los acordes amontonados o sin alinear, no inventar en qué
  sílaba cae cada uno: dejarlos como vienen y avisar.

---

## 4. Reglas de negocio: Misa de Hoy

- Se arma en `index.html?admin=true`, con sesión de admin (D16): `+` agrega,
  `❌ Quitar` saca y `💾 Publicar Misa` guarda en Firebase (`misa_actual`, un
  array de ids).
- **Orden** (2026-10-01): `+` inserta cada canción en su momento litúrgico,
  según el orden de `CATS` (entrada → gloria → aleluya → ofrenda → santo →
  comunión → adoración → marianos…), después de las que ya están en ese
  momento. El orden fino se ajusta con ↑ ↓ en la vista de la misa. El orden del
  array es el orden de la misa.
- `🗑️ Limpiar Misa` vacía solo la lista local hasta que se publique.
- **Anterior / siguiente:** en `cancion.html`, si se llegó desde Misa de Hoy
  (`cat=misa`), abajo de la letra aparecen la canción anterior y la siguiente,
  y la posición ("2 / 6"). Está en todos los modos, incluido banco.
- **Copia local:** cada vez que se recibe la misa se guarda en
  `localStorage.misa_cache`. Anterior/siguiente la muestra mientras llega la
  versión publicada.
- Al entrar sin `?cat=`, el índice arranca en "Misa de Hoy". Si no hay
  canciones, muestra "Aún no se han seleccionado las canciones…".
- Los ids de `misa_actual` que ya no existan en `SONGS` se ignoran. **Renombrar
  un `id` rompe la misa publicada que lo contenga.**

## 4b. Reglas de negocio: notas de las canciones

- **Para qué sirven:** indicaciones para el coro, como el tono en que se canta,
  dónde entra cada voz o una aclaración del ensayo.
- **Quién las ve:** la vista de músicos y la de admin, en una tarjeta "📝 Nota"
  arriba de la letra. **Nunca en `?modo=banco`.**
- **Quién las edita:** un admin con sesión de Google autorizada (D16), con
  "➕ Agregar nota" o "✏️ Editar".
  - **Guardar vacío borra la nota.**
  - Máximo 500 caracteres.
  - Texto plano: los saltos de línea se respetan y no se interpreta HTML.
- **Dónde se guardan:** en Firebase, en `notas/<id>`. **Renombrar el `id` de una
  canción deja su nota huérfana:** hay que moverla a mano en la base.
- **Tiempo real:** como "Misa de Hoy", una nota guardada aparece al instante en
  las páginas abiertas.

## 4c. Ayudas para tocar (`cancion.html`, músicos y admin)

Ninguna aparece en modo banco.

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
    Arriba se indica "🎼 Tono del coro: empieza en RE · capo 2", calculado con
    el primer acorde.
  - "Ver tono original" / "Volver al tono del coro" alterna entre los dos.
  - Si el músico transpone o pone capo a mano, eso queda solo en su celular y
    el indicador dice "(estás viendo otro tono)".
  - Un admin con sesión ve "💾 Guardar como tono del coro" cuando el tono que
    tiene en pantalla es distinto del guardado. Guardar el original sin capo
    borra el tono del coro.
  - Copia local en `localStorage.tono_<id>`.
- **Audios y links:** debajo de la letra, desde el campo `medios` (§3).

## 4d. Índice: búsqueda y compartir

- **Búsqueda:** primero las canciones cuyo título coincide. Desde 3 letras,
  también las que tienen la frase en la letra, con el verso encontrado y la
  coincidencia resaltada.
  - La primera búsqueda descarga todas las letras (sin conexión salen de la
    caché del service worker) y arma un índice en memoria.
  - Las líneas de solo acordes no cuentan.
- **Compartir la misa:** en Misa de Hoy (músicos y admin), "📤 Compartir la misa"
  arma un texto con las canciones por momento, un link para músicos
  (`?cat=misa`) y otro para fieles (`?modo=banco`).
  - Usa el menú de compartir del celular (`navigator.share`).
  - Si no está disponible, abre WhatsApp (`wa.me`).

## 4e. QR para los fieles (`qr.html`)

- **Qué abre:** la Misa de Hoy en modo banco
  (`https://riforta.github.io/cancionero-carmen/index.html?modo=banco`). Como la
  dirección no cambia, se imprime una sola vez y sirve para todas las misas.
- **Formatos:** cartel de hoja completa o 4 tarjetas por hoja A4, para recortar.
- **Dónde está:** en la barra de admin, "🖨️ QR para fieles".
- **Si se abre fuera de GitHub Pages** (por ejemplo, probando en la compu), el
  QR apunta igual al sitio publicado.
- **Antes de difundirlo:** tienen que estar publicadas las fases 0 (banco sin
  conexión en vivo, D14) y 3 (escrituras protegidas, §7).

---

## 5. Cómo trabajar en el repo

- **Verificar en un navegador real** con la skill `.claude/skills/verify`
  (`python -m http.server` + Chrome headless + CDP). Revisar al menos que la
  letra cargue, que no haya acordes sin diagrama (`chordLookup`) y que la
  canción aparezca en su categoría.
- **Node:** el `node` por defecto de esta máquina es v16 (no tiene `fetch` ni
  `WebSocket`). Para los scripts de CDP usar
  `%LOCALAPPDATA%\nvm\v22.14.0\node.exe`.
- **Commits:** solo cuando el usuario lo pide. Mensaje corto en español,
  describiendo el cambio (ej.: "Navegacion que conserva categoria activa y modo
  admin"). En PowerShell 5.1 usar `git commit -F <archivo>`.
- **Zoom:** las dos páginas tienen `html { touch-action: manipulation; }`, que
  saca el zoom por doble toque (molesta al tocar rápido los botones). No usar
  `user-scalable=no`: el pellizco para agrandar tiene que seguir funcionando,
  para quien ve poco.
- **Modo oscuro:** al agregar estilos, probar la pantalla en los dos temas
  (botón 🌙/☀️). Ningún color fijo pensado para fondo claro debe quedar sin su
  ajuste en `tema.css` (D17).
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
| 3 | Login de admin con Google + reglas de Firebase | Código hecho; falta la configuración en la consola (§7) |
| 4 | Tono del coro por canción, compartir por WhatsApp, buscar por letra, audios y links | Hecha |
| 5 | QR para fieles (requiere las fases 0 y 3 publicadas) | Hecha |

Ya decidido:
- Los fieles (modo banco) tienen anterior/siguiente y funcionan sin internet.
  No tienen pantalla encendida, desplazamiento automático ni audios.
- El login de admin es con cuenta de Google y una lista de emails autorizados.

### Otros pendientes

- Cargar los links de audio (`medios` en `songs.js`): todavía ninguna canción
  tiene.
- Cargar las letras de `com_eucaristia` y `var_glorioso-rey-en-la-cruz` (hoy
  tienen el aviso de "letra pendiente").
- `ador_noche-oscura-jesed`: los acordes vinieron amontonados al principio de
  cada verso. Reacomodarlos cuando alguien del coro confirme en qué sílaba cae
  cada cambio.
- Definir los prefijos para San José, Adviento, Navidad, Cuaresma y Pascua.

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

**Para comprobar las reglas:** sin sesión, escribir por REST tiene que dar
`Permission denied`. Por ejemplo:
`curl -X PUT -d '"x"' https://coro-97958-default-rtdb.firebaseio.com/notas/prueba.json`.

**Para sacar a un admin:** borrar su entrada en `admins`.
