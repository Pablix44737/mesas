/**
 * Graba el video de los líderes de mesa desde el escenario /video del servidor
 * de desarrollo, cuadro por cuadro, y lo une con la voz.
 *
 *   node grabar.mjs                 → salida/lider-de-mesa.mp4
 *   node grabar.mjs --fotos 2,9.4   → salida/foto-2.png, salida/foto-9.4.png
 *
 * Necesita el servidor corriendo en http://localhost:5173.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import ffmpeg from 'ffmpeg-static';

const FPS = 30;
const URL_ESCENARIO = process.env.ESCENARIO ?? 'http://localhost:5173/video';
mkdirSync('salida', { recursive: true });

const argumento = process.argv.indexOf('--fotos');
const fotos = argumento > 0 ? process.argv[argumento + 1].split(',').map(Number) : null;

const navegador = await chromium.launch();
const pagina = await navegador.newPage({
	viewport: { width: 432, height: 768 },
	deviceScaleFactor: 2.5
});
await pagina.goto(URL_ESCENARIO);
await pagina.waitForFunction(() => 'video' in window, null, { timeout: 60_000 });
const { duracion, demora, toques } = await pagina.evaluate(() => window.video);

const seek = (t) => pagina.evaluate((t) => window.video.seek(t), t);

if (fotos) {
	for (const t of fotos) {
		await seek(t);
		await pagina.screenshot({ path: `salida/foto-${t}.png` });
		console.log(`salida/foto-${t}.png`);
	}
	await navegador.close();
	process.exit(0);
}

// Los cuadros van directo a ffmpeg, sin pasar por disco.
const total = Math.ceil(duracion * FPS);
const video = spawn(ffmpeg, [
	'-y', '-loglevel', 'error',
	'-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
	'-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
	'salida/imagen.mp4'
], { stdio: ['pipe', 'inherit', 'inherit'] });

const inicio = Date.now();
for (let i = 0; i < total; i++) {
	await seek(i / FPS);
	const cuadro = await pagina.screenshot({ type: 'jpeg', quality: 95 });
	if (!video.stdin.write(cuadro)) await new Promise((r) => video.stdin.once('drain', r));
	if (i % 60 === 0) process.stdout.write(`\r${i}/${total} cuadros · ${Math.round((Date.now() - inicio) / 1000)} s`);
}
video.stdin.end();
await new Promise((r) => video.on('close', r));
await navegador.close();
console.log(`\nimagen lista en ${Math.round((Date.now() - inicio) / 1000)} s`);

// La voz con su demora, y un toque suave en cada pulsación.
const filtro = [
	`[1:a]adelay=${demora * 1000}|${demora * 1000},aresample=48000,apad[voz]`,
	`aevalsrc=0.6*sin(2*PI*1700*t)*exp(-55*t):s=48000:d=0.09,asplit=${toques.length}${toques.map((_, i) => `[k${i}]`).join('')}`,
	...toques.map((t, i) => `[k${i}]adelay=${Math.round(t * 1000)},volume=0.3[c${i}]`),
	`[voz]${toques.map((_, i) => `[c${i}]`).join('')}amix=inputs=${toques.length + 1}:normalize=0:duration=first,loudnorm=I=-16:TP=-1.5[a]`
].join(';');

await new Promise((listo, fallo) => {
	const unir = spawn(ffmpeg, [
		'-y', '-loglevel', 'error',
		'-i', 'salida/imagen.mp4', '-i', 'audio/toma2.mp3',
		'-filter_complex', filtro,
		'-map', '0:v', '-map', '[a]',
		'-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest',
		'salida/lider-de-mesa.mp4'
	], { stdio: 'inherit' });
	unir.on('close', (codigo) => (codigo === 0 ? listo() : fallo(new Error(`ffmpeg terminó con ${codigo}`))));
});
console.log('salida/lider-de-mesa.mp4');
