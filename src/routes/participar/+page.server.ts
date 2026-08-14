import { fail, redirect } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import type { Actions } from './$types';

/**
 * Entrada a mano, para cuando el QR no se puede escanear (cámara sin permiso,
 * teléfono sin lector, QR gastado). Comprueba la mesa acá y no en /m/[numero]
 * para poder decir "no existe la mesa 7" en la misma pantalla, en vez de
 * mandar a la persona a una página de error.
 */
export const actions: Actions = {
	default: async ({ request }) => {
		const datos = await request.formData();
		const crudo = String(datos.get('numero') ?? '').trim();
		const numero = Number(crudo);

		if (!crudo || !Number.isInteger(numero) || numero <= 0) {
			return fail(400, { numero: crudo, mensaje: 'El número de mesa tiene que ser un entero.' });
		}

		const { data: mesa, error: fallo } = await supabase
			.from('mesas')
			.select('numero')
			.eq('numero', numero)
			.maybeSingle();

		if (fallo) return fail(500, { numero: crudo, mensaje: fallo.message });
		if (!mesa) {
			return fail(404, {
				numero: crudo,
				mensaje: `No existe la mesa ${numero}. Fijate el número en el cartel de tu mesa.`
			});
		}

		redirect(303, `/m/${mesa.numero}`);
	}
};
