import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Las evaluaciones de un ciclo se ven ahora en un panel de la pantalla de la
 * mesa. Esta dirección queda para que los enlaces de antes sigan llegando.
 */
export const load: PageServerLoad = ({ params }) => {
	const numero = Number(params.corrida);
	if (!Number.isInteger(numero) || numero <= 0) error(404, 'Ciclo inexistente');
	redirect(301, `/admin/cursos/${params.curso}/mesas/${params.numero}?ciclo=${numero}`);
};
