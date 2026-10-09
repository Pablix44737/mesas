import { error, fail } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import { mesaDelCurso } from '$lib/server/mesas';
import { dniValido, mostrarDni, normalizarDni } from '$lib/dni';
import { checklistComunDe, rolesDelDestinatario } from '$lib/server/roles';
import type { Actions, PageServerLoad } from './$types';

type Resumen = { id: string; nombre: string; ponderado: boolean; items: number; maximo: number };

async function traerMesa(codigoDelCurso: string, numeroCrudo: string) {
	const { curso, mesa: encontrada } = await mesaDelCurso(codigoDelCurso, numeroCrudo);

	const { data: mesa, error: fallo } = await supabase
		.from('mesas')
		.select(
			`id, numero, creada_en, docente_dni,
			 escenario:escenarios(
				id, nombre, planificacion_archivo, planificacion_tamano,
				checklist_tecnica:checklist_plantillas(id, nombre, ponderado)
			 )`
		)
		.eq('id', encontrada.id)
		.maybeSingle();

	if (fallo) error(500, fallo.message);
	if (!mesa) error(404, 'Esa mesa ya no existe');

	return { curso, mesa };
}

export const load: PageServerLoad = async ({ params, url }) => {
	const { curso, mesa } = await traerMesa(params.curso, params.numero);

	// El del observador que mira al facilitador no cuelga del escenario: es común
	// a todas las mesas. Cuál de los dos comunes corresponde lo decide el
	// destinatario del curso: el del facilitador con docentes, el del proceso con
	// alumnos. Se resuelve por el rol que ese curso ofrece, no nombrándolo acá.
	const [operacion, { data: corridas }] = await Promise.all([
		checklistComunDe(curso.destinado_a),
		supabase
			.from('corridas')
			.select('id, numero, habilitada, creada_en')
			.eq('mesa_id', mesa.id)
			.order('numero', { ascending: false })
	]);

	const tecnica = mesa.escenario?.checklist_tecnica ?? null;
	const plantillas = [tecnica, operacion].filter((p) => p !== null);

	const { data: items } = await supabase
		.from('checklist_items')
		.select('plantilla_id, peso')
		.in(
			'plantilla_id',
			plantillas.map((p) => p.id)
		);

	// Cuántos criterios trae cada checklist y contra qué máximo se va a leer su resultado.
	const resumir = (plantilla: (typeof plantillas)[number] | null): Resumen | null => {
		if (!plantilla) return null;
		const suyos = (items ?? []).filter((i) => i.plantilla_id === plantilla.id);
		return {
			id: plantilla.id,
			nombre: plantilla.nombre,
			ponderado: plantilla.ponderado,
			items: suyos.length,
			maximo: suyos.reduce((total, i) => total + Number(i.peso), 0)
		};
	};

	// Quiénes están observando ahora mismo y todavía no enviaron: si el líder
	// avanza, esa observación se les va de la vista.
	const corridaEnCurso = (corridas ?? []).find((c) => c.habilitada) ?? null;
	const { data: sinEnviar } = corridaEnCurso
		? await supabase
				.from('checklists_sin_enviar')
				.select('dni, participante_nombre, rol_nombre, marcados, items')
				.eq('corrida_id', corridaEnCurso.id)
		: { data: null };

	// Quiénes entraron a la mesa y con qué rol. Al líder le sirve para saber, sin
	// andar preguntando, quién ya está y si los observadores enviaron lo suyo.
	const idsDeCorridas = (corridas ?? []).map((c) => c.id);
	const [{ data: participaciones }, roles] = await Promise.all([
		idsDeCorridas.length > 0
			? supabase
					.from('participaciones')
					.select(
						`id, dni, corrida_id, rol_codigo,
						 rol:roles(nombre, orden),
						 participante:participantes(nombre, apellido),
						 checklist_instancias(enviada_en)`
					)
					.in('corrida_id', idsDeCorridas)
			: Promise.resolve({ data: null }),
		// Los de este curso, no los del sistema: en uno de alumnos el observador del
		// facilitador no existe y anunciarlo «sin ocupar» sería pedir lo imposible.
		rolesDelDestinatario(curso.destinado_a)
	]);

	const todasLasParticipaciones = participaciones ?? [];

	const enLaCorridaEnCurso = todasLasParticipaciones
		.filter((p) => p.corrida_id === corridaEnCurso?.id)
		.map((p) => ({
			id: p.id,
			dni: p.dni,
			rolCodigo: p.rol_codigo,
			rolNombre: p.rol?.nombre ?? p.rol_codigo,
			orden: p.rol?.orden ?? 99,
			nombre: p.participante ? `${p.participante.nombre} ${p.participante.apellido}` : null,
			// Sólo los observadores abren checklist; para el resto queda en null.
			envio: p.checklist_instancias?.enviada_en != null
		}))
		.sort(
			(a, b) => a.orden - b.orden || (a.nombre ?? a.dni).localeCompare(b.nombre ?? b.dni)
		);

	const ocupados = new Set(enLaCorridaEnCurso.map((p) => p.rolCodigo));

	/**
	 * El recorrido de la mesa: una fila por persona, una columna por rol, y en cada
	 * celda las corridas en que lo ocupó.
	 *
	 * Es el punto flojo del modelo MESAS. Con cinco personas la rotación cierra en
	 * el papel, pero en cuanto son seis —o cuatro— hay quien repite rol y quien
	 * nunca llega a alguno, y el líder no tenía forma de saber cuál. Hoy sólo ve la
	 * corrida en curso.
	 *
	 * Las columnas son roles y no corridas a propósito: así son siempre las mismas
	 * cuatro o cinco, no importa cuántas corridas lleve la mesa, y la pregunta «qué
	 * le falta» se contesta sin leer nada, porque es el hueco.
	 *
	 * No cuesta ninguna consulta: las participaciones de todas las corridas ya
	 * estaban cargadas para contar cuánta gente pasó por la mesa.
	 */
	const numeroDeCorrida = new Map((corridas ?? []).map((c) => [c.id, c.numero]));

	const porPersona = new Map<
		string,
		{ dni: string; nombre: string | null; porRol: Map<string, number[]> }
	>();

	for (const participacion of todasLasParticipaciones) {
		const numero = numeroDeCorrida.get(participacion.corrida_id);
		if (numero === undefined) continue;

		let persona = porPersona.get(participacion.dni);
		if (!persona) {
			persona = {
				dni: participacion.dni,
				nombre: participacion.participante
					? `${participacion.participante.nombre} ${participacion.participante.apellido}`
					: null,
				porRol: new Map()
			};
			porPersona.set(participacion.dni, persona);
		}

		const suyas = persona.porRol.get(participacion.rol_codigo) ?? [];
		suyas.push(numero);
		persona.porRol.set(participacion.rol_codigo, suyas);
	}

	const recorrido = [...porPersona.values()]
		.map((persona) => ({
			dni: persona.dni,
			nombre: persona.nombre,
			enLaCorridaEnCurso: enLaCorridaEnCurso.some((p) => p.dni === persona.dni),
			corridas: [...persona.porRol.values()].reduce((total, n) => total + n.length, 0),
			porRol: roles.map((rol) => ({
				codigo: rol.codigo,
				numeros: (persona.porRol.get(rol.codigo) ?? []).sort((a, b) => a - b)
			})),
			// El docente de un curso de alumnos no rota: facilita en todas. Decirle que
			// le falta ser observador sería recomendarle algo que no va a hacer.
			conduceLaMesa: curso.destinado_a === 'alumnos' && persona.dni === mesa.docente_dni,
			// Lo que le falta por ocupar: es la recomendación para la corrida que viene.
			faltan: roles.filter((rol) => !persona.porRol.has(rol.codigo)).map((rol) => rol.nombre)
		}))
		.sort((a, b) => (a.nombre ?? a.dni).localeCompare(b.nombre ?? b.dni));

	// Roles que en esta mesa no ocupó nadie, nunca. Pasa más de lo que parece: el
	// asistente se ocupó una sola vez en todo el sistema.
	const nadieLosOcupo = roles
		.filter((rol) => !todasLasParticipaciones.some((p) => p.rol_codigo === rol.codigo))
		.map((rol) => rol.nombre);

	/**
	 * En un curso de alumnos el docente hace dos cosas: conduce la mesa y facilita.
	 * Ningún alumno puede ser facilitador, así que ese rol no sale del QR sino de
	 * acá: se declara una vez por mesa y el sistema le abre su lugar en cada
	 * corrida. La evaluación la completa en la pantalla del facilitador, que ya
	 * existe; desde acá sale el enlace, no una copia del checklist.
	 */
	const conduceElDocente = curso.destinado_a === 'alumnos';

	const { data: docenteEnElPadron } =
		conduceElDocente && mesa.docente_dni
			? await supabase
					.from('participantes')
					.select('nombre, apellido')
					.eq('dni', mesa.docente_dni)
					.maybeSingle()
			: { data: null };

	const suParticipacion = mesa.docente_dni
		? (enLaCorridaEnCurso.find((p) => p.dni === mesa.docente_dni) ?? null)
		: null;

	return {
		curso,
		docente: conduceElDocente
			? {
					dni: mesa.docente_dni,
					nombre: docenteEnElPadron
						? `${docenteEnElPadron.nombre} ${docenteEnElPadron.apellido}`
						: null,
					participacionId: suParticipacion?.id ?? null,
					evaluo: suParticipacion?.envio ?? false
				}
			: null,
		participantes: enLaCorridaEnCurso,
		// Informativo, no una falta: una mesa puede correr sin asistente, por ejemplo.
		rolesLibres: roles.filter((r) => !ocupados.has(r.codigo)).map((r) => r.nombre),
		// Las columnas del recorrido: los roles que ocupa este curso, en su orden.
		rolesDeLaMesa: roles.map((r) => ({ codigo: r.codigo, nombre: r.nombre })),
		recorrido,
		nadieLosOcupo,
		// Personas distintas que pasaron por la mesa, contando todas sus corridas.
		personasEnLaMesa: new Set(todasLasParticipaciones.map((p) => p.dni)).size,
		// Para mostrar junto al QR la dirección que codifica, por si alguien
		// prefiere tipearla en vez de escanear.
		origen: url.origin,
		sinEnviar: (sinEnviar ?? []).map((p) => ({
			quien: p.participante_nombre ?? `DNI ${p.dni}`,
			rol: p.rol_nombre ?? '',
			marcados: p.marcados ?? 0,
			items: p.items ?? 0
		})),
		mesa: { id: mesa.id, numero: mesa.numero, creada_en: mesa.creada_en },
		escenario: mesa.escenario,
		checklistDeTecnica: resumir(tecnica),
		// El común que ocupa este curso, con el nombre del rol que lo completa: en
		// uno de alumnos no es «del facilitador» sino «del observador del proceso».
		checklistComun: operacion
			? { ...resumir(operacion)!, rol: operacion.rolNombre }
			: null,
		corridas: corridas ?? [],
		corridaEnCurso: (corridas ?? []).find((c) => c.habilitada) ?? null
	};
};

