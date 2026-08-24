import { error } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import { mesaDelCurso } from '$lib/server/mesas';
import { responderConLaPlanificacion } from '$lib/server/planificacion';
import type { RequestHandler } from './$types';

/** La mesa hereda la planificación de su escenario. */
export const GET: RequestHandler = async ({ params }) => {
	const numero = Number(params.numero);
	if (!Number.isInteger(numero) || numero <= 0) error(404, 'Mesa inexistente');

	const { data: mesa, error: fallo } = await supabase
		.from('mesas')
		.select(
			'escenario:escenarios(planificacion_ruta, planificacion_archivo, planificacion_tipo)'
		)
		.eq('numero', numero)
		.maybeSingle();

	if (fallo) error(500, fallo.message);
	if (!mesa?.escenario) error(404, `No existe la mesa ${numero}`);

	return responderConLaPlanificacion(mesa.escenario);
};
