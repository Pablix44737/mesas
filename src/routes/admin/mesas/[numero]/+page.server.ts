import { error } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const numero = Number(params.numero);
	if (!Number.isInteger(numero) || numero <= 0) error(404, 'Mesa inexistente');

	const { data: mesa, error: fallo } = await supabase
		.from('mesas')
		.select('id, numero, creada_en, escenario:escenarios(id, nombre)')
		.eq('numero', numero)
		.maybeSingle();

	if (fallo) error(500, fallo.message);
	if (!mesa) error(404, `No existe la mesa ${numero}`);

	const [{ data: corridas }, { data: evaluaciones }] = await Promise.all([
		supabase
			.from('corridas')
			.select(
				`id, numero, habilitada, creada_en,
				 participaciones(
					id, dni, rol_codigo,
					rol:roles(nombre, orden),
					participante:participantes(nombre, apellido)
				 )`
			)
			.eq('mesa_id', mesa.id)
			.order('numero', { ascending: false }),
		supabase
			.from('evaluaciones_enviadas')
			.select('corrida_id, participacion_id')
			.eq('mesa_id', mesa.id)
	]);

	const evaluadas = new Set((evaluaciones ?? []).map((e) => e.participacion_id));
	const porCorrida = new Map<string, number>();
	for (const evaluacion of evaluaciones ?? []) {
		if (evaluacion.corrida_id) {
			porCorrida.set(evaluacion.corrida_id, (porCorrida.get(evaluacion.corrida_id) ?? 0) + 1);
		}
	}

	return {
		mesa: { numero: mesa.numero, creada_en: mesa.creada_en },
		escenario: mesa.escenario,
		corridas: (corridas ?? []).map((corrida) => ({
			id: corrida.id,
			numero: corrida.numero,
			habilitada: corrida.habilitada,
			creada_en: corrida.creada_en,
			evaluaciones: porCorrida.get(corrida.id) ?? 0,
			// Quiénes ocuparon cada rol, en el orden en que el modelo los enumera.
			participaciones: corrida.participaciones
				.map((p) => ({
					id: p.id,
					dni: p.dni,
					rolCodigo: p.rol_codigo,
					rolNombre: p.rol?.nombre ?? p.rol_codigo,
					orden: p.rol?.orden ?? 99,
					nombre: p.participante
						? `${p.participante.nombre} ${p.participante.apellido}`
						: null,
					evaluo: evaluadas.has(p.id)
				}))
				.sort((a, b) => a.orden - b.orden || (a.nombre ?? a.dni).localeCompare(b.nombre ?? b.dni))
		}))
	};
};
