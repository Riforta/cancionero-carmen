// Regresión completa: instala el service worker y corre todas las pruebas en
// el mismo navegador. iphone.mjs va al final porque borra a propósito una
// letra de la caché.
await import('./_instalar-sw.mjs');
await import('./seguridad.mjs');
await import('./revision.mjs');
await import('./base.mjs');
await import('./misa.mjs');
await import('./login.mjs');
await import('./preparar.mjs');
await import('./qr.mjs');
await import('./tema.mjs');
await import('./audios.mjs');
await import('./corderos.mjs');
await import('./liturgia.mjs');
await import('./publicada.mjs');
await import('./letra.mjs');
await import('./sin-internet.mjs');
await import('./iphone.mjs');
