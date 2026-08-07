import { error, fail, redirect } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [{ data: plantillas, error: fallo }, { data: roles }] = await Promise.all([
		supabase
			.from('checklist_plantillas')
			.select('id, nombre, rol_codigo, ponderado, estado, creada_en, rol:roles(nombre)')
			.order('creada_en', { ascending: false }),
		// Solo los roles observadores llevan checklist.
		supabase.from('roles').select('codigo, nombre').eq('observador', true).order('orden')
	]);

	if (fallo) error(500, fallo.message);

	const { data: items } = await supabase.from('checklist_items').select('plantilla_id, peso');

	const conteo = new Map<string, { items: number; maximo: number }>();
	for (const item of items ?? []) {
		const previo = conteo.get(item.plantilla_id) ?? { items: 0, maximo: 0 };
		conteo.set(item.plantilla_id, {
			items: previo.items + 1,
			maximo: previo.maximo + Number(item.peso)
		});
	}

	return {
		plantillas: (plantillas ?? []).map((p) => ({
			...p,
			...(conteo.get(p.id) ?? { items: 0, maximo: 0 })
		})),
		roles: roles ?? []
	};
};

export const actions: Actions = {
	crear: async ({ request }) => {
		const formulario = await request.formData();
		const nombre = String(formulario.get('nombre') ?? '').trim();
		const rolCodigo = String(formulario.get('rolCodigo') ?? '');
		const ponderado = formulario.get('ponderado') === 'on';

		const valores = { nombre, rolCodigo, ponderado };
		const rechazar = (estado: number, mensaje: string, campo: string) =>
			fail(estado, { ...valores, mensaje, campo });

		if (nombre.length < 3) {
			return rechazar(400, 'Poné un nombre de al menos 3 caracteres.', 'nombre');
		}
		if (!rolCodigo) {
			return rechazar(400, 'Indicá el rol observador al que corresponde.', 'rolCodigo');
		}

		const { data: plantilla, error: fallo } = await supabase
			.from('checklist_plantillas')
			.insert({ nombre, rol_codigo: rolCodigo, ponderado })
			.select('id')
			.single();

		if (fallo || !plantilla) {
			return rechazar(400, 'No se pudo crear el checklist. Intentá de nuevo.', '');
		}

		redirect(303, `/admin/checklists/${plantilla.id}`);
	}
};
