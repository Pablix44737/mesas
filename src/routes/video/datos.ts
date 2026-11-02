/**
 * Datos inventados para el video de los líderes de mesa. Tienen la misma forma
 * que lo que devuelven los `load` de cada pantalla, así las pantallas reales se
 * dibujan tal cual, sin base de datos.
 */

const curso = {
	id: 'curso-video',
	codigo: 'mesas-manana',
	nombre: 'Curso MESAS - Turno Mañana',
	archivado: false,
	destinado_a: 'docentes',
	tenant_id: 'video'
};

const escenario = {
	id: 'escenario-video',
	nombre: 'Colocación de catéter urinario masculino',
	planificacion_archivo: 'Planificación catéter urinario.pdf',
	planificacion_tamano: 812_000
};

const roles = [
	{ codigo: 'observador_operacion', nombre: 'Observador del facilitador' },
	{ codigo: 'observador_tecnica', nombre: 'Observador de la técnica' },
	{ codigo: 'facilitador', nombre: 'Facilitador' },
	{ codigo: 'operador', nombre: 'Operador' },
	{ codigo: 'asistente', nombre: 'Asistente' }
];

const personas = [
	{ dni: '28111222', nombre: 'Laura', apellido: 'Benítez' },
	{ dni: '30222333', nombre: 'Martín', apellido: 'Sosa' },
	{ dni: '27333444', nombre: 'Carla', apellido: 'Duarte' },
	{ dni: '31444555', nombre: 'Diego', apellido: 'Ferreyra' },
	{ dni: '29555666', nombre: 'Ana', apellido: 'Gómez' }
];

/** Quién ocupa cada rol en cada ciclo: en el segundo, todos rotan un lugar. */
const ocupacion = (ciclo: number) =>
	roles.map((rol, i) => ({ rol, persona: personas[(i + ciclo - 1) % personas.length] }));

const evaluan = new Set(['observador_operacion', 'observador_tecnica', 'facilitador']);

const hoy = (hora: string) => `2026-11-14T${hora}:00-03:00`;

type Corrida = { id: string; numero: number; habilitada: boolean; creada_en: string };

/**
 * La pantalla de la mesa en un momento dado.
 * - `ciclos`: los ciclos habilitados hasta ahora; el último está en curso salvo con la mesa cerrada.
 * - `entraron`: cuántos roles del ciclo en curso ya se ocuparon, en orden.
 * - `enviaron`: cuántos de los que evalúan ya enviaron su lista.
 */
export function mesa({
	ciclos = 0,
	entraron = 0,
	enviaron = 0,
	cerrada = false,
	aviso = null as string | null
}) {
	const corridas: Corrida[] = Array.from({ length: ciclos }, (_, i) => ({
		id: `corrida-${i + 1}`,
		numero: i + 1,
		habilitada: !cerrada && i === ciclos - 1,
		creada_en: hoy(['09:10', '09:40', '10:10'][i] ?? '10:40')
	})).reverse();
	const enCurso = corridas.find((c) => c.habilitada) ?? null;

	// Participaciones de todos los ciclos: los anteriores completos, el actual hasta `entraron`.
	const participaciones = corridas.flatMap((corrida) => {
		const filas = ocupacion(corrida.numero);
		const hasta = corrida.habilitada ? entraron : filas.length;
		let enviadas = 0;
		return filas.slice(0, hasta).map(({ rol, persona }) => {
			const abre = evaluan.has(rol.codigo);
			const envio = abre && (!corrida.habilitada || enviadas++ < enviaron);
			return { corrida, rol, persona, abre, envio };
		});
	});

	const participantes = participaciones
		.filter((p) => p.corrida.habilitada)
		.map((p, i) => ({
			id: `p-${p.corrida.numero}-${p.rol.codigo}`,
			dni: p.persona.dni,
			rolCodigo: p.rol.codigo,
			rolNombre: p.rol.nombre,
			orden: i,
			nombre: `${p.persona.nombre} ${p.persona.apellido}`,
			envio: p.envio
		}));

	const recorrido = personas
		.filter((persona) => participaciones.some((p) => p.persona.dni === persona.dni))
		.map((persona) => {
			const suyas = participaciones.filter((p) => p.persona.dni === persona.dni);
			return {
				dni: persona.dni,
				nombre: `${persona.nombre} ${persona.apellido}`,
				corto: `${persona.nombre} ${persona.apellido.charAt(0)}.`,
				enLaCorridaEnCurso: suyas.some((p) => p.corrida.habilitada),
				corridas: suyas.length,
				porRol: roles.map((rol) => ({
					codigo: rol.codigo,
					numeros: suyas.filter((p) => p.rol.codigo === rol.codigo).map((p) => p.corrida.numero)
				})),
				conduceLaMesa: false,
				faltan: roles
					.filter((rol) => !suyas.some((p) => p.rol.codigo === rol.codigo))
					.map((rol) => rol.nombre)
			};
		});

	return {
		data: {
			curso,
			docente: null,
			participantes,
			rolesDeLaMesa: roles,
			recorrido,
			nadieLosOcupo: [],
			origen: 'https://simunam.com',
			sinEnviar: [],
			mesa: { id: 'mesa-video', numero: 3, creada_en: hoy('08:50') },
			escenario,
			checklistDeTecnica: { id: 't', nombre: escenario.nombre, ponderado: false, items: 10, maximo: 10 },
			checklistComun: {
				id: 'c',
				nombre: 'Observadores del Facilitador',
				ponderado: false,
				items: 10,
				maximo: 10,
				rol: 'Observador del facilitador'
			},
			corridas: corridas.map((corrida) => {
				const suyas = participaciones.filter((p) => p.corrida.id === corrida.id && p.abre);
				return {
					...corrida,
					evaluaciones: suyas.length,
					enviadas: suyas.filter((p) => p.envio).length
				};
			}),
			corridaEnCurso: enCurso
		},
		form: aviso ? { mensaje: null, exito: aviso } : null
	};
}

