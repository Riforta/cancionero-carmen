---
name: verify
description: Cómo verificar cambios de este sitio estático en un navegador real (Chrome headless + CDP, sin dependencias).
---

# Verificar cambios del cancionero

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
- `index.html` — búsqueda y categorías. "Misa de Hoy" depende de Firebase
  (`?admin=true` para editar); no verificable offline.

## Gotchas

- Al terminar: matar el Chrome headless (filtrar `chrome.exe` por el
  `--user-data-dir` usado) y el servidor HTTP.
- Reutilizar el `--user-data-dir` entre corridas sirve HTML **cacheado**:
  después de editar un archivo, borrar el perfil (o usar uno nuevo) antes
  de volver a verificar.
- PowerShell 5.1: comillas dobles dentro de `git commit -m` rompen los
  argumentos; usar `git commit -F <archivo>`.
