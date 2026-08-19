import { error, fail } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import { checklistsSinEnviarDe } from '$lib/server/evaluaciones';
import type { ResultadoDeEvaluacion } from '$lib/tipos';
import type { Actions, PageServerLoad } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Todas las acciones devuelven la misma forma, así la página lee `mensaje` sin más. */
const rechazar = (estado: number, mensaje: string) => fail(estado, { mensaje });

async function traerParticipacion(participacionId: string, numeroMesa: string) {
	if (!UUID.test(participacionId)) error(404, 'Ese registro no existe');

	const { data: participacion, error: fallo } = await supabase
		.from('participaciones')
		.select(
			`id, dni, rol_codigo,
			 rol:roles(codigo, nombre, observador),
			 participante:participantes(nombre, apellido),
			 corrida:corridas(
				id, numero, habilitada,
				mesa:mesas(
					id, numero,
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

	const mesa = participacion.corrida?.mesa;
	if (mesa?.numero !== Number(numeroMesa)) error(404, 'Ese registro no es de esta mesa');

	return { participacion, mesa };
}

/**
 * El checklist de la operación es común; el de la técnica sale del escenario y lo
 * comparten su observador y el facilitador. Espeja a
 * `plantilla_de_la_participacion()` en la base, que es la que manda: si las dos se
 * separaran, la pantalla mostraría un checklist que la función no dejaría abrir.
 */
async function plantillaDe(participacion: {
	rol_codigo: string;
	corrida: { mesa: { escenario: { checklist_tecnica: unknown } | null } | null } | null;
}) {
	if (participacion.rol_codigo === 'observador_operacion') {
		const { data } = await supabase
			.from('checklist_plantillas')
			.select('id, nombre, ponderado')
			.eq('rol_codigo', 'observador_operacion')
			.eq('estado', 'disponible')
			.maybeSingle();
		return data;
	}
	if (['observador_tecnica', 'facilitador'].includes(participacion.rol_codigo)) {
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
		params.numero
	);

	const plantilla = await plantillaDe(participacion);

	const [{ data: instancia }, { data: items }] = await Promise.all([
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
			: Promise.resolve({ data: null })
	]);

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
	const pendientes = await checklistsSinEnviarDe(
		mesa.id,
		participacion.dni,
		participacion.corrida?.id
	);

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
		escenario: mesa.escenario,
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
		const { participacion } = await traerParticipacion(params.participacionId, params.numero);

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
		const { participacion } = await traerParticipacion(params.participacionId, params.numero);

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
	}
};
