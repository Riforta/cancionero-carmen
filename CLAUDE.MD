# Cancionero — Coro Virgen del Carmen

Sitio estático (sin build, sin dependencias) para el cancionero del coro parroquial. Se publica en GitHub Pages.

Reglas de negocio, decisiones de arquitectura e implementaciones futuras: @AGENTS.md (mantenerlo actualizado al tomar decisiones nuevas).

## Estructura

- `index.html` — lista de canciones con búsqueda y categorías. La lista `SONGS` (dentro del `<script>`) es la fuente de verdad del índice: cada entrada tiene `id`, `title`, `category`. El `id` debe coincidir con el nombre del archivo en `letras/`.
- `cancion.html` — muestra una letra (`?id=<id>`), con transposición de acordes y popover con diagrama de guitarra (`CHORD_DICTIONARY`).
- `letras/*.html` — fragmentos HTML (sin `<html>`/`<head>`) con la letra y los acordes.
- `assets/` — logos e imágenes.
- La categoría "Misa de Hoy" se sincroniza vía Firebase Realtime Database (`misa_actual`). `?admin=true` muestra los botones de edición; `?modo=banco` oculta acordes y controles (vista para los fieles).

## Formato de letras

Acordes en notación latina (DO, RE, MI…) dentro de etiquetas `<c>`, en una línea propia encima de la línea de letra, alineados con espacios:

```
<c>SOL</c>             <c>MIm</c>  <c>DO</c>
Toma Señor y recibe toda mi libertad,
```

- Menores: sufijo `m` después del sostenido (`FA#m`, no `FAm#`). Séptimas: `RE7`, `FA#m7`, `SOLmaj7`. Con bajo: `RE/FA#`.
- El texto se renderiza dentro de un `<pre>`, así que los espacios y saltos de línea se respetan tal cual.

## Agregar una canción

1. Crear `letras/<prefijo>_<slug>.html` con el formato de arriba. Prefijos: `ent_` entrada, `glo_` gloria/kyrie, `ale_` aleluya, `ofert_` ofertorio, `snt_` santo/cordero, `com_` comunión, `ador_` adoración/post-comunión, `mar_` marianos, `var_` varias.
2. Agregar la entrada correspondiente en `SONGS` en `index.html`, con la `category` que corresponda.
