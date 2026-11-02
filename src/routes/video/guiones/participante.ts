import type { Estado, Guion } from '../tipos';

/**
 * Video para participantes: entrar con el QR, elegir rol, completar el
 * checklist, enviarlo y pasar al ciclo siguiente.
 *
 * Cada frase de la voz empieza en su ancla y lo demás se cuenta desde ahí, así
 * que ajustar a una toma nueva es cambiar las anclas.
 */
const S = {
	camara: 7.76,
	sumarse: 12.62,
	checklist: 19.96,
	enviar: 26.12,
	siguiente: 32.84,
	operador: 39.32,
	cierre: 45.16
};
const DEMORA = 0.5;
const FIN_VOZ = 47.36;

const DNI = '30222333';
const ROL = (codigo: string) => `input[value="${codigo}"]`;
const TARJETA_DE_ROL = (codigo: string) => `.sumarse-rol:has(${ROL(codigo)})`;
const ENVIAR = '.cotejo-barra .boton.enviar';
const CONFIRMAR = '.mesa-dialogo .dialogo-botones form .boton';
const ITEM = (n: number, hizo: boolean) => `#item-t-${n} ${hizo ? '.opcion-hizo' : '.opcion-no-hizo'}`;

const conDni = (texto: string, clics?: string[]): Estado => ({
	pantalla: 'sumarse',
	escribir: { sel: '#dni', texto },
	clics
});

/** Las marcas del video: tres «Hizo» y un «No hizo». */
const marcas = [
	{ n: 1, hizo: true },
	{ n: 2, hizo: true },
	{ n: 3, hizo: true },
	{ n: 4, hizo: false }
].map((marca, i) => ({ ...marca, v: S.checklist + 3.3 + i * 0.6 }));

const estados: Guion['estados'] = [
	[0, { pantalla: 'camara', barra: 'Cámara' }],
	[S.camara + 2.2, { pantalla: 'camara', barra: 'Cámara', datos: { detectado: true } }],
	[S.camara + 3.95, { pantalla: 'sumarse' }],
	// El DNI se escribe de a un número.
	...[...DNI].map((_, i): Guion['estados'][number] => [
		S.sumarse + 0.5 + i * 0.14,
		conDni(DNI.slice(0, i + 1))
	]),
	[S.sumarse + 3.7, conDni(DNI, [ROL('observador_tecnica')])],
	[S.sumarse + 6.2, { pantalla: 'cotejo', datos: { marcados: 0 } }],
	...marcas.map((marca, i): Guion['estados'][number] => [
		marca.v + 0.1,
		{ pantalla: 'cotejo', datos: { marcados: i + 1 } }
	]),
	// «Cuando termines»: ya está todo marcado.
	[S.enviar, { pantalla: 'cotejo', datos: { marcados: 10 } }],
	[S.enviar + 1.55, { pantalla: 'cotejo', datos: { marcados: 10 }, clics: [ENVIAR] }],
	[S.enviar + 3.15, { pantalla: 'cotejo', datos: { marcados: 10, enviada: true } }],
	[S.siguiente + 0.3, { pantalla: 'cotejo', datos: { marcados: 10, enviada: true, siguiente: true } }],
	[
		S.siguiente + 3.4,
		{
			pantalla: 'cotejo',
			datos: { marcados: 10, enviada: true, siguiente: true },
			clics: [`.cotejo-avanzar ${ROL('operador')}`]
		}
	],
	[S.operador - 0.4, { pantalla: 'cotejo', datos: { ciclo: 2 } }]
];

const desplazamientos: Guion['desplazamientos'] = [
	{ v: 0, y: 0 },
	{ v: S.sumarse + 2.7, desde: S.sumarse + 1.9, y: '.sumarse-roles', margen: 12 },
	{ v: S.sumarse + 6.2, y: 0 },
	{ v: S.checklist + 2.6, desde: S.checklist + 1.4, y: '#item-t-1', margen: 150 },
	{ v: S.checklist + 4.8, desde: S.checklist + 4.0, y: '#item-t-3', margen: 150 },
	{ v: S.enviar, y: '#item-t-8', margen: 120 },
	{ v: S.enviar + 3.15, y: 0 },
	{ v: S.siguiente + 2.4, desde: S.siguiente + 1.2, y: '.cotejo-avanzar', margen: 70 },
	{ v: S.operador - 0.4, y: 0 }
];

