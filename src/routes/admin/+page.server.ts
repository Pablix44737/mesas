import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * /admin no es una pantalla propia: es la puerta a la que llega quien elige
 * "Administración" en la bienvenida. La primera sección es la de escenarios,
 * que es por donde empieza la preparación del evento.
 */
export const load: PageServerLoad = () => {
	redirect(303, '/admin/escenarios');
};
