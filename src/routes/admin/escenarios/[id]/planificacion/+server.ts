import { error } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import { tenantActual } from '$lib/server/tenant';
import { responderConLaPlanificacion } from '$lib/server/planificacion';
import type { RequestHandler } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!UUID.test(params.id)) error(404, 'El escenario no existe');

	// Acotado a la institución de la sesión: esto sirve un archivo del bucket
	// privado, así que sin el filtro bastaría con pegar el id de un escenario de
	// otra institución para bajarse su planificación.
	const { data: escenario, error: fallo } = await supabase
		.from('escenarios')
		.select('planificacion_ruta, planificacion_archivo, planificacion_tipo')
		.eq('id', params.id)
		.eq('tenant_id', tenantActual(locals))
		.maybeSingle();

	if (fallo) error(500, fallo.message);
	if (!escenario) error(404, 'El escenario no existe');

	return responderConLaPlanificacion(escenario);
};