/** «Mis mesas», con la mesa 3 del video entre otras del mismo curso. */
export function misMesas() {
	const mesas = [
		{ numero: 1, escenario: 'Sutura simple de plano cutáneo.', corridaEnCurso: null, corridas: 0 },
		{ numero: 2, escenario: 'Reanimación Cardiopulmonar a lactantes', corridaEnCurso: null, corridas: 0 },
		{ numero: 3, escenario: escenario.nombre, corridaEnCurso: null, corridas: 0 },
		{ numero: 4, escenario: 'Sutura simple de plano cutáneo.', corridaEnCurso: null, corridas: 0 }
	].map((m) => ({
		id: `mesa-${m.numero}`,
		numero: m.numero,
		escenario: { id: `e-${m.numero}`, nombre: m.escenario },
		curso: { id: curso.id, codigo: curso.codigo, nombre: curso.nombre },
		corridaEnCurso: m.corridaEnCurso,
		corridas: m.corridas
	}));
	return {
		data: {
			carpetas: [{ id: curso.id, nombre: curso.nombre, mesas }],
			escenarios: [{ id: escenario.id, nombre: escenario.nombre }],
			cursos: [{ id: curso.id, nombre: curso.nombre }]
		},
		form: null
	};
}

const itemsDeTecnica = [
	'Verifica los elementos necesarios (bandeja, lubricante, jeringa de 10cc, catéter urinario n°16/18, cinta, guantes estériles, gasas, bolsa colectora, campo estéril)',
	'Realiza higiene de manos antiséptica con solución hidroalcohólica.',
	'Coloca guantes estériles.',
	'Extiende y coloca el campo estéril fenestrado sobre la zona perineal.',
	'Lubrica la punta del catéter urinario con lubricante.',
	'Realiza asepsia perineal en forma circular utilizando la pinza estéril.',
	'Inserta el catéter urinario con la mano dominante, en dirección ligeramente hacia arriba y atrás (5–9 cm aprox).',
	'Conecta el catéter urinario a una bolsa colectora estéril de sistema cerrado.',
	'Insufla el balón con jeringa de 10cc con agua estéril. (de 5 a 10cc según Fr del catéter urinario).',
	'Fija el catéter urinario al muslo con cinta.'
];

const itemsDelFacilitador = [
	'Realiza una introducción del escenario - briefing.',
	'El facilitador indica al operador la organización del espacio físico, insumos y equipamiento para el procedimiento.',
	'El facilitador realiza el pacto de ficción.',
	'El facilitador acompaña el aprendizaje del operador mediante feedback en tiempo real.',
	'El facilitador acompaña el aprendizaje del operador mediante feedback diferido post actividad',
	'Se genera un diálogo reflexivo y constructivo durante o al finalizar la actividad.',
	'Se realiza un feedback según el modelo sándwich resaltando aspectos positivos, áreas de mejora y cierre positivo.',
	'El operador reconoce las fortalezas identificadas.',
	'El operador reconoce las oportunidades de mejora identificadas.',
	'El operador identifica acciones concretas para mejorar su desempeño.'
];

