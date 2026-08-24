import { error, fail, redirect } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import type { Actions, PageServerLoad } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const load: PageServerLoad = async () => {
	// Sólo los cursos en marcha: a una edición archivada ya no entra nadie.
	const { data: cursos, error: fallo } = await supabase
		.from('cursos')
		.select('id, codigo, nombre')
		.eq('archivado', false)
		.order('creado_en', { ascending: false });

	if (fallo) error(500, fallo.message);

	return { cursos: cursos ?? [] };
};

/**
 * Entrada a mano, para cuando el QR no se puede escanear (cámara sin permiso,
 * teléfono sin lector, QR gastado). Ahora hace falta el curso además del número:
 * cada edición numera sus mesas desde 1, así que el número solo no alcanza. Con
 * un solo curso en marcha, la pantalla lo elige sola y no se nota.
 *
 * La mesa se comprueba acá y no en `/m/<curso>/<numero>` para poder decir «ese
 * curso no tiene una mesa 7» en la misma pantalla, sin mandar a nadie a un error.
 */
export const actions: Actions = {
	default: async ({ request }) => {
		const datos = await request.formData();
		const crudo = String(datos.get('numero') ?? '').trim();
		const cursoId = String(datos.get('cursoId') ?? '');
		const numero = Number(crudo);

		const valores = { numero: crudo, cursoId };

		if (!UUID.test(cursoId)) {
			return fail(400, { ...valores, mensaje: 'Elegí el curso al que pertenece tu mesa.' });
		}
		if (!crudo || !Number.isInteger(numero) || numero <= 0) {
			return fail(400, { ...valores, mensaje: 'El número de mesa tiene que ser un entero.' });
		}

		const { data: curso } = await supabase
			.from('cursos')
			.select('id, codigo, nombre')
			.eq('id', cursoId)
			.eq('archivado', false)
			.maybeSingle();

		if (!curso) return fail(404, { ...valores, mensaje: 'Ese curso ya no está en marcha.' });

		const { data: mesa, error: fallo } = await supabase
			.from('mesas')
			.select('numero')
			.eq('curso_id', curso.id)
			.eq('numero', numero)
			.maybeSingle();

		if (fallo) return fail(500, { ...valores, mensaje: fallo.message });
		if (!mesa) {
			return fail(404, {
				...valores,
				mensaje: `${curso.nombre} no tiene una mesa ${numero}. Fijate el número en el cartel de tu mesa.`
			});
		}

		redirect(303, `/m/${curso.codigo}/${mesa.numero}`);
	}
};
