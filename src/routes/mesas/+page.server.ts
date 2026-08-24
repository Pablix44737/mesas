import { error, fail, redirect } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import type { Actions, PageServerLoad } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const load: PageServerLoad = async () => {
	const [{ data: mesas, error: falloMesas }, { data: escenarios }, { data: cursos }] =
		await Promise.all([
		supabase
			.from('mesas')
			.select(
				'id, numero, curso:cursos(id, codigo, nombre), escenario:escenarios(id, nombre), corridas(numero, habilitada)'
			)
			.order('numero'),
		// El líder solo dispone de los escenarios que el administrador dejó disponibles.
		supabase.from('escenarios').select('id, nombre').eq('disponible', true).order('nombre'),
		// Y de los cursos en marcha: a uno archivado ya no se le agregan mesas.
		supabase
			.from('cursos')
			.select('id, nombre')
			.eq('archivado', false)
			.order('creado_en', { ascending: false })
	]);

	if (falloMesas) error(500, falloMesas.message);

	return {
		mesas: (mesas ?? []).map((mesa) => ({
			id: mesa.id,
			numero: mesa.numero,
			escenario: mesa.escenario,
			curso: mesa.curso,
			corridaEnCurso: mesa.corridas.find((c) => c.habilitada)?.numero ?? null,
			corridas: mesa.corridas.length
		})),
		escenarios: escenarios ?? [],
		cursos: cursos ?? []
	};
};

export const actions: Actions = {
	crear: async ({ request }) => {
		const formulario = await request.formData();
		const numeroCrudo = String(formulario.get('numero') ?? '').trim();
		const escenarioId = String(formulario.get('escenarioId') ?? '');
		const cursoId = String(formulario.get('cursoId') ?? '');

		const valores = { numero: numeroCrudo, escenarioId, cursoId };
		const rechazar = (estado: number, mensaje: string, campo: string) =>
			fail(estado, { ...valores, mensaje, campo });

		const numero = Number(numeroCrudo);
		if (!Number.isInteger(numero) || numero <= 0) {
			return rechazar(400, 'El número de mesa tiene que ser un entero positivo.', 'numero');
		}
		if (!UUID.test(escenarioId)) {
			return rechazar(400, 'Elegí el escenario que la mesa va a practicar.', 'escenarioId');
		}
		if (!UUID.test(cursoId)) {
			return rechazar(400, 'Elegí el curso al que pertenece la mesa.', 'cursoId');
		}

		// Un curso archivado es una edición terminada: no recibe mesas nuevas.
		const { data: curso } = await supabase
			.from('cursos')
			.select('id')
			.eq('id', cursoId)
			.eq('archivado', false)
			.maybeSingle();

		if (!curso) return rechazar(409, 'Ese curso ya no está en marcha.', 'cursoId');

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

		const { data: creada, error: fallo } = await supabase
			.from('mesas')
			.insert({ numero, escenario_id: escenarioId, curso_id: cursoId })
			.select('numero, curso:cursos(codigo)')
			.maybeSingle();

		if (fallo) {
			return fallo.code === '23505'
				? rechazar(409, `El curso ya tiene una mesa ${numero}.`, 'numero')
				: rechazar(500, 'No se pudo crear la mesa. Intentá de nuevo.', '');
		}

		redirect(303, `/mesas/${creada?.curso?.codigo}/${numero}`);
	}
};
