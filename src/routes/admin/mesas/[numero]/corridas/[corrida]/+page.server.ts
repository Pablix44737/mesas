import { error } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import { evaluacionesDeLaCorrida } from '$lib/server/evaluaciones';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const numeroMesa = Number(params.numero);
	const numeroCorrida = Number(params.corrida);
	if (!Number.isInteger(numeroMesa) || numeroMesa <= 0) error(404, 'Mesa inexistente');
	if (!Number.isInteger(numeroCorrida) || numeroCorrida <= 0) error(404, 'Corrida inexistente');

	const { data: mesa, error: fallo } = await supabase
		.from('mesas')
		.select('id, numero, escenario:escenarios(nombre)')
		.eq('numero', numeroMesa)
		.maybeSingle();

	if (fallo) error(500, fallo.message);
	if (!mesa) error(404, `No existe la mesa ${numeroMesa}`);

	const { data: corrida } = await supabase
		.from('corridas')
		.select('id, numero, habilitada')
		.eq('mesa_id', mesa.id)
		.eq('numero', numeroCorrida)
		.maybeSingle();

	if (!corrida) error(404, `La mesa ${numeroMesa} no tiene una corrida ${numeroCorrida}`);

	return {
		mesa: { numero: mesa.numero, escenario: mesa.escenario?.nombre ?? null },
		corrida: { numero: corrida.numero, habilitada: corrida.habilitada },
		evaluaciones: await evaluacionesDeLaCorrida(corrida.id)
	};
};
