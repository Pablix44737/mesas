import { error, fail } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import { evaluacionesDeLaCorrida } from '$lib/server/evaluaciones';
import { dniValido, normalizarDni } from '$lib/dni';
import { mesaDelCurso } from '$lib/server/mesas';
import type { Actions, PageServerLoad } from './$types';

/** Solo quienes practicaron la técnica consultan lo registrado sobre su corrida. */
const ROLES_QUE_PRACTICAN = ['operador', 'asistente'];

async function traerMesa(codigoDelCurso: string, numeroCrudo: string) {
	const { mesa: encontrada } = await mesaDelCurso(codigoDelCurso, numeroCrudo);

	const { data: mesa, error: fallo } = await supabase
		.from('mesas')
		.select('id, numero, escenario:escenarios(nombre)')
		.eq('id', encontrada.id)
		.maybeSingle();

	if (fallo) error(500, fallo.message);
	if (!mesa) error(404, 'Esa mesa ya no existe');

	return mesa;
}

export const load: PageServerLoad = async ({ params }) => {
	const mesa = await traerMesa(params.curso, params.numero);
	return {
		curso: params.curso,
		mesa: { numero: mesa.numero, escenario: mesa.escenario?.nombre ?? null }
	};
};

export const actions: Actions = {
	default: async ({ request, params }) => {
		const mesa = await traerMesa(params.curso, params.numero);

		const formulario = await request.formData();
		const dni = normalizarDni(String(formulario.get('dni') ?? ''));

		if (!dniValido(dni)) {
			return fail(400, {
				dni,
				mensaje: 'Ingresá tu DNI, sin puntos.',
				corridas: null,
				nombre: null
			});
		}

		const { data: corridasDeLaMesa } = await supabase
			.from('corridas')
			.select('id, numero, habilitada')
			.eq('mesa_id', mesa.id);

		const { data: participaciones } = await supabase
			.from('participaciones')
			.select('id, rol_codigo, corrida_id, rol:roles(nombre), participante:participantes(nombre, apellido)')
			.eq('dni', dni)
			.in('rol_codigo', ROLES_QUE_PRACTICAN)
			.in(
				'corrida_id',
				(corridasDeLaMesa ?? []).map((c) => c.id)
			);

		const suyas = participaciones ?? [];

		if (suyas.length === 0) {
			return fail(404, {
				dni,
				mensaje:
					'No encontramos ninguna corrida de esta mesa en la que hayas practicado la técnica. Esta consulta es para quien ocupó el rol de operador o de asistente.',
				corridas: null,
				nombre: null
			});
		}

		const porNumero = new Map((corridasDeLaMesa ?? []).map((c) => [c.id, c]));

		// De la más reciente a la más vieja: lo último practicado es lo que se busca.
		const corridas = await Promise.all(
			suyas
				.map((p) => ({ participacion: p, corrida: porNumero.get(p.corrida_id) }))
				.filter((x) => x.corrida !== undefined)
				.sort((a, b) => (b.corrida?.numero ?? 0) - (a.corrida?.numero ?? 0))
				.map(async ({ participacion, corrida }) => ({
					numero: corrida?.numero ?? 0,
					enCurso: corrida?.habilitada ?? false,
					rol: participacion.rol?.nombre ?? participacion.rol_codigo,
					evaluaciones: await evaluacionesDeLaCorrida(participacion.corrida_id)
				}))
		);

		const identificado = suyas[0].participante;

		return {
			dni,
			mensaje: null,
			corridas,
			nombre: identificado ? `${identificado.nombre} ${identificado.apellido}` : null
		};
	}
};