export const actions: Actions = {
	/**
	 * Cierra la corrida en curso y abre la siguiente. Las dos cosas pasan dentro
	 * de la función de base, para que la mesa nunca quede sin corrida habilitada.
	 */
	habilitarSiguiente: async ({ params }) => {
		const { curso, mesa } = await traerMesa(params.curso, params.numero);

		const { data: corrida, error: fallo } = await supabase.rpc('habilitar_siguiente_corrida', {
			p_mesa_id: mesa.id
		});

		if (fallo || !corrida) {
			return fail(400, {
				mensaje: 'No se pudo habilitar la corrida. Intentá de nuevo.',
				exito: null
			});
		}

		return {
			mensaje: null,
			exito: `Corrida ${corrida.numero} habilitada. Los participantes ya pueden identificarse.`
		};
	},

	/**
	 * Declarar quién conduce la mesa. El documento queda en la mesa, así que se
	 * pide una vez y no una por corrida: `asignar_docente_a_la_mesa()` le abre su
	 * lugar de facilitador en la corrida en curso, y `habilitar_siguiente_corrida()`
	 * en todas las que vengan.
	 */
	declararDocente: async ({ request, params }) => {
		const { mesa } = await traerMesa(params.curso, params.numero);

		const formulario = await request.formData();
		const dni = normalizarDni(String(formulario.get('dni') ?? ''));

		const rechazar = (estado: number, mensaje: string) => fail(estado, { mensaje, exito: null });

		if (!dniValido(dni)) return rechazar(400, 'Ingresá el documento, sin puntos.');

		const { data, error: fallo } = await supabase.rpc('asignar_docente_a_la_mesa', {
			p_mesa_id: mesa.id,
			p_dni: dni
		});

		if (fallo) {
			if (fallo.message.includes('facilitador lo elige')) {
				return rechazar(
					409,
					'Este curso es de docentes: ahí el facilitador se declara desde el QR como cualquier otro rol.'
				);
			}
			if (fallo.message.includes('ya esta en la corrida')) {
				return rechazar(
					409,
					'Ese documento ya está en la corrida con otro rol. Pedile al administrador que elimine ese registro y volvé a intentarlo.'
				);
			}
			return rechazar(500, 'No se pudo declarar al docente. Intentá de nuevo.');
		}

		const resumen = data as unknown as { nombre: string | null; corrida: number | null };
		const quien = resumen.nombre ?? `El documento ${mostrarDni(dni)}`;

		return {
			mensaje: null,
			exito: resumen.corrida
				? `${quien} conduce esta mesa y ya tiene su lugar de facilitador en la corrida ${resumen.corrida}.`
				: `${quien} conduce esta mesa. Al habilitar la primera corrida se le abre su lugar de facilitador.`
		};
	},

	/**
	 * Sacar al docente declarado. No se tocan las participaciones ya abiertas: lo
	 * que evaluó quedó hecho. Sólo deja de abrírsele lugar en las corridas nuevas.
	 */
	quitarDocente: async ({ params }) => {
		const { mesa } = await traerMesa(params.curso, params.numero);

		const { error: fallo } = await supabase.rpc('quitar_el_docente_de_la_mesa', {
			p_mesa_id: mesa.id
		});

		if (fallo) {
			return fail(500, { mensaje: 'No se pudo sacar al docente. Intentá de nuevo.', exito: null });
		}

		return {
			mensaje: null,
			exito:
				'La mesa quedó sin docente declarado. Lo que haya evaluado sigue registrado; sólo deja de abrírsele lugar en las corridas nuevas.'
		};
	}
};
