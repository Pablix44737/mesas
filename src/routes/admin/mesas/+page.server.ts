import { error } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [{ data: mesas, error: fallo }, { data: evaluaciones }] = await Promise.all([
		supabase
			.from('mesas')
			.select('id, numero, escenario:escenarios(nombre), corridas(numero, habilitada)')
			.order('numero'),
		supabase.from('evaluaciones_enviadas').select('mesa_id')
	]);

	if (fallo) error(500, fallo.message);

	const porMesa = new Map<string, number>();
	for (const evaluacion of evaluaciones ?? []) {
		if (evaluacion.mesa_id) {
			porMesa.set(evaluacion.mesa_id, (porMesa.get(evaluacion.mesa_id) ?? 0) + 1);
		}
	}

	return {
		mesas: (mesas ?? []).map((mesa) => ({
			numero: mesa.numero,
			escenario: mesa.escenario?.nombre ?? null,
			corridas: mesa.corridas.length,
			corridaEnCurso: mesa.corridas.find((c) => c.habilitada)?.numero ?? null,
			evaluaciones: porMesa.get(mesa.id) ?? 0
		}))
	};
};
