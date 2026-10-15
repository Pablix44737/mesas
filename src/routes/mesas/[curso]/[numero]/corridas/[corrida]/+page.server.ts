import { error } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import { evaluacionesDeLaCorrida } from '$lib/server/evaluaciones';
import { mesaDelCurso } from '$lib/server/mesas';
import type { PageServerLoad } from './$types';

/**
 * Lo que se evaluó en una corrida, para el líder de mesa.
 *
 * Es la misma vista que ya tenía el administrador, pero el administrador está
 * detrás de la clave y el líder no entra ahí. Y la necesita en otro momento: en el
 * debriefing, con la gente delante, para consultar lo que marcó cada observador.
 *
 * Va en una pantalla aparte y no desplegada en la lista de participantes porque un
 * checklist de la técnica puede tener 18 criterios: abrir dos o tres convertiría la
 * pantalla del líder en una pared. Y porque acá se llega también a las corridas ya
 * cerradas, que en esa lista no figuran.
 */
export const load: PageServerLoad = async ({ params }) => {
	const numeroCorrida = Number(params.corrida);
	if (!Number.isInteger(numeroCorrida) || numeroCorrida <= 0) error(404, 'Ciclo inexistente');

	const { curso, mesa: encontrada } = await mesaDelCurso(params.curso, params.numero);

	const { data: mesa, error: fallo } = await supabase
		.from('mesas')
		.select('id, numero, escenario:escenarios(nombre)')
		.eq('id', encontrada.id)
		.maybeSingle();

	if (fallo) error(500, fallo.message);
	if (!mesa) error(404, 'Esa mesa ya no existe');

	// Todas las de la mesa: son las solapas con que se pasa de una a otra sin
	// volver atrás, que es como se recorre un debriefing.
	const { data: corridas } = await supabase
		.from('corridas')
		.select('id, numero, habilitada')
		.eq('mesa_id', mesa.id)
		.order('numero');

	const corrida = (corridas ?? []).find((c) => c.numero === numeroCorrida);
	if (!corrida) error(404, `La mesa ${mesa.numero} no tiene un ciclo ${numeroCorrida}`);

	return {
		curso,
		mesa: { numero: mesa.numero, escenario: mesa.escenario?.nombre ?? null },
		corrida: { numero: corrida.numero, habilitada: corrida.habilitada },
		corridas: (corridas ?? []).map((c) => ({ numero: c.numero, habilitada: c.habilitada })),
		evaluaciones: await evaluacionesDeLaCorrida(corrida.id)
	};
};
