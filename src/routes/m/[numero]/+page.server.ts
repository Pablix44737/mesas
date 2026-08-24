import { error, redirect } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import type { PageServerLoad } from './$types';

/**
 * Los QR viejos, de cuando el número de mesa era único en todo el sistema.
 *
 * Ahora la mesa se identifica por curso y número, pero hay carteles impresos con
 * `/m/<numero>` a secas. Mientras ese número siga siendo de una sola mesa en todo
 * el sistema, no hay nada ambiguo que resolver y se lo lleva a su URL nueva. En
 * cuanto un segundo curso estrene ese número, el enlace deja de significar una
 * cosa sola y hay que decirlo en vez de adivinar.
 */
export const load: PageServerLoad = async ({ params }) => {
	const numero = Number(params.numero);
	if (!Number.isInteger(numero) || numero <= 0) error(404, 'Mesa inexistente');

	const { data: mesas, error: fallo } = await supabase
		.from('mesas')
		.select('numero, curso:cursos(codigo, nombre)')
		.eq('numero', numero);

	if (fallo) error(500, fallo.message);

	const candidatas = (mesas ?? []).filter((m) => m.curso !== null);

	if (candidatas.length === 0) error(404, `No hay ninguna mesa ${numero}`);
	if (candidatas.length === 1) {
		redirect(308, `/m/${candidatas[0].curso?.codigo}/${numero}`);
	}

	return {
		numero,
		cursos: candidatas.map((m) => ({
			codigo: m.curso?.codigo ?? '',
			nombre: m.curso?.nombre ?? ''
		}))
	};
};
