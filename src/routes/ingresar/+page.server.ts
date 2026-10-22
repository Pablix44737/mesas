import { error, fail, redirect } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import { abrirSesionDeAdmin } from '$lib/server/sesion';
import type { Actions, PageServerLoad } from './$types';

/**
 * A dónde volver después de ingresar. Solo se aceptan rutas de administración
 * de este mismo sitio: si no, `?volverA=https://otro-sitio` convertiría a esta
 * pantalla en un trampolín para llevar gente a cualquier lado.
 */
const destino = (pedido: string | null) => (pedido?.startsWith('/admin') ? pedido : '/admin');

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.tenantId) redirect(303, destino(url.searchParams.get('volverA')));

	const { data: instituciones, error: fallo } = await supabase
		.from('tenants')
		.select('id, nombre')
		.order('nombre');

	if (fallo) error(500, fallo.message);

	return { instituciones: instituciones ?? [] };
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const datos = await request.formData();
		const clave = String(datos.get('clave') ?? '');
		let tenantId = String(datos.get('tenantId') ?? '');

		// Con una sola institución no se la pide: no hay nada que elegir.
		if (!tenantId) {
			const { data: unica } = await supabase.from('tenants').select('id').limit(2);
			if (unica?.length === 1) tenantId = unica[0].id;
		}

		const rechazar = (estado: number, mensaje: string) => fail(estado, { tenantId, mensaje });

		if (!tenantId) return rechazar(400, 'Elegí tu institución.');
		if (!clave) return rechazar(400, 'Escribí la clave para continuar.');

		/**
		 * La comparación ocurre en la base: el hash no sale de ahí ni hacia este
		 * servidor. Toda institución tiene clave desde que se crea, así que no hay
		 * más que dos resultados posibles —y que la institución no exista, que es
		 * una excepción y no un «la clave no es correcta»—.
		 */
		const { data: valida, error: fallo } = await supabase.rpc('verificar_clave_del_tenant', {
			p_tenant_id: tenantId,
			p_clave: clave
		});

		if (fallo) return rechazar(400, 'Esa institución no existe.');
		if (!valida) return rechazar(401, 'La clave no es correcta.');

		abrirSesionDeAdmin(cookies, tenantId);
		redirect(303, destino(url.searchParams.get('volverA')));
	}
};
