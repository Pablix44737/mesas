# Video para líderes de mesa

Video vertical (1080 × 1920, 30 fps) de unos 50 s, con un recorrido por lo básico:
entrar, abrir la mesa, habilitar ciclos, ver quién entró, ver lo evaluado y cerrar la mesa.

## Cómo está hecho

- **Pantallas**: son las pantallas reales de la app (`src/routes/...`), dibujadas con
  datos inventados (`src/routes/video/datos.ts`). La ruta `/video` existe solo en
  desarrollo: en producción responde 404.
- **Guion**: `src/routes/video/guion.ts` tiene todos los tiempos (qué pantalla, qué se
  toca, qué se resalta, los títulos de cada paso), tomados de la transcripción por
  palabra de la voz.
- **Voz**: ElevenLabs, voz «Melanie» (rioplatense), modelo eleven_v4. Tomas en `audio/`;
  se usa `audio/toma2.mp3`.
- **Grabación**: `grabar.mjs` abre `/video` en Chromium (Playwright), saca cada cuadro
  con `seek(t)` y los pasa a ffmpeg. Después mezcla la voz y un clic suave por toque.

## Para volver a generarlo

1. Levantar el servidor de desarrollo (`npm run dev` en la raíz, puerto 5173).
2. En esta carpeta: `npm install` (una sola vez) y `npx playwright install chromium`.
3. `node grabar.mjs` → `salida/lider-de-mesa.mp4`.
4. Para revisar cuadros sueltos: `node grabar.mjs --fotos 8,20.5,34.9`.

Si se cambia el texto de la voz, hay que regenerar el audio, volver a transcribirlo y
ajustar los tiempos de `guion.ts`.
