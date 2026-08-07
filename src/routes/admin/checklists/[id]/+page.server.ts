import { error, fail } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import type { Actions, PageServerLoad } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const rechazar = (estado: number, mensaje: string) => fail(estado, { mensaje, exito: null });

async function traerPlantilla(id: string) {
	if (!UUID.test(id)) error(404, 'El checklist no existe');

	const { data, error: fallo } = await supabase
		.from('checklist_plantillas')
		.select('id, nombre, rol_codigo, ponderado, estado, rol:roles(nombre)')
		.eq('id', id)
		.maybeSingle();

	if (fallo) error(500, fallo.message);
	if (!data) error(404, 'El checklist no existe');

	return data;
}

function leerPeso(valor: FormDataEntryValue | null, ponderado: boolean): number | null {
	// Sin ponderar el peso lo fija la base en 1; no hace falta leerlo del formulario.
	if (!ponderado) return 1;
	const peso = Number(String(valor ?? '').replace(',', '.'));
	if (!Number.isFinite(peso) || peso < 0) return null;
	return peso;
}

export const load: PageServerLoad = async ({ params }) => {
	const plantilla = await traerPlantilla(params.id);

	const { data: items } = await supabase
		.from('checklist_items')
		.select('id, orden, texto, peso')
		.eq('plantilla_id', plantilla.id)
		.order('orden');

	// Si es el de la operación, avisamos a cuál va a reemplazar al terminarlo.
	const { data: vigente } =
		plantilla.rol_codigo === 'observador_operacion' && plantilla.estado !== 'disponible'
			? await supabase
					.from('checklist_plantillas')
					.select('nombre')
					.eq('rol_codigo', 'observador_operacion')
					.eq('estado', 'disponible')
					.maybeSingle()
			: { data: null };

	const criterios = (items ?? []).map((i) => ({ ...i, peso: Number(i.peso) }));

	return {
		plantilla,
		items: criterios,
		maximo: criterios.reduce((total, i) => total + i.peso, 0),
		operacionVigente: vigente?.nombre ?? null
	};
};

export const actions: Actions = {
	agregarItem: async ({ request, params }) => {
		const plantilla = await traerPlantilla(params.id);

		const formulario = await request.formData();
		const texto = String(formulario.get('texto') ?? '').trim();
		const peso = leerPeso(formulario.get('peso'), plantilla.ponderado);

		if (texto.length < 3) return rechazar(400, 'Escribí el criterio a evaluar.');
		if (peso === null) return rechazar(400, 'El peso tiene que ser un número no negativo.');

		const { data: ultimo } = await supabase
			.from('checklist_items')
			.select('orden')
			.eq('plantilla_id', plantilla.id)
			.order('orden', { ascending: false })
			.limit(1)
			.maybeSingle();

		const { error: fallo } = await supabase.from('checklist_items').insert({
			plantilla_id: plantilla.id,
			orden: (ultimo?.orden ?? 0) + 1,
			texto,
			peso
		});

		if (fallo) return rechazar(400, 'No se pudo agregar el criterio. Intentá de nuevo.');

		return { mensaje: null, exito: 'Criterio agregado.' };
	},

	editarItem: async ({ request, params }) => {
		const plantilla = await traerPlantilla(params.id);

		const formulario = await request.formData();
		const itemId = String(formulario.get('itemId') ?? '');
		const texto = String(formulario.get('texto') ?? '').trim();
		const peso = leerPeso(formulario.get('peso'), plantilla.ponderado);

		if (!UUID.test(itemId)) return rechazar(400, 'Criterio inválido.');
		if (texto.length < 3) return rechazar(400, 'El criterio no puede quedar vacío.');
		if (peso === null) return rechazar(400, 'El peso tiene que ser un número no negativo.');

		const { error: fallo } = await supabase
			.from('checklist_items')
			.update({ texto, peso })
			.eq('id', itemId)
			.eq('plantilla_id', plantilla.id);

		if (fallo) return rechazar(400, 'No se pudo guardar el criterio. Intentá de nuevo.');

		return { mensaje: null, exito: 'Criterio guardado.' };
	},

	quitarItem: async ({ request, params }) => {
		const plantilla = await traerPlantilla(params.id);

		const formulario = await request.formData();
		const itemId = String(formulario.get('itemId') ?? '');
		if (!UUID.test(itemId)) return rechazar(400, 'Criterio inválido.');

		const { error: fallo } = await supabase
			.from('checklist_items')
			.delete()
			.eq('id', itemId)
			.eq('plantilla_id', plantilla.id);

		if (fallo) return rechazar(400, 'No se pudo quitar el criterio. Intentá de nuevo.');

		return { mensaje: null, exito: 'Criterio quitado.' };
	},

	/** Al despoderar, un trigger iguala todos los pesos en 1. */
	ponderacion: async ({ request, params }) => {
		const plantilla = await traerPlantilla(params.id);

		const formulario = await request.formData();
		const ponderado = formulario.get('ponderado') === 'true';

		const { error: fallo } = await supabase
			.from('checklist_plantillas')
			.update({ ponderado })
			.eq('id', plantilla.id);

		if (fallo) return rechazar(400, 'No se pudo cambiar la ponderación. Intentá de nuevo.');

		return {
			mensaje: null,
			exito: ponderado
				? 'Checklist ponderado: asigná un peso a cada criterio.'
				: 'Checklist sin ponderar: todos los criterios pesan lo mismo.'
		};
	},

	/** Da el checklist por terminado: queda disponible para usarse. */
	terminar: async ({ params }) => {
		const plantilla = await traerPlantilla(params.id);

		const { data, error: fallo } = await supabase.rpc('dar_por_terminado_el_checklist', {
			p_plantilla_id: plantilla.id
		});

		if (fallo || !data) {
			return rechazar(
				400,
				fallo?.message.includes('sin criterios')
					? 'Un checklist sin criterios no puede darse por terminado.'
					: 'No se pudo dar por terminado el checklist. Intentá de nuevo.'
			);
		}

		return {
			mensaje: null,
			exito: `«${data.nombre}» quedó creado y disponible para usarse.`
		};
	}
};
