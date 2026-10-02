# Pruebas del cancionero

Pruebas en un Chrome real (headless), manejado por CDP desde Node. No usan
dependencias ni `npm`: solo Node 22+ (trae `fetch` y `WebSocket`), Python
(servidor HTTP) y Google Chrome.

## Cómo correrlas (Windows, PowerShell)

```powershell
powershell -File tests/run.ps1                 # regresión completa (todo.mjs)
powershell -File tests/run.ps1 misa.mjs        # una sola prueba
powershell -File tests/run.ps1 capturas.mjs --referencia   # capturas de referencia
powershell -File tests/run.ps1 capturas.mjs    # comparar contra la referencia
node tests/acordes.node.mjs                    # acordes.js en Node, sin navegador (Node 22+)
node tests/liturgia.node.mjs                   # calendario litúrgico en Node
```

`run.ps1` levanta `python -m http.server 8642` en la raíz, abre Chrome
headless con un perfil nuevo, corre la prueba y cierra todo. Usa el Node de
`%LOCALAPPDATA%\nvm\v22.14.0\node.exe` si existe (el `node` por defecto de esta
máquina es v16).

Las capturas, PDF y diferencias quedan en `tests/salida/`, que no se sube a git.

## Reglas

- **Nunca escribir en la base real.** Las pruebas que publican o guardan usan
  el Firebase falso (`FAKE_FIREBASE` en `cdp.mjs`). Antes de cada escritura
  confirman que existe `window.__writes`. Leer la base real sí se puede, y
  algunas pruebas lo hacen (por ejemplo, la misa publicada en modo banco), así
  que necesitan conexión y una misa con al menos 2 canciones.
- **Con service worker:** las páginas con Firebase falso saltean el service
  worker (`Network.setBypassServiceWorker`); si no, servirían el SDK real desde
  la caché.
- **Capturas:** se comparan píxel por píxel. Generar la referencia antes de un
  refactor visual y comparar al terminar; las diferencias quedan pintadas de
  rojo en `salida/diferencias/`.

## Archivos

| Archivo | Qué prueba |
|---|---|
| `cdp.mjs` | Ayudante: páginas, Firebase falso, REST simulado, `check` / `done` |
| `run.ps1` | Levanta servidor y Chrome y corre una prueba |
| `todo.mjs` | Regresión completa (todas las de abajo) |
| `_instalar-sw.mjs` | Deja instalado el service worker antes del resto |
| `seguridad.mjs` | El `?id=` de la URL no se ejecuta como HTML |
| `revision.mjs` | Arreglos de la revisión: misa con ids borrados, aviso de otra versión publicada, singular, filas de admin, sin `?id=`, reglas, números |
| `base.mjs` | Índice, categorías, búsqueda, banco por REST, sin SDK |
| `misa.mjs` | Orden de la misa, ↑ ↓, anterior/siguiente, pantalla encendida, autoscroll |
| `login.mjs` | Login de admin con Google (simulado) y permisos |
| `preparar.mjs` | Tono del coro, búsqueda por letra, compartir, audios |
| `qr.mjs` | QR legible y que apunte al modo banco; impresión en 1 hoja |
| `tema.mjs` | Modo oscuro: sistema, botón y contraste |
| `audios.mjs` | Reproductores de las canciones con `medios` |
| `corderos.mjs` | Las canciones de Santo / Cordero cargan con diagramas |
| `publicada.mjs` | "Publicada por … · fecha": se guarda junto con la misa y solo se ve en Misa de Hoy (no en banco) |
| `letra.mjs` | Tamaño de letra A− / A+: escala, topes, se recuerda, acordes alineados, visible en banco |
| `avisos.mjs` | Avisos del coro: lista por mes con fiestas, sin lo pasado, `.ics`, alta/edición/baja de admin, sin conexión, banco, "Próximos avisos" del índice |
| `liturgia.mjs` | Franja del tiempo litúrgico en el índice (nombre, color, contraste, banco) y orden de categorías |
| `sin-internet.mjs` | Service worker, caché de letras, modo avión |
| `iphone.mjs` | Pantalla encendida en iPhone, zoom, aviso "Listo sin internet" |
| `capturas.mjs` | Comparación visual contra la referencia |
| `liturgia.node.mjs` | `liturgia.js` en Node: Pascua, tiempos, numeración, colores, fiestas y traslados argentinos |
| `acordes.node.mjs` | `acordes.js` en Node: transposición, bemoles, diagramas de todos los acordes de `letras/` en los 23 tonos |
