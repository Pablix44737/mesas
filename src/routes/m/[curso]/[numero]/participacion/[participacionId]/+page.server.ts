import { error, fail, redirect } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import { checklistsSinEnviarDe } from '$lib/server/evaluaciones';
import { loEligeElParticipante, rolesQueSeEligen } from '$lib/server/roles';
import type { ResultadoDeEvaluacion } from '$lib/tipos';
import type { Actions, PageServerLoad } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Todas las acciones devuelven la misma forma, así la página lee `mensaje` sin más. */
const rechazar = (estado: number, mensaje: string) => fail(estado, { mensaje });

async function traerParticipacion(
	participacionId: string,
	codigoDelCurso: string,
	numeroMesa: string
) {
	if (!UUID.test(participacionId)) error(404, 'Ese registro no existe');

	const { data: participacion, error: fallo } = await supabase
		.from('participaciones')
		.select(
			`id, dni, rol_codigo,
			 rol:roles(codigo, nombre, observador, checklist),
			 participante:participantes(nombre, apellido),
			 corrida:corridas(
				id, numero, habilitada,
				mesa:mesas(
					id, numero, docente_dni,
					curso:cursos(codigo, nombre, destinado_a),
					escenario:escenarios(
						id, nombre, planificacion_archivo, planificacion_tamano,
						checklist_tecnica:checklist_plantillas(id, nombre, ponderado)
					)
				)
			 )`
		)
		.eq('id', participacionId)
		.maybeSingle();

	if (fallo) error(500, fallo.message);
	if (!participacion) error(404, 'Ese registro no existe');

	// Que el registro sea de esta mesa Y de este curso: con la numeración por curso,
	// el número solo ya no alcanza para saber de qué mesa se está hablando.
	const mesa = participacion.corrida?.mesa;
	if (mesa?.numero !== Number(numeroMesa) || mesa?.curso?.codigo !== codigoDelCurso) {
		error(404, 'Ese registro no es de esta mesa');
	}

	return { participacion, mesa };
}

/**
 * Qué lista de cotejo le toca a esta participación, preguntándole al rol en vez
 * de nombrarlo. Espeja a `plantilla_de_la_participacion()` en la base, que es la
 * que manda: si las dos se separaran, la pantalla mostraría un checklist que la
 * función no dejaría abrir. Por eso las dos leen lo mismo, `roles.checklist`.
 */
async function plantillaDe(participacion: {
	rol_codigo: string;
	rol: { checklist: string | null } | null;
	corrida: { mesa: { escenario: { checklist_tecnica: unknown } | null } | null } | null;
}) {
	if (participacion.rol?.checklist === 'comun') {
		const { data } = await supabase
			.from('checklist_plantillas')
			.select('id, nombre, ponderado')
			.eq('rol_codigo', participacion.rol_codigo)
			.eq('estado', 'disponible')
			.maybeSingle();
		return data;
	}
	if (participacion.rol?.checklist === 'del_escenario') {
		return (participacion.corrida?.mesa?.escenario?.checklist_tecnica ?? null) as {
			id: string;
			nombre: string;
			ponderado: boolean;
		} | null;
	}
	return null;
}

