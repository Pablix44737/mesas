/**
 * Set de iconos propio, en trazos sobre una grilla de 24×24.
 *
 * Reemplaza a Material Symbols de la propuesta de Stitch: son los ~28 iconos que
 * la app usa de verdad, inline en el HTML, contra una fuente de iconos entera
 * pedida a un servidor externo. Menos peso y nada que falle si la red del aula
 * no llega a Google.
 */
export const iconos: Record<string, string[]> = {
	atras: ['M19 12H5', 'M12 19l-7-7 7-7'],
	adelante: ['M9 18l6-6-6-6'],
	arriba: ['M18 15l-6-6-6 6'],
	abajo: ['M6 9l6 6 6-6'],

	tilde: ['M20 6L9 17l-5-5'],
	'tilde-circulo': ['M22 11.08V12a10 10 0 1 1-5.93-9.14', 'M22 4L12 14.01l-3-3'],
	alerta: [
		'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
		'M12 9v4',
		'M12 17h.01'
	],
	error: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M15 9l-6 6', 'M9 9l6 6'],
	info: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 16v-4', 'M12 8h.01'],
	reloj: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 6v6l4 2'],

	inicio: ['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10'],
	mesa: ['M3 10h18', 'M5 10V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4', 'M6 10v10', 'M18 10v10'],
	corrida: ['M5 3l14 9-14 9V3z'],
	escenario: [
		'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2',
		'M9 2h6a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z',
		'M8 12h8',
		'M8 16h5'
	],
	checklist: [
		'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2',
		'M9 2h6a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z',
		'M9 13l2 2 4-4'
	],
	planificacion: [
		'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
		'M14 2v6h6',
		'M16 13H8',
		'M16 17H8'
	],
	padron: [
		'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
		'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
		'M23 21v-2a4 4 0 0 0-3-3.87',
		'M16 3.13a4 4 0 0 1 0 7.75'
	],
	resultado: ['M3 3v18h18', 'M7 15l4-4 3 3 5-6'],
	qr: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h3v3h-3z', 'M18 18h3v3h-3z'],

	// Roles
	observador: ['M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
	operador: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
	asistente: [
		'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
		'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
		'M19 8v6',
		'M22 11h-6'
	],
	facilitador: ['M2 3h20v12H2z', 'M12 15v6', 'M8 21h8'],
	dni: [
		'M2 4h20a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z',
		'M8 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
		'M5 17c.6-1.8 1.7-2.5 3-2.5s2.4.7 3 2.5',
		'M15 9h4',
		'M15 13h4'
	],

	// Acciones
	enviar: ['M22 2L11 13', 'M22 2l-7 20-4-9-9-4 20-7z'],
	mas: ['M12 5v14', 'M5 12h14'],
	editar: [
		'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
		'M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'
	],
	quitar: [
		'M3 6h18',
		'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
		'M10 11v6',
		'M14 11v6'
	],
	subir: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M17 8l-5-5-5 5', 'M12 3v12'],
	descargar: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],
	cerrar: ['M18 6L6 18', 'M6 6l12 12'],
	menu: ['M3 12h18', 'M3 6h18', 'M3 18h18'],
	buscar: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.35-4.35']
};

export type NombreDeIcono = keyof typeof iconos;
