---
name: verify
description: Cómo verificar cambios de este sitio estático en un navegador real (Chrome headless + CDP, sin dependencias).
---

# Verificar cambios del cancionero

**Primero: usar `tests/`.** El repo trae el banco de pruebas armado
(`tests/README.md`): `powershell -File tests/run.ps1` corre la regresión
completa, y `tests/run.ps1 capturas.mjs [--referencia]` hace la comparación
visual. Lo de abajo explica cómo está hecho, para escribir pruebas nuevas.

Sitio estático sin build. Para ver un cambio funcionando hay que servirlo por HTTP
(los `fetch()` a `letras/*.html` fallan con `file://`).

## Receta que funciona

1. Servir el sitio: `python -m http.server 8642` (en background).
2. Si la extensión Claude-in-Chrome está conectada, usarla. Si no (caso habitual
   en esta máquina), lanzar Chrome headless con CDP:
   ```
   & "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --remote-debugging-port=9223 --remote-allow-origins=* --user-data-dir="$env:TEMP\claude-cdp" --no-first-run about:blank
   ```
3. Manejarlo con Node 22+ (tiene `fetch` y `WebSocket` nativos, no hace falta
   instalar nada): conectar al WS de `http://127.0.0.1:9223/json/version`,
   `Target.createTarget` + `Target.attachToTarget {flatten:true}`, y
   `Runtime.evaluate {returnByValue:true}` para leer estado y disparar eventos.
   `Page.captureScreenshot` para evidencia visual.

## Flujos que vale la pena manejar

- `cancion.html?id=<id>` — esperar a que existan `pre c[data-original]`
  (la letra se carga por fetch). Probar transposición (±½ tono), selector de
  capo (`#capoSelect`, evento `change`), toggle de acordes, popover de
  diagramas (click en un `<c>`).
- `?modo=banco` — toolbar/acordes/indicador y el botón de lectura en voz alta
  deben quedar ocultos; las líneas de acordes (incluido `Intro:`) no dejan
  renglones en blanco.
- Nota para músicos (`#nota`, Firebase `notas/<id>`) — **no escribir en la base
  real** para probar: interceptar `*gstatic.com/firebasejs/*` con
  `Fetch.enable` + `Fetch.fulfillRequest` y servir un `window.firebase` falso
  en memoria (`initializeApp`, `database().ref(p)` con `on/set/remove`).
  Leer con el Firebase real sí se puede.
- `index.html` — búsqueda y categorías. "Misa de Hoy" se lee de Firebase real
  (solo lectura); para publicar o reordenar, usar el Firebase falso.
- Node: el `node` por defecto es v16 (sin `fetch`/`WebSocket`); usar
  `%LOCALAPPDATA%
vm22.14.0
ode.exe`.

## Service worker (desde la fase 2 del plan)

- **Firebase falso + service worker:** si el SW ya controla la página, sirve el
  SDK **real** desde su caché y `Fetch.fulfillRequest` no llega a reemplazarlo.
  En toda página que use el Firebase falso, llamar antes
  `Network.setBypassServiceWorker({bypass: true})`. Si no, una prueba de
  "publicar" escribe en la base real. Antes de cualquier escritura de prueba,
  confirmar que existe `window.__writes` (marca del falso).
- **Probar sin conexión:** `Network.emulateNetworkConditions({offline:true})` en
  la página **y** en el target del service worker (`Target.getTargets` → tipo
  `service_worker` con URL `http…`, `attachToTarget`). La emulación de la
  página no alcanza a los pedidos que hace el SW.
- **Esperar la instalación:** `await navigator.serviceWorker.ready` y unos
  segundos para el precache, y recargar para que la página quede controlada.

## Gotchas

- Al terminar: matar el Chrome headless (filtrar `chrome.exe` por el
  `--user-data-dir` usado) y el servidor HTTP.
- Reutilizar el `--user-data-dir` entre corridas sirve HTML **cacheado**:
  después de editar un archivo, borrar el perfil (o usar uno nuevo) antes
  de volver a verificar.
- PowerShell 5.1: comillas dobles dentro de `git commit -m` rompen los
  argumentos; usar `git commit -F <archivo>`.
