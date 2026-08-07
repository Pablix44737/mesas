import { error, fail, redirect } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import type { Actions, PageServerLoad } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const load: PageServerLoad = async () => {
	const [{ data: mesas, error: falloMesas }, { data: escenarios }] = await Promise.all([
		supabase
			.from('mesas')
			.select('id, numero, escenario:escenarios(id, nombre), corridas(numero, habilitada)')
			.order('numero'),
		// El líder solo dispone de los escenarios que el administrador dejó disponibles.
		supabase.from('escenarios').select('id, nombre').eq('disponible', true).order('nombre')
	]);

	if (falloMesas) error(500, falloMesas.message);

	return {
		mesas: (mesas ?? []).map((mesa) => ({
			id: mesa.id,
			numero: mesa.numero,
			escenario: mesa.escenario,
			corridaEnCurso: mesa.corridas.find((c) => c.habilitada)?.numero ?? null,
			corridas: mesa.corridas.length
		})),
		escenarios: escenarios ?? []
	};
};

export const actions: Actions = {
	crear: async ({ request }) => {
		const formulario = await request.formData();
		const numeroCrudo = String(formulario.get('numero') ?? '').trim();
		const escenarioId = String(formulario.get('escenarioId') ?? '');

		const valores = { numero: numeroCrudo, escenarioId };
		const rechazar = (estado: number, mensaje: string, campo: string) =>
			fail(estado, { ...valores, mensaje, campo });

		const numero = Number(numeroCrudo);
		if (!Number.isInteger(numero) || numero <= 0) {
			return rechazar(400, 'El número de mesa tiene que ser un entero positivo.', 'numero');
		}
		if (!UUID.test(escenarioId)) {
			return rechazar(400, 'Elegí el escenario que la mesa va a practicar.', 'escenarioId');
		}

		// Que el escenario exista no alcanza: tiene que estar disponible.
		const { data: escenario } = await supabase
			.from('escenarios')
			.select('id')
			.eq('id', escenarioId)
			.eq('disponible', true)
			.maybeSingle();

		if (!escenario) {
			return rechazar(409, 'Ese escenario ya no está disponible.', 'escenarioId');
		}

		const { error: fallo } = await supabase
			.from('mesas')
			.insert({ numero, escenario_id: escenarioId });

		if (fallo) {
			return fallo.code === '23505'
				? rechazar(409, `El número ${numero} ya está en uso por otra mesa.`, 'numero')
				: rechazar(500, 'No se pudo crear la mesa. Intentá de nuevo.', '');
		}

		redirect(303, `/mesas/${numero}`);
	}
};
