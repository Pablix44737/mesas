import { fail, redirect } from '@sveltejs/kit';
import { abrirSesionDeAdmin, claveDeAdminCorrecta } from '$lib/server/sesion';
import type { Actions, PageServerLoad } from './$types';

/**
 * A dónde volver después de ingresar. Solo se aceptan rutas de administración
 * de este mismo sitio: si no, `?volverA=https://otro-sitio` convertiría a esta
 * pantalla en un trampolín para llevar gente a cualquier lado.
 */
const destino = (pedido: string | null) =>
	pedido?.startsWith('/admin') ? pedido : '/admin';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.admin) redirect(303, destino(url.searchParams.get('volverA')));
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const datos = await request.formData();
		const clave = String(datos.get('clave') ?? '');

		if (!clave) return fail(400, { mensaje: 'Escribí la clave para continuar.' });
		if (!claveDeAdminCorrecta(clave)) return fail(401, { mensaje: 'La clave no es correcta.' });

		abrirSesionDeAdmin(cookies);
		redirect(303, destino(url.searchParams.get('volverA')));
	}
};
