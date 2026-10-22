import { fail, redirect } from '@sveltejs/kit';
import { abrirSesionDePlataforma, claveDePlataformaCorrecta } from '$lib/server/plataforma';
import type { Actions, PageServerLoad } from './$types';

/**
 * Que la zona exista lo decide el guardián de `hooks.server.ts`: si no hay
 * `CLAVE_PLATAFORMA` configurada, a esta pantalla no se llega.
 */
export const load: PageServerLoad = ({ locals }) => {
	if (locals.plataforma) redirect(303, '/plataforma');
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const datos = await request.formData();
		const clave = String(datos.get('clave') ?? '');

		if (!clave) return fail(400, { mensaje: 'Escribí la clave para continuar.' });
		if (!claveDePlataformaCorrecta(clave)) {
			return fail(401, { mensaje: 'La clave no es correcta.' });
		}

		abrirSesionDePlataforma(cookies);
		redirect(303, '/plataforma');
	}
};
