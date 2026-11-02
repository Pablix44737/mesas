import type { Guion } from '../tipos';

/**
 * Video para Facilitadores: el docente que conduce la mesa en un curso de
 * estudiantes. Entra como líder de mesa, carga su documento, habilita los ciclos
 * y evalúa la técnica desde su propio checklist.
 *
 * Los tiempos salen de la transcripción por palabra de la toma 2.
 */
const DEMORA = 0.5;
const FIN_VOZ = 42.72;

const SIGUIENTE = '.acciones-mesa .boton.enviar';
const CERRAR = '.acciones-mesa .boton.secundario';
const CONFIRMAR = '.mesa-dialogo .dialogo-botones form .boton';
const ENVIAR = '.cotejo-barra .boton.enviar';
const DNI = '26777888';

const habilitado = (n: number) => `Ciclo ${n} habilitado. Los participantes ya pueden identificarse.`;
const base = { alumnos: true };
const ciclo1 = { ...base, ciclos: 1, aviso: habilitado(1) };
const evaluando = (marcados: number, enviada = false): Guion['estados'][number][1] => ({
	pantalla: 'cotejo',
	datos: { facilitador: true, marcados, enviada }
});

const estados: Guion['estados'] = [
	[0, { pantalla: 'inicio' }],
	[8.1, { pantalla: 'mesas', datos: { alumnos: true } }],
	[9.45, { pantalla: 'mesa', datos: { ...base, docente: false } }],
	// El documento se escribe de a un número.
	...[...DNI].map((_, i): Guion['estados'][number] => [
		11.2 + i * 0.12,
		{
			pantalla: 'mesa',
			datos: { ...base, docente: false },
			escribir: { sel: '#docente-dni', texto: DNI.slice(0, i + 1) }
		}
	]),
	[12.7, { pantalla: 'mesa', datos: base }],
	[18.2, { pantalla: 'mesa', datos: ciclo1 }],
	...[1, 2, 3, 4].map((n): Guion['estados'][number] => [
		20.6 + n * 0.4,
		{ pantalla: 'mesa', datos: { ...ciclo1, entraron: n } }
	]),
	[25.35, evaluando(0)],
	[30.0, evaluando(1)],
	[30.55, evaluando(2)],
	[30.8, evaluando(10)],
	[31.4, { ...evaluando(10), clics: [ENVIAR] }],
	[32.15, evaluando(10, true)],
	[32.8, { pantalla: 'mesa', datos: { ...base, ciclos: 1, entraron: 4, enviaron: 2, evaluo: true } }],
	[
		35.0,
		{
			pantalla: 'mesa',
			datos: { ...base, ciclos: 1, entraron: 4, enviaron: 2, evaluo: true },
			clics: [SIGUIENTE]
		}
	],
	[36.05, { pantalla: 'mesa', datos: { ...base, ciclos: 2, entraron: 4, aviso: habilitado(2) } }],
	[40.5, { pantalla: 'mesa', datos: { ...base, ciclos: 2, entraron: 4 }, clics: [CERRAR] }],
	[41.3, { pantalla: 'mesa', datos: { ...base, ciclos: 2, cerrada: true, aviso: 'La mesa quedó cerrada.' } }]
];

const desplazamientos: Guion['desplazamientos'] = [
	{ v: 0, y: 0 },
	{ v: 8.1, y: 0 },
	{ v: 9.45, y: 0 },
	// Sin ciclos, el QR grande va primero: el documento queda más abajo.
	{ v: 10.3, desde: 9.7, y: '.docente', margen: 90 },
	{ v: 18.2, y: 0 },
	{ v: 22.6, desde: 21.8, y: '.mesa-tarjeta.personas', margen: 10 },
	{ v: 25.35, y: 0 },
	{ v: 29.5, desde: 28.6, y: '#item-t-1', margen: 150 },
	{ v: 30.8, y: '#item-t-8', margen: 120 },
	// Enviado: el botón para volver a conducir la mesa queda a la vista.
	{ v: 32.15, y: '.cotejo-enviado', margen: 16 },
	{ v: 32.8, y: 0 },
	{ v: 33.6, desde: 33.0, y: '.mesa-tarjeta.personas', margen: 10 },
	{ v: 36.05, y: 0 },
	{ v: 37.6, desde: 36.6, y: '.lo-evaluado', margen: 90 },
	{ v: 40.5, y: '.lo-evaluado', margen: 90 }
];

