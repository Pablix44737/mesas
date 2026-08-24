import { error } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import { evaluacionesDeLaCorrida } from '$lib/server/evaluaciones';
import { mesaDelCurso } from '$lib/server/mesas';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const numeroCorrida = Number(params.corrida);
	if (!Number.isInteger(numeroCorrida) || numeroCorrida <= 0) error(404, 'Corrida inexistente');

	const { curso, mesa: encontrada } = await mesaDelCurso(params.curso, params.numero);

	const { data: mesa, error: fallo } = await supabase
		.from('mesas')
		.select('id, numero, escenario:escenarios(nombre)')
		.eq('id', encontrada.id)
		.maybeSingle();

	if (fallo) error(500, fallo.message);
	if (!mesa) error(404, 'Esa mesa ya no existe');

	const { data: corrida } = await supabase
		.from('corridas')
		.select('id, numero, habilitada')
		.eq('mesa_id', mesa.id)
		.eq('numero', numeroCorrida)
		.maybeSingle();

	if (!corrida) error(404, `La mesa ${mesa.numero} no tiene una corrida ${numeroCorrida}`);

	return {
		curso,
		mesa: { numero: mesa.numero, escenario: mesa.escenario?.nombre ?? null },
		corrida: { numero: corrida.numero, habilitada: corrida.habilitada },
		evaluaciones: await evaluacionesDeLaCorrida(corrida.id)
	};
};