/** Lo evaluado en el ciclo 1: las tres listas que se enviaron. */
export function ciclo() {
	const evaluacion = (
		rolCodigo: string,
		checklist: string,
		textos: string[],
		noHizo: number[],
		hora: string
	) => {
		const { rol, persona } = ocupacion(1).find((o) => o.rol.codigo === rolCodigo)!;
		const items = textos.map((texto, i) => ({
			id: `${rolCodigo}-${i}`,
			texto,
			cumplido: !noHizo.includes(i + 1)
		}));
		const resultado = items.filter((i) => i.cumplido).length;
		return {
			instanciaId: `i-${rolCodigo}`,
			participacionId: `p-1-${rolCodigo}`,
			observador: `${persona.nombre} ${persona.apellido}`,
			dni: persona.dni,
			rol: rol.nombre,
			conduceLaMesa: false,
			enviadaEn: hoy(hora),
			porcentaje: Math.round((resultado / items.length) * 100),
			resultado,
			maximo: items.length,
			checklist,
			ponderado: false,
			itemsCumplidos: resultado,
			items
		};
	};

	return {
		data: {
			curso,
			mesa: { numero: 3, escenario: escenario.nombre },
			corrida: { numero: 1, habilitada: false },
			corridas: [
				{ numero: 1, habilitada: false },
				{ numero: 2, habilitada: true }
			],
			evaluaciones: [
				evaluacion('observador_tecnica', escenario.nombre, itemsDeTecnica, [4, 9], '09:31'),
				evaluacion('facilitador', escenario.nombre, itemsDeTecnica, [9], '09:33'),
				evaluacion('observador_operacion', 'Observadores del Facilitador', itemsDelFacilitador, [7], '09:34')
			]
		},
		form: null
	};
}

/** Los roles que elige quien escanea el QR, con lo que hace falta para las tarjetas. */
const rolesQueSeEligen = [
	{ codigo: 'observador_operacion', nombre: 'Observador del facilitador', observador: true, orden: 1 },
	{ codigo: 'observador_tecnica', nombre: 'Observador de la técnica', observador: true, orden: 3 },
	{ codigo: 'facilitador', nombre: 'Facilitador', observador: false, orden: 4 },
	{ codigo: 'operador', nombre: 'Operador', observador: false, orden: 5 },
	{ codigo: 'asistente', nombre: 'Asistente', observador: false, orden: 6 }
];

/** La mesa 3 vista por quien escanea el QR, con el ciclo 1 abierto. */
export function sumarse() {
	return {
		data: {
			curso,
			mesa: { id: 'mesa-video', numero: 3, escenario: { nombre: escenario.nombre } },
			corrida: { id: 'corrida-1', numero: 1 },
			cerrada: false,
			volvesAElegir: false,
			roles: rolesQueSeEligen
		},
		form: null
	};
}

/**
 * La pantalla de Martín Sosa, el participante del video.
 * - En el ciclo 1 observa la técnica: `marcados` es cuántos ítems lleva marcados.
 * - `siguiente`: el líder ya habilitó el ciclo 2 y todavía no eligió rol ahí.
 * - En el ciclo 2 es operador: practica la técnica y no completa nada.
 */
export function cotejo({ ciclo = 1, marcados = 0, enviada = false, siguiente = false }) {
	const persona = personas[1];
	const operador = ciclo === 2;
	const rol = rolesQueSeEligen.find((r) => r.codigo === (operador ? 'operador' : 'observador_tecnica'))!;
	const noHizo = [4, 9];
	const items = itemsDeTecnica.map((texto, i) => ({
		id: `t-${i + 1}`,
		orden: i + 1,
		texto,
		peso: 1,
		hizo: i < marcados ? !noHizo.includes(i + 1) : null
	}));
	const hechos = items.filter((i) => i.hizo === true).length;
	return {
		data: {
			participacion: {
				id: `p-${ciclo}-${rol.codigo}`,
				dni: persona.dni,
				rolCodigo: rol.codigo,
				rolNombre: rol.nombre,
				checklistOrigen: operador ? null : 'del_escenario',
				nombre: `${persona.nombre} ${persona.apellido}`
			},
			corrida: { numero: ciclo, habilitada: !siguiente },
			mesa: { numero: 3 },
			curso: { codigo: curso.codigo, nombre: curso.nombre, destinado_a: curso.destinado_a },
			conduceLaMesa: false,
			volverA: `/m/${curso.codigo}/3`,
			escenario,
			siguienteCorrida: siguiente ? { numero: ciclo + 1, participacionId: null } : null,
			mesaCerrada: false,
			roles: rolesQueSeEligen,
			pendientes: [],
			enviadaEn: enviada ? hoy('09:31') : null,
			resultado: enviada
				? { resultado: hechos, maximo: items.length, itemsCumplidos: hechos, items: items.length, porcentaje: Math.round((hechos / items.length) * 100) }
				: null,
			checklist: operador
				? null
				: { id: 't', nombre: escenario.nombre, ponderado: false, items, maximo: items.length }
		},
		form: null
	};
}
