import { error, fail, redirect } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import { checklistsSinEnviarDe } from '$lib/server/evaluaciones';
import { mesaDelCurso } from '$lib/server/mesas';
import { loEligeElParticipante, rolesQueSeEligen } from '$lib/server/roles';
import { dniValido, normalizarDni } from '$lib/dni';
import type { Actions, PageServerLoad } from './$types';

async function traerMesaYCorrida(codigoDelCurso: string, numeroCrudo: string) {
	const { curso, mesa } = await mesaDelCurso(codigoDelCurso, numeroCrudo);

	// Todas las corridas de la mesa de una vez: la habilitada es la única donde se
	// puede declarar rol, y si no hay ninguna, que haya otras dice que ya cerró.
	const { data: corridas, error: fallo } = await supabase
		.from('corridas')
		.select('id, numero, habilitada')
		.eq('mesa_id', mesa.id);

	if (fallo) error(500, fallo.message);

	const habilitada = (corridas ?? []).find((c) => c.habilitada);
	return {
		curso,
		mesa: {
			id: mesa.id,
			numero: mesa.numero,
			escenario: mesa.escenario ? { nombre: mesa.escenario.nombre } : null
		},
		corrida: habilitada ? { id: habilitada.id, numero: habilitada.numero } : null,
		hubo: (corridas ?? []).length > 0
	};
}

export const load: PageServerLoad = async ({ params, url }) => {
	const { curso, mesa, corrida, hubo } = await traerMesaYCorrida(params.curso, params.numero);
	// De memoria casi siempre: no suma un viaje a la base.
	const roles = await rolesQueSeEligen(curso.destinado_a);

	return {
		curso,
		mesa,
		corrida,
		// Sin corrida abierta puede ser que todavía no empezó o que el líder ya la
		// cerró: al participante se le dice distinto en cada caso.
		cerrada: !corrida && hubo,
		// Llega así quien estaba en una participación que ya no existe: el líder lo
		// sacó del ciclo. Viene en la dirección y no en la sesión porque acá no hay
		// ninguna; lo único que hace es explicar por qué volvió a esta pantalla.
		volvesAElegir: url.searchParams.get('volvesAElegir') === '1',
		roles
	};
};

export const actions: Actions = {
	default: async ({ request, params }) => {
		const formulario = await request.formData();
		const dni = normalizarDni(String(formulario.get('dni') ?? ''));
		const rolCodigo = String(formulario.get('rolCodigo') ?? '');

		const valores = { dni, rolCodigo };
		const rechazar = (estado: number, mensaje: string, campo: string) =>
			fail(estado, { ...valores, mensaje, campo, pendientes: null, rolNombre: null });

		if (!dniValido(dni)) return rechazar(400, 'Ingresá tu DNI, sin puntos.', 'dni');
		if (!rolCodigo) return rechazar(400, 'Elegí el rol que vas a ocupar.', 'rolCodigo');

		const { curso, mesa, corrida } = await traerMesaYCorrida(params.curso, params.numero);
		if (!corrida) {
			return rechazar(409, 'La mesa no tiene ningún ciclo habilitado.', '');
		}

		// Que sea uno de los roles que este curso ofrece, no sólo uno que exista.
		if (!(await loEligeElParticipante(curso.destinado_a, rolCodigo))) {
			return rechazar(400, 'Ese rol no se ocupa en este curso.', 'rolCodigo');
		}

		// Si ya se identificó en esta corrida, vuelve a lo suyo en vez de duplicar:
		// pudo haber cerrado la pestaña o escaneado el QR de nuevo.
		const { data: existente } = await supabase
			.from('participaciones')
			.select('id')
			.eq('corrida_id', corrida.id)
			.eq('dni', dni)
			.maybeSingle();

		if (existente) redirect(303, `/m/${params.curso}/${params.numero}/participacion/${existente.id}`);

		// Si dejó un checklist a medias en una corrida anterior, se lo ofrecemos
		// antes de registrarlo acá: si no, el QR se lo tapa y la observación que ya
		// hizo queda inalcanzable.
		if (formulario.get('continuar') !== 'true') {
			const pendientes = await checklistsSinEnviarDe(mesa.id, dni, corrida.id);
			if (pendientes.length > 0) {
				const { data: rol } = await supabase
					.from('roles')
					.select('nombre')
					.eq('codigo', rolCodigo)
					.maybeSingle();

				return {
					...valores,
					mensaje: null,
					campo: '',
					pendientes,
					rolNombre: rol?.nombre ?? rolCodigo
				};
			}
		}

		const { data: participacion, error: fallo } = await supabase
			.from('participaciones')
			.insert({ corrida_id: corrida.id, dni, rol_codigo: rolCodigo })
			.select('id')
			.single();

		if (fallo || !participacion) {
			return rechazar(400, 'No se pudo registrar tu rol. Intentá de nuevo.', '');
		}

		redirect(303, `/m/${params.curso}/${params.numero}/participacion/${participacion.id}`);
	}
};
