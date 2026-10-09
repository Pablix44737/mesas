import { error, fail, redirect } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [{ data: escenarios, error: falloEscenarios }, { data: operacion }] = await Promise.all([
		supabase
			.from('escenarios')
			.select(
				'id, nombre, disponible, planificacion_archivo, checklist_tecnica:checklist_plantillas(id, nombre)'
			)
			.order('nombre'),
		// Los checklists que no cuelgan de un escenario sino de su rol, uno por rol
		// de checklist común. Son dos: el del facilitador y el del proceso, cada uno
		// en su tipo de curso.
		supabase
			.from('checklist_plantillas')
			.select('id, nombre, rol:roles!inner(nombre, checklist)')
			.eq('estado', 'disponible')
			.eq('roles.checklist', 'comun')
	]);

	if (falloEscenarios) error(500, falloEscenarios.message);

	return {
		escenarios: escenarios ?? [],
		// Comunes a todos los escenarios: no se eligen, se informan.
		checklistsComunes: (operacion ?? []).map((p) => ({
			id: p.id,
			nombre: p.nombre,
			rol: p.rol?.nombre ?? ''
		}))
	};
};

export const actions: Actions = {
	crear: async ({ request }) => {
		const formulario = await request.formData();
		const nombre = String(formulario.get('nombre') ?? '').trim();

		if (nombre.length < 3) {
			return fail(400, { nombre, mensaje: 'Poné un nombre de al menos 3 caracteres.' });
		}

		const { data: escenario, error: fallo } = await supabase
			.from('escenarios')
			.insert({ nombre })
			.select('id')
			.single();

		if (fallo) {
			const repetido = fallo.code === '23505';
			return fail(repetido ? 409 : 500, {
				nombre,
				mensaje: repetido
					? 'Ya hay un escenario con ese nombre.'
					: 'No se pudo crear el escenario. Intentá de nuevo.'
			});
		}

		redirect(303, `/admin/escenarios/${escenario.id}`);
	}
};
