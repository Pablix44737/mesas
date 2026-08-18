import { error } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import type { PageServerLoad } from './$types';

/**
 * El cartel de la mesa: el QR grande, con el número a la vista, para proyectar,
 * imprimir o dejar sobre la mesa. Antes esto era el SVG pelado del endpoint del
 * QR, sin número ni forma de imprimirlo desde un teléfono.
 */
export const load: PageServerLoad = async ({ params, url }) => {
	const numero = Number(params.numero);
	if (!Number.isInteger(numero) || numero <= 0) error(404, 'Mesa inexistente');

	const { data: mesa, error: fallo } = await supabase
		.from('mesas')
		.select('numero, escenario:escenarios(nombre)')
		.eq('numero', numero)
		.maybeSingle();

	if (fallo) error(500, fallo.message);
	if (!mesa) error(404, `No existe la mesa ${numero}`);

	return { mesa, origen: url.origin };
};