const toques: Guion['toques'] = [
	{ v: 7.75, sel: '.inicio-coordinacion-lista a[href="/mesas"]' },
	{ v: 9.1, sel: 'a.mesa-ficha[href$="/3"]' },
	{ v: 10.9, sel: '#docente-dni' },
	{ v: 12.4, sel: '.docente-campo .boton' },
	{ v: 17.9, sel: SIGUIENTE },
	{ v: 25.0, sel: '.docente-tecnica' },
	{ v: 29.9, sel: '#item-t-1 .opcion-hizo' },
	{ v: 30.45, sel: '#item-t-2 .opcion-hizo' },
	{ v: 31.2, sel: ENVIAR },
	{ v: 31.85, sel: CONFIRMAR },
	{ v: 32.5, sel: '.cotejo-bloque .boton.enviar' },
	{ v: 34.75, sel: SIGUIENTE },
	{ v: 35.75, sel: CONFIRMAR },
	{ v: 40.3, sel: CERRAR },
	{ v: 41.05, sel: CONFIRMAR }
];

const resaltados: Guion['resaltados'] = [
	{ v0: 10.2, v1: 11.0, sel: '.docente' },
	{ v0: 13.3, v1: 16.5, sel: '.docente-fila' },
	{ v0: 20.4, v1: 21.8, sel: '.qr-compacto' },
	{ v0: 23.0, v1: 24.6, sel: '.docente-tecnica' },
	{ v0: 27.1, v1: 28.5, sel: '.cotejo-planificacion' },
	{ v0: 38.0, v1: 39.3, sel: '.lo-evaluado' }
];

const pasos: Guion['pasos'] = [
	{ v0: 4.9, v1: 10.0, numero: 1, titulo: 'Entrá y abrí tu mesa' },
	{ v0: 10.0, v1: 16.64, numero: 2, titulo: 'Cargá tu documento' },
	{ v0: 16.64, v1: 22.96, numero: 3, titulo: 'Habilitá el primer ciclo' },
	{ v0: 22.96, v1: 31.92, numero: 4, titulo: 'Evaluá la técnica' },
	{ v0: 31.92, v1: 36.6, numero: 5, titulo: 'Pasá al ciclo siguiente' },
	{ v0: 36.6, v1: 41.6, numero: 6, titulo: 'Lo evaluado y el cierre' }
];

const notas: Guion['notas'] = [
	{ v0: 7.2, v1: 10.0, texto: 'El mismo acceso que el líder de mesa' },
	{ v0: 13.4, v1: 16.64, texto: 'Facilitador en todos los ciclos' },
	{ v0: 19.7, v1: 22.96, texto: 'Los estudiantes eligen su rol' },
	{ v0: 27.0, v1: 31.92, texto: 'Planificación y checklist de la técnica' },
	{ v0: 34.6, v1: 36.6, texto: 'Los estudiantes rotan de rol' }
];

export const facilitador: Guion = {
	voz: 'audio/facilitador-toma2.mp3',
	salida: 'facilitador',
	demora: DEMORA,
	duracion: DEMORA + FIN_VOZ + 1.8,
	para: 'para Facilitadores',
	estados,
	desplazamientos,
	toques,
	resaltados,
	pasos,
	notas,
	apertura: { hasta: 4.6, sale: 0.45 },
	cierre: { desde: 41.6, entra: 0.5 }
};
