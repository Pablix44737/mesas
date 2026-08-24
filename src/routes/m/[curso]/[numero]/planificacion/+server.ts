import { error } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import { responderConLaPlanificacion } from '$lib/server/planificacion';
import { mesaDelCurso } from '$lib/server/mesas';
import type { RequestHandler } from './$types';

/** La planificación que el facilitador de esta mesa consulta durante la corrida. */
export const GET: RequestHandler = async ({ params }) => {
	const { mesa } = await mesaDelCurso(params.curso, params.numero);

	const { data, error: fallo } = await supabase
		.from('mesas')
		.select('escenario:escenarios(planificacion_ruta, planificacion_archivo, planificacion_tipo)')
		.eq('id', mesa.id)
		.maybeSingle();

	if (fallo) error(500, fallo.message);
	if (!data?.escenario) error(404, 'Esa mesa ya no existe');

	return responderConLaPlanificacion(data.escenario);
};
