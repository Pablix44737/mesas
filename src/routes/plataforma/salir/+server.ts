import { redirect } from '@sveltejs/kit';
import { cerrarSesionDePlataforma } from '$lib/server/plataforma';
import type { RequestHandler } from './$types';

/**
 * Cerrar la sesión de plataforma. Es POST y no un enlace porque un GET lo
 * dispararía cualquier precarga del navegador, y porque así el formulario
 * funciona igual con JavaScript apagado. No toca la sesión de administración:
 * son dos cookies distintas y cada una se cierra donde se abrió.
 */
export const POST: RequestHandler = ({ cookies }) => {
	cerrarSesionDePlataforma(cookies);
	redirect(303, '/');
};