export const load: PageServerLoad = async ({ params }) => {
	const { participacion, mesa } = await traerParticipacion(
		params.participacionId,
		params.curso,
		params.numero
	);

	const plantilla = await plantillaDe(participacion);

	const [{ data: instancia }, { data: items }, { data: vigente }] = await Promise.all([
		supabase
			.from('checklist_instancias')
			.select('id, enviada_en')
			.eq('participacion_id', participacion.id)
			.maybeSingle(),
		plantilla
			? supabase
					.from('checklist_items')
					.select('id, orden, texto, peso')
					.eq('plantilla_id', plantilla.id)
					.order('orden')
			: Promise.resolve({ data: null }),
		// La corrida que el líder tiene habilitada ahora, que puede ser más nueva
		// que esta: de ahí sale si desde acá se puede avanzar.
		supabase
			.from('corridas')
			.select('id, numero')
			.eq('mesa_id', mesa.id)
			.eq('habilitada', true)
			.maybeSingle()
	]);

	const siguiente = vigente && vigente.id !== participacion.corrida?.id ? vigente : null;

	/**
	 * Esta participación es la del docente que conduce la mesa, no la de alguien
	 * que escaneó el QR. Cambia dos cosas: a dónde vuelve —a su pantalla de líder,
	 * no al formulario de DNI, donde no tendría nada que hacer— y que no se le
	 * ofrezca elegir rol para la corrida siguiente, porque el suyo se le abre solo.
	 */
	const conduceLaMesa =
		mesa.curso?.destinado_a === 'alumnos' && mesa.docente_dni === participacion.dni;

	// El resultado sale de la vista, que lo calcula contra los pesos vigentes.
	const [{ data: respuestas }, { data: calculado }] = instancia
		? await Promise.all([
				supabase
					.from('checklist_respuestas')
					.select('item_id, cumplido')
					.eq('instancia_id', instancia.id),
				supabase
					.from('resultados_de_evaluacion')
					.select('resultado, maximo, items_cumplidos, items')
					.eq('instancia_id', instancia.id)
					.maybeSingle()
			])
		: [{ data: null }, { data: null }];

	const marcados = new Map((respuestas ?? []).map((r) => [r.item_id, r.cumplido]));

	// Lo que dejó a medias en otra corrida de esta mesa: desde acá siempre vuelve.
	// Y, si hay una corrida más nueva, con qué roles puede entrar a ella —o, si ya
	// se declaró, cuál es su lugar ahí, para llevarlo en vez de pedirle un rol.
	const [pendientes, { data: yaDeclarado }, roles] = await Promise.all([
		checklistsSinEnviarDe(mesa.id, participacion.dni, participacion.corrida?.id),
		siguiente
			? supabase
					.from('participaciones')
					.select('id')
					.eq('corrida_id', siguiente.id)
					.eq('dni', participacion.dni)
					.maybeSingle()
			: Promise.resolve({ data: null }),
		siguiente && !conduceLaMesa
			? rolesQueSeEligen(mesa.curso?.destinado_a ?? '')
			: Promise.resolve([])
	]);

	const maximo = Number(calculado?.maximo ?? 0);
	const resultado: ResultadoDeEvaluacion | null = calculado
		? {
				resultado: Number(calculado.resultado ?? 0),
				maximo,
				itemsCumplidos: calculado.items_cumplidos ?? 0,
				items: calculado.items ?? 0,
				porcentaje: maximo > 0 ? Math.round((Number(calculado.resultado ?? 0) / maximo) * 100) : 0
			}
		: null;

	return {
		participacion: {
			id: participacion.id,
			dni: participacion.dni,
			rolCodigo: participacion.rol_codigo,
			rolNombre: participacion.rol?.nombre ?? participacion.rol_codigo,
			// De dónde sale su lista de cotejo, o null si su rol no evalúa.
			checklistOrigen: (participacion.rol?.checklist ?? null) as 'comun' | 'del_escenario' | null,
			// null cuando el DNI no está en el padrón: el registro vale igual y
			// queda pendiente de que el administrador lo complete.
			nombre: participacion.participante
				? `${participacion.participante.nombre} ${participacion.participante.apellido}`
				: null
		},
		corrida: {
			numero: participacion.corrida?.numero ?? 0,
			habilitada: participacion.corrida?.habilitada ?? false
		},
		mesa: { numero: mesa.numero },
		curso: mesa.curso,
		conduceLaMesa,
		// Adónde lleva la flecha de la barra: quien escaneó vuelve a la mesa; el
		// docente, a la pantalla desde la que la conduce.
		volverA: conduceLaMesa
			? `/mesas/${mesa.curso?.codigo}/${mesa.numero}`
			: `/m/${mesa.curso?.codigo}/${mesa.numero}`,
		escenario: mesa.escenario,
		siguienteCorrida: siguiente
			? {
					numero: siguiente.numero,
					// Su participación en esa corrida, si ya la tenía.
					participacionId: yaDeclarado?.id ?? null
				}
			: null,
		roles,
		pendientes,
		enviadaEn: instancia?.enviada_en ?? null,
		resultado,
		checklist: plantilla
			? {
					...plantilla,
					items: (items ?? []).map((i) => ({
						id: i.id,
						orden: i.orden,
						texto: i.texto,
						peso: Number(i.peso),
						cumplido: marcados.get(i.id) ?? false
					})),
					maximo: (items ?? []).reduce((total, i) => total + Number(i.peso), 0)
				}
			: null
	};
};

/**
 * Abre la instancia si todavía no existe. La función de base es idempotente y
 * elige ella misma el checklist que corresponde al rol, así que el observador
 * puede entrar y salir sin que se le abra uno nuevo.
 */
async function abrirInstancia(participacionId: string) {
	const { data, error: fallo } = await supabase.rpc('abrir_instancia_de_checklist', {
		p_participacion_id: participacionId
	});
	return fallo ? null : data;
}