const toques: Guion['toques'] = [
	{ v: S.camara + 3.65, sel: '.enlace' },
	{ v: S.sumarse + 0.25, sel: '#dni' },
	{ v: S.sumarse + 3.6, sel: TARJETA_DE_ROL('observador_tecnica') },
	{ v: S.sumarse + 5.8, sel: '.sumarse-accion .boton' },
	...marcas.map((marca) => ({ v: marca.v, sel: ITEM(marca.n, marca.hizo) })),
	{ v: S.enviar + 1.35, sel: ENVIAR },
	{ v: S.enviar + 2.85, sel: CONFIRMAR },
	{ v: S.siguiente + 3.3, sel: `.cotejo-avanzar ${TARJETA_DE_ROL('operador')}` },
	{ v: S.siguiente + 5.4, sel: '.cotejo-entrar' }
];

const resaltados: Guion['resaltados'] = [
	{ v0: S.sumarse + 0.2, v1: S.sumarse + 1.9, sel: '.sumarse-campo' },
	{ v0: S.checklist + 0.6, v1: S.checklist + 2.6, sel: '.cotejo-lista-cabecera' },
	{ v0: S.enviar + 3.3, v1: S.enviar + 6.5, sel: '.cotejo-enviado' },
	{ v0: S.siguiente + 2.4, v1: S.siguiente + 3.1, sel: '.cotejo-avanzar .sumarse-roles' },
	{ v0: S.operador + 0.4, v1: S.operador + 5.2, sel: '.cotejo-bloque' }
];

const pasos: Guion['pasos'] = [
	{ v0: S.camara - 0.4, v1: S.sumarse, numero: 1, titulo: 'Escaneá el QR de tu mesa' },
	{ v0: S.sumarse, v1: S.checklist, numero: 2, titulo: 'Tu DNI y tu rol' },
	{ v0: S.checklist, v1: S.enviar, numero: 3, titulo: 'Completá tu checklist' },
	{ v0: S.enviar, v1: S.siguiente, numero: 4, titulo: 'Envialo' },
	{ v0: S.siguiente, v1: S.operador, numero: 5, titulo: 'Pasá al ciclo siguiente' },
	{ v0: S.operador, v1: S.cierre + 0.1, numero: 6, titulo: 'Operador o asistente' }
];

const notas: Guion['notas'] = [
	{ v0: S.camara + 0.6, v1: S.sumarse, texto: 'Con la cámara del celular' },
	{ v0: S.sumarse + 0.4, v1: S.sumarse + 3.2, texto: 'Sin puntos ni espacios' },
	{ v0: S.checklist + 3.0, v1: S.enviar, texto: '«Hizo» o «No hizo» en cada ítem' },
	{ v0: S.enviar + 3.2, v1: S.siguiente, texto: 'Después ya no se puede cambiar' },
	{ v0: S.siguiente + 4.0, v1: S.operador, texto: 'Sin volver a escanear' },
	{ v0: S.operador + 2.4, v1: S.cierre + 0.1, texto: 'Ese ciclo no completás nada' }
];

export const participante: Guion = {
	voz: 'audio/participante-toma2.mp3',
	salida: 'participante',
	demora: DEMORA,
	duracion: DEMORA + FIN_VOZ + 1.8,
	para: 'para participantes',
	estados,
	desplazamientos,
	toques,
	resaltados,
	pasos,
	notas,
	apertura: { hasta: S.camara - 1.0, sale: 0.45 },
	cierre: { desde: S.cierre + 0.1, entra: 0.5 }
};
