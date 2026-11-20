# Cancionero — Coro Virgen del Carmen

Sitio estático (sin build, sin dependencias) para el cancionero del coro parroquial. Se publica en GitHub Pages.

Reglas de negocio, decisiones de arquitectura e implementaciones futuras: @AGENTS.md (mantenerlo actualizado al tomar decisiones nuevas).

## Estructura

- `songs.js` — la lista `SONGS` es la fuente de verdad del índice: cada entrada tiene `id`, `num`, `title`, `category`. El `id` debe coincidir con el nombre del archivo en `letras/`. También define `CATS` (categorías y su orden).
- `index.html` — lista de canciones con búsqueda y categorías.
- `cancion.html` + `cancion.js` — muestra una letra (`?id=<id>`), con transposición de acordes y popover con diagrama de guitarra. Los acordes (transposición, `CHORD_DICTIONARY`, dibujo del diagrama) están en `acordes.js`; el formato de las letras y su dibujo, en `letra.js` (D22).
- `editor.js` — editor de la canción, para un admin con sesión: acordes tocando y pestaña "Texto" con "Pegar con acordes arriba". Lo corregido se guarda en Firebase (`canciones/<id>`) y **pisa** a `letras/<id>.txt` (D23, D24).
- Canciones cargadas desde la web ("Nueva canción" en el índice): `canciones_indice/<id>` en Firebase, sin archivo en `letras/`; `comun.js` las suma a `SONGS` con `web: true` (D24).
- `comun.js` / `comun.css` — código y estilos compartidos por las dos páginas (ver D18 en AGENTS.md).
- `avisos.html` + `avisos.js` — avisos del coro (ensayos, celebraciones), solo para músicos y admin.
- `liturgia.js` — calendario litúrgico (tiempo, color, fiestas) calculado sin internet; ver D19.
- `herramientas/pasar-web-al-repo.mjs` — cuando el usuario pide "pasá las canciones de la web al repo": `node herramientas/pasar-web-al-repo.mjs` (con `--probar`, sin escribir). Escribe `letras/` y `songs.js`; lo de Firebase lo limpia después el índice abierto por un admin (D25).
- `tests/` — pruebas: `powershell -File tests/run.ps1` (regresión completa), `node tests/acordes.node.mjs` y `node tests/letra.node.mjs`. Ver `tests/README.md`.
- `letras/*.txt` — un archivo de texto por canción, con la letra y los acordes (formato abajo).
- `assets/` — logos, imágenes e íconos de la interfaz (`iconos.svg`, ver D21).
- `sw.js` + `offline.js` — funcionamiento sin internet: muestra la copia guardada al instante y la actualiza en segundo plano (D15). Un cambio de código se ve en la segunda carga o con el aviso "Actualizar".
- La categoría "Misa de Hoy" se sincroniza vía Firebase Realtime Database (`misa_actual`). Lo armado sin publicar queda como borrador en el celular (§4 de AGENTS.md). `?admin=true` muestra los botones de edición; `?modo=banco` oculta acordes y controles (vista para los fieles).

## Formato de letras

Acordes en notación latina (DO, RE, MI…) entre corchetes, **justo antes de la letra sobre la que caen**, dentro del verso. La página los dibuja exactamente encima; no se alinea nada con espacios:

```
[SOL]Toma, Señor, y re[MIm]cibe toda mi [DO]libertad,
```

- Menores: sufijo `m` después del sostenido (`FA#m`, no `FAm#`). Séptimas: `RE7`, `FA#m7`, `SOLmaj7`. Con bajo: `RE/FA#`. Opcional: `[(MI)]`.
- Acorde después de una palabra (se sostiene): `mí,[DO7] tan`. Renglón de solo acordes: `Intro: [DO] [FA]`.
- Marcas en renglón propio: `{estribillo}` / `{/estribillo}`, `{titulo: …}`, `{nota: …}`, `{pendiente}`. Detalle completo en §3 de AGENTS.md.

## Agregar una canción

1. Crear `letras/<prefijo>_<slug>.txt` con el formato de arriba. Prefijos: `ent_` entrada, `glo_` gloria/kyrie, `ale_` aleluya, `ofert_` ofertorio, `snt_` santo/cordero, `com_` comunión, `ador_` adoración/post-comunión y carmelitanos, `mar_` marianos, `var_` varias, `sjose_` San José, `adv_` Adviento, `nav_` Navidad, `cuar_` Cuaresma, `pasc_` Pascua.
2. Agregar la entrada correspondiente en `SONGS` en `songs.js`, con la `category` que corresponda.

Para corregir una letra que ya existe: si tiene una corrección hecha desde la web, esa es la que se ve, y cambiar el `.txt` no alcanza (§3, regla 4 de AGENTS.md).