export const actions: Actions = {
	/** El observador marca un ítem cuando ocurre en el escenario lo que describe. */
	marcar: async ({ request, params }) => {
		const { participacion } = await traerParticipacion(params.participacionId, params.curso, params.numero);

		const instancia = await abrirInstancia(participacion.id);
		if (!instancia) return rechazar(409, 'Tu rol no lleva checklist en esta mesa.');
		if (instancia.enviada_en) {
			return rechazar(409, 'El checklist ya fue enviado y no admite cambios.');
		}

		const formulario = await request.formData();
		const itemId = String(formulario.get('itemId') ?? '');
		const cumplido = formulario.get('cumplido') === 'true';

		if (!UUID.test(itemId)) return rechazar(400, 'Ítem inválido.');

		const { error: fallo } = await supabase.from('checklist_respuestas').upsert(
			{
				instancia_id: instancia.id,
				item_id: itemId,
				cumplido,
				marcada_en: new Date().toISOString()
			},
			{ onConflict: 'instancia_id,item_id' }
		);

		if (fallo) return rechazar(400, 'No se pudo registrar la marca. Probá de nuevo.');

		return { mensaje: null };
	},

	/** El envío cierra la evaluación. */
	enviar: async ({ params }) => {
		const { participacion } = await traerParticipacion(params.participacionId, params.curso, params.numero);

		const instancia = await abrirInstancia(participacion.id);
		if (!instancia) return rechazar(409, 'Tu rol no lleva checklist en esta mesa.');
		if (instancia.enviada_en) return rechazar(409, 'Este checklist ya había sido enviado.');

		const { error: fallo } = await supabase
			.from('checklist_instancias')
			.update({ enviada_en: new Date().toISOString() })
			.eq('id', instancia.id)
			.is('enviada_en', null);

		if (fallo) return rechazar(400, 'No se pudo enviar el checklist. Probá de nuevo.');

		return { mensaje: null };
	},

	/**
	 * Entrar a la corrida que el líder tenga habilitada ahora, sin pasar otra vez
	 * por el QR y el DNI.
	 *
	 * El DNI sale de esta participación y no del formulario: desde acá se avanza
	 * uno mismo, no se declara a otro. Lo único que viaja es el rol, porque en la
	 * corrida nueva suele ser otro —de eso se trata rotar.
	 *
	 * Avanzar con el checklist de esta corrida a medias no lo pierde: queda sin
	 * enviar y la pantalla de la corrida nueva lo ofrece de vuelta, como cuando se
	 * vuelve a escanear el QR.
	 */
	avanzar: async ({ request, params }) => {
		const { participacion, mesa } = await traerParticipacion(
			params.participacionId,
			params.curso,
			params.numero
		);

		const formulario = await request.formData();
		const rolCodigo = String(formulario.get('rolCodigo') ?? '');

		if (!rolCodigo) return rechazar(400, 'Elegí el rol que vas a ocupar en la corrida nueva.');

		// Que el rol sea uno de los que ocupa este curso, no sólo que exista: el
		// facilitador de un curso de alumnos es el docente y no se elige desde acá.
		const [elegible, { data: vigente }] = await Promise.all([
			loEligeElParticipante(mesa.curso?.destinado_a ?? '', rolCodigo),
			supabase
				.from('corridas')
				.select('id, numero')
				.eq('mesa_id', mesa.id)
				.eq('habilitada', true)
				.maybeSingle()
		]);

		if (!elegible) return rechazar(400, 'Ese rol no se ocupa en este curso.');
		if (!vigente) return rechazar(409, 'La mesa no tiene ninguna corrida habilitada.');

		// Pudo haber quedado abierta esta pantalla desde antes de que el líder
		// habilitara la corrida siguiente —o sin que la habilitara nunca.
		if (vigente.id === participacion.corrida?.id) {
			return rechazar(
				409,
				`El líder todavía no habilitó la corrida siguiente: la ${vigente.numero} sigue siendo la abierta.`
			);
		}

		// Pudo declararse desde otra pantalla mientras esta esperaba.
		const { data: existente } = await supabase
			.from('participaciones')
			.select('id')
			.eq('corrida_id', vigente.id)
			.eq('dni', participacion.dni)
			.maybeSingle();

		if (existente) {
			redirect(303, `/m/${params.curso}/${params.numero}/participacion/${existente.id}`);
		}

		const { data: nueva, error: fallo } = await supabase
			.from('participaciones')
			.insert({ corrida_id: vigente.id, dni: participacion.dni, rol_codigo: rolCodigo })
			.select('id')
			.single();

		if (fallo || !nueva) {
			return rechazar(400, 'No se pudo registrarte en la corrida nueva. Intentá de nuevo.');
		}

		redirect(303, `/m/${params.curso}/${params.numero}/participacion/${nueva.id}`);
	}
};
