import { redirect } from '@sveltejs/kit';
import { cerrarSesionDeAdmin } from '$lib/server/sesion';
import type { RequestHandler } from './$types';

/**
 * Cerrar la sesión de administración. Es POST y no un enlace porque un GET lo
 * dispararía cualquier precarga del navegador, y porque así el formulario
 * funciona igual con JavaScript apagado.
 */
export const POST: RequestHandler = ({ cookies }) => {
	cerrarSesionDeAdmin(cookies);
	redirect(303, '/');
};
