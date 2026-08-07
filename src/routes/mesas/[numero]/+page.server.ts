import { error, fail } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import type { Actions, PageServerLoad } from './$types';

type Resumen = { id: string; nombre: string; ponderado: boolean; items: number; maximo: number };

async function traerMesa(numeroCrudo: string) {
	const numero = Number(numeroCrudo);
	if (!Number.isInteger(numero) || numero <= 0) error(404, 'Mesa inexistente');

	const { data: mesa, error: fallo } = await supabase
		.from('mesas')
		.select(
			`id, numero, creada_en,
			 escenario:escenarios(
				id, nombre, planificacion_archivo, planificacion_tamano,
				checklist_tecnica:checklist_plantillas(id, nombre, ponderado)
			 )`
		)
		.eq('numero', numero)
		.maybeSingle();

	if (fallo) error(500, fallo.message);
	if (!mesa) error(404, `No existe la mesa ${numero}`);

	return mesa;
}

export const load: PageServerLoad = async ({ params }) => {
	const mesa = await traerMesa(params.numero);

	// El de la operación no cuelga del escenario: es común a todas las mesas.
	const [{ data: operacion }, { data: corridas }] = await Promise.all([
		supabase
			.from('checklist_plantillas')
			.select('id, nombre, ponderado')
			.eq('rol_codigo', 'observador_operacion')
			.eq('estado', 'disponible')
			.maybeSingle(),
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

	return {
		sinEnviar: (sinEnviar ?? []).map((p) => ({
			quien: p.participante_nombre ?? `DNI ${p.dni}`,
			rol: p.rol_nombre ?? '',
			marcados: p.marcados ?? 0,
			items: p.items ?? 0
		})),
		mesa: { id: mesa.id, numero: mesa.numero, creada_en: mesa.creada_en },
		escenario: mesa.escenario,
		checklistDeTecnica: resumir(tecnica),
		checklistDeOperacion: resumir(operacion),
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
		const mesa = await traerMesa(params.numero);

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
	}
};
