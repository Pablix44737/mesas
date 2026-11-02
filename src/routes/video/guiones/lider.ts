/**
 * El guion del video, en segundos de la voz (toma 2 de ElevenLabs). Todo lo que
 * pasa en la imagen cuelga de acá: qué muestra el teléfono, adónde se desplaza,
 * qué se toca y qué se resalta. Los tiempos salen de la transcripción por
 * palabra, así cada toque cae sobre la palabra que lo nombra.
 */
import type { Guion } from '../tipos';

const DEMORA = 0.5;
const FIN_VOZ = 48.64;

const habilitado = (n: number) => `Ciclo ${n} habilitado. Los participantes ya pueden identificarse.`;
const SIGUIENTE = '.acciones-mesa .boton.enviar';
const CERRAR = '.acciones-mesa .boton.secundario';
const ciclo1 = { ciclos: 1, aviso: habilitado(1) };

const estados: Guion['estados'] = [
	[0, { pantalla: 'inicio' }],
	[9.35, { pantalla: 'mesas' }],
	[17.8, { pantalla: 'mesa', datos: { ciclos: 0 } }],
	[19.75, { pantalla: 'mesa', datos: ciclo1 }],
	...[1, 2, 3, 4, 5].map(
		(n): Guion['estados'][number] => [25.2 + n * 0.4, { pantalla: 'mesa', datos: { ...ciclo1, entraron: n } }]
	),
	...[1, 2, 3].map(
		(n): Guion['estados'][number] => [
			29.1 + n * 0.45,
			{ pantalla: 'mesa', datos: { ...ciclo1, entraron: 5, enviaron: n } }
		]
	),
	[33.45, { pantalla: 'mesa', datos: { ...ciclo1, entraron: 5, enviaron: 3 }, clics: [SIGUIENTE] }],
	[34.85, { pantalla: 'mesa', datos: { ciclos: 2, entraron: 5, aviso: habilitado(2) } }],
	[40.2, { pantalla: 'ciclo' }],
	[44.1, { pantalla: 'mesa', datos: { ciclos: 2, entraron: 5, enviaron: 3 } }],
	[45.55, { pantalla: 'mesa', datos: { ciclos: 2, entraron: 5, enviaron: 3 }, clics: [CERRAR] }],
	[46.45, { pantalla: 'mesa', datos: { ciclos: 2, cerrada: true, aviso: 'La mesa quedó cerrada.' } }]
];

const desplazamientos: Guion['desplazamientos'] = [
	{ v: 0, y: 0 },
	{ v: 9.35, y: 0 },
	{ v: 17.8, y: 0 },
	{ v: 25.6, desde: 25.0, y: '.mesa-tarjeta.personas', margen: 10 },
	{ v: 34.85, y: 0 },
	{ v: 36.0, desde: 35.3, y: '.mesa-tarjeta.personas', margen: 10 },
	{ v: 38.3, desde: 37.0, y: '.lo-evaluado', margen: 90 },
	{ v: 40.2, y: 0 },
	{ v: 42.3, desde: 41.0, y: '.evaluacion', margen: 8 },
	{ v: 44.1, y: 0 }
];

/** Cada toque del dedo, sobre la palabra que lo pide. */
const toques: Guion['toques'] = [
	{ v: 9.0, sel: '.inicio-coordinacion-lista a[href="/mesas"]' },
	{ v: 17.45, sel: 'a.mesa-ficha[href$="/3"]' },
	{ v: 19.45, sel: '.acciones-mesa .boton.enviar' },
	{ v: 33.15, sel: '.acciones-mesa .boton.enviar' },
	{ v: 34.55, sel: '.mesa-dialogo .dialogo-botones form .boton' },
	{ v: 39.9, sel: '.lo-evaluado li:last-child a' },
	{ v: 45.25, sel: '.acciones-mesa .boton.secundario' },
	{ v: 46.15, sel: '.mesa-dialogo .dialogo-botones form .boton' }
];

/** Lo que se marca con un anillo mientras la voz lo nombra. `url` es la barra de direcciones. */
const resaltados: Guion['resaltados'] = [
	{ v0: 6.6, v1: 8.3, sel: 'url' },
	{ v0: 13.1, v1: 14.4, sel: 'a.mesa-ficha[href$="/3"]' },
	{ v0: 15.9, v1: 17.2, sel: '.mesas-crear' },
	{ v0: 22.7, v1: 25.1, sel: '.qr-compacto' },
	{ v0: 25.6, v1: 27.9, sel: '.roles-del-ciclo' },
	{ v0: 29.9, v1: 31.1, sel: '.roles-del-ciclo li:first-child .envio' },
	{ v0: 35.9, v1: 36.9, sel: '.roles-del-ciclo' },
	{ v0: 38.4, v1: 39.6, sel: '.lo-evaluado' },
	{ v0: 42.4, v1: 43.9, sel: '.evaluacion .evaluacion-items' }
];

/** El título de cada paso, arriba del teléfono, y una aclaración cuando hace falta. */
const pasos: Guion['pasos'] = [
	{ v0: 5.3, v1: 11.85, numero: 1, titulo: 'Entrá a simunam.com' },
	{ v0: 11.85, v1: 17.85, numero: 2, titulo: 'Abrí tu mesa' },
	{ v0: 17.85, v1: 25.4, numero: 3, titulo: 'Habilitá el primer ciclo' },
	{ v0: 25.4, v1: 31.07, numero: 4, titulo: 'Mirá quién entró' },
	{ v0: 31.07, v1: 36.85, numero: 5, titulo: 'Pasá al ciclo siguiente' },
	{ v0: 36.85, v1: 43.94, numero: 6, titulo: 'Revisá lo evaluado' },
	{ v0: 43.94, v1: 47.3, numero: 7, titulo: 'Cerrá la mesa' }
];

const notas: Guion['notas'] = [
	{ v0: 9.9, v1: 11.85, texto: 'No pide clave' },
	{ v0: 14.2, v1: 17.85, texto: '¿No está? «Crear una mesa»' },
	{ v0: 21.0, v1: 25.4, texto: 'Recién ahí pueden escanear el QR' },
	{ v0: 27.8, v1: 31.07, texto: '«Envió» = ya mandó su lista' },
	{ v0: 34.9, v1: 36.85, texto: 'Cada uno rota de rol' },
	{ v0: 40.3, v1: 43.94, texto: 'Lo que hizo y lo que no' }
];

export const lider: Guion = {
	voz: 'audio/toma2.mp3',
	salida: 'lider-de-mesa',
	demora: DEMORA,
	duracion: DEMORA + FIN_VOZ + 1.8,
	para: 'para líderes de mesa',
	estados,
	desplazamientos,
	toques,
	resaltados,
	pasos,
	notas,
	apertura: { hasta: 4.9, sale: 0.45 },
	cierre: { desde: 47.25, entra: 0.5 }
};
