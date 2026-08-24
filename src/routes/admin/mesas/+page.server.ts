import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Las mesas ya no son una lista suelta: pertenecen a un curso, y se ven desde el
 * suyo. Esta ruta queda como puerta para los enlaces viejos y para quien la tenga
 * en el historial. `/admin/mesas/<numero>` sigue siendo la consulta de una mesa.
 */
export const load: PageServerLoad = () => {
	redirect(303, '/admin/cursos');
};
