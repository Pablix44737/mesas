import { error, redirect, type Handle } from '@sveltejs/kit';
import { tenantDeLaSesion } from '$lib/server/sesion';
import { hayZonaDePlataforma, haySesionDePlataforma } from '$lib/server/plataforma';

/**
 * Guardián de las dos zonas con clave.
 *
 * La pantalla de bienvenida ya no ofrece la administración a cualquiera, pero
 * eso solo esconde el enlace: sin este guardián alcanzaba con escribir /admin
 * en la barra del navegador. La comprobación va acá, en un solo lugar, y no
 * repartida por cada `load`, para que una sección nueva quede protegida sola.
 *
 * La sesión de administración no dice solo «es administrador» sino de qué
 * institución: es lo que decide qué datos ve y de quién son los que crea. Sale
 * de la cookie firmada, sin consultar la base, porque esto corre en cada pedido.
 *
 * La de plataforma es otra cosa y por eso es otra cookie: no administra una
 * institución, está por encima de todas. Una no sirve en la zona de la otra.
 */
export const handle: Handle = async ({ event, resolve }) => {
	event.locals.tenantId = tenantDeLaSesion(event.cookies);
	event.locals.plataforma = haySesionDePlataforma(event.cookies);

	const ruta = event.url.pathname;

	if ((ruta === '/admin' || ruta.startsWith('/admin/')) && !event.locals.tenantId) {
		redirect(303, `/ingresar?volverA=${encodeURIComponent(ruta)}`);
	}

	if (ruta === '/plataforma' || ruta.startsWith('/plataforma/')) {
		// Sin `CLAVE_PLATAFORMA` configurada la zona no existe, y no existe de
		// verdad: responde igual que cualquier dirección inventada, para no
		// anunciar que hay una puerta esperando una clave.
		if (!hayZonaDePlataforma()) error(404, 'Esta página no existe');

		if (!event.locals.plataforma && ruta !== '/plataforma/ingresar') {
			redirect(303, '/plataforma/ingresar');
		}
	}

	return resolve(event);
};
