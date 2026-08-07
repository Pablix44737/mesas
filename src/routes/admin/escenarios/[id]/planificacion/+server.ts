import { error } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import { responderConLaPlanificacion } from '$lib/server/planificacion';
import type { RequestHandler } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET: RequestHandler = async ({ params }) => {
	if (!UUID.test(params.id)) error(404, 'El escenario no existe');

	const { data: escenario, error: fallo } = await supabase
		.from('escenarios')
		.select('planificacion_ruta, planificacion_archivo, planificacion_tipo')
		.eq('id', params.id)
		.maybeSingle();

	if (fallo) error(500, fallo.message);
	if (!escenario) error(404, 'El escenario no existe');

	return responderConLaPlanificacion(escenario);
};
