import { redirect, type Handle } from '@sveltejs/kit';
import { haySesionDeAdmin } from '$lib/server/sesion';

/**
 * Guardián de la administración.
 *
 * La pantalla de bienvenida ya no ofrece la administración a cualquiera, pero
 * eso solo esconde el enlace: sin este guardián alcanzaba con escribir /admin
 * en la barra del navegador. La comprobación va acá, en un solo lugar, y no
 * repartida por cada `load`, para que una sección nueva quede protegida sola.
 */
export const handle: Handle = async ({ event, resolve }) => {
	event.locals.admin = haySesionDeAdmin(event.cookies);

	const ruta = event.url.pathname;
	if ((ruta === '/admin' || ruta.startsWith('/admin/')) && !event.locals.admin) {
		redirect(303, `/ingresar?volverA=${encodeURIComponent(ruta)}`);
	}

	return resolve(event);
};
