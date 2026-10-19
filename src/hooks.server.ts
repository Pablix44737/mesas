import { redirect, type Handle } from '@sveltejs/kit';
import { tenantDeLaSesion } from '$lib/server/sesion';

/**
 * Guardián de la administración.
 *
 * La pantalla de bienvenida ya no ofrece la administración a cualquiera, pero
 * eso solo esconde el enlace: sin este guardián alcanzaba con escribir /admin
 * en la barra del navegador. La comprobación va acá, en un solo lugar, y no
 * repartida por cada `load`, para que una sección nueva quede protegida sola.
 *
 * La sesión no dice solo «es administrador» sino de qué institución: es lo que
 * decide qué datos ve y de quién son los que crea. Sale de la cookie firmada,
 * sin consultar la base, porque esto corre en cada pedido.
 */
export const handle: Handle = async ({ event, resolve }) => {
	event.locals.tenantId = tenantDeLaSesion(event.cookies);

	const ruta = event.url.pathname;
	if ((ruta === '/admin' || ruta.startsWith('/admin/')) && !event.locals.tenantId) {
		redirect(303, `/ingresar?volverA=${encodeURIComponent(ruta)}`);
	}

	return resolve(event);
};
