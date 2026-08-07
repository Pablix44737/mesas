import { supabase } from './supabase';

export type ChecklistPendiente = {
	participacionId: string;
	corridaNumero: number;
	corridaHabilitada: boolean;
	rol: string;
	checklist: string;
	marcados: number;
	items: number;
};

/**
 * Checklists que este DNI dejó abiertos y sin enviar en la mesa.
 *
 * Cuando el líder habilita la corrida siguiente, el QR lleva al formulario de la
 * nueva y el checklist a medias queda fuera de vista aunque siga siendo enviable.
 * Con esto se lo podemos ofrecer de vuelta en lugar de perderlo.
 */
export async function checklistsSinEnviarDe(
	mesaId: string,
	dni: string,
	exceptoCorridaId?: string
): Promise<ChecklistPendiente[]> {
	const { data } = await supabase
		.from('checklists_sin_enviar')
		.select('*')
		.eq('mesa_id', mesaId)
		.eq('dni', dni)
		.order('corrida_numero', { ascending: false });

	return (data ?? [])
		.filter((p) => p.corrida_id !== exceptoCorridaId)
		.map((p) => ({
			participacionId: p.participacion_id ?? '',
			corridaNumero: p.corrida_numero ?? 0,
			corridaHabilitada: p.corrida_habilitada ?? false,
			rol: p.rol_nombre ?? '',
			checklist: p.checklist ?? '',
			marcados: p.marcados ?? 0,
			items: p.items ?? 0
		}));
}

export type EvaluacionCompletada = {
	instanciaId: string;
	observador: string | null;
	dni: string;
	rol: string;
	checklist: string;
	ponderado: boolean;
	enviadaEn: string | null;
	resultado: number;
	maximo: number;
	porcentaje: number;
	itemsCumplidos: number;
	items: { id: string; orden: number; texto: string; peso: number; cumplido: boolean }[];
};

/**
 * Las evaluaciones que los observadores de una corrida enviaron, cada una con su
 * checklist tal como quedó: todos los ítems de la plantilla, marcados o no.
 *
 * Lo usan la consulta del administrador y la de quien practicó la técnica; el
 * resultado sale de la vista, que lo calcula contra los pesos vigentes.
 */
export async function evaluacionesDeLaCorrida(corridaId: string): Promise<EvaluacionCompletada[]> {
	const { data: evaluaciones } = await supabase
		.from('evaluaciones_enviadas')
		.select('*')
		.eq('corrida_id', corridaId)
		.order('rol_orden')
		.order('observador_nombre');

	const enviadas = evaluaciones ?? [];
	if (enviadas.length === 0) return [];

	const instancias = enviadas.map((e) => e.instancia_id).filter((id) => id !== null);
	const plantillas = [...new Set(enviadas.map((e) => e.plantilla_id).filter((id) => id !== null))];

	const [{ data: items }, { data: respuestas }] = await Promise.all([
		supabase
			.from('checklist_items')
			.select('id, plantilla_id, orden, texto, peso')
			.in('plantilla_id', plantillas)
			.order('orden'),
		supabase
			.from('checklist_respuestas')
			.select('instancia_id, item_id, cumplido')
			.in('instancia_id', instancias)
	]);

	const marcados = new Set(
		(respuestas ?? []).filter((r) => r.cumplido).map((r) => `${r.instancia_id}:${r.item_id}`)
	);

	return enviadas.map((evaluacion) => {
		const maximo = Number(evaluacion.maximo ?? 0);
		const resultado = Number(evaluacion.resultado ?? 0);
		return {
			instanciaId: evaluacion.instancia_id ?? '',
			observador: evaluacion.observador_nombre,
			dni: evaluacion.observador_dni ?? '',
			rol: evaluacion.rol_nombre ?? '',
			checklist: evaluacion.checklist ?? '',
			ponderado: evaluacion.ponderado ?? false,
			enviadaEn: evaluacion.enviada_en,
			resultado,
			maximo,
			porcentaje: maximo > 0 ? Math.round((resultado / maximo) * 100) : 0,
			itemsCumplidos: evaluacion.items_cumplidos ?? 0,
			items: (items ?? [])
				.filter((i) => i.plantilla_id === evaluacion.plantilla_id)
				.map((i) => ({
					id: i.id,
					orden: i.orden,
					texto: i.texto,
					peso: Number(i.peso),
					cumplido: marcados.has(`${evaluacion.instancia_id}:${i.id}`)
				}))
		};
	});
}
