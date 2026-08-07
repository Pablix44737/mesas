import { error, fail, redirect } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import { checklistsSinEnviarDe } from '$lib/server/evaluaciones';
import { dniValido, normalizarDni } from '$lib/dni';
import type { Actions, PageServerLoad } from './$types';

async function traerMesaYCorrida(numeroCrudo: string) {
	const numero = Number(numeroCrudo);
	if (!Number.isInteger(numero) || numero <= 0) error(404, 'Mesa inexistente');

	const { data: mesa, error: fallo } = await supabase
		.from('mesas')
		.select('id, numero, escenario:escenarios(nombre)')
		.eq('numero', numero)
		.maybeSingle();

	if (fallo) error(500, fallo.message);
	if (!mesa) error(404, `No existe la mesa ${numero}`);

	// Solo se puede declarar rol en la corrida que el líder tenga habilitada.
	const { data: corrida } = await supabase
		.from('corridas')
		.select('id, numero')
		.eq('mesa_id', mesa.id)
		.eq('habilitada', true)
		.maybeSingle();

	return { mesa, corrida };
}

export const load: PageServerLoad = async ({ params }) => {
	const { mesa, corrida } = await traerMesaYCorrida(params.numero);

	const { data: roles } = await supabase
		.from('roles')
		.select('codigo, nombre, observador')
		.order('orden');

	return { mesa, corrida, roles: roles ?? [] };
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

		const { mesa, corrida } = await traerMesaYCorrida(params.numero);
		if (!corrida) {
			return rechazar(409, 'La mesa no tiene ninguna corrida habilitada.', '');
		}

		// Si ya se identificó en esta corrida, vuelve a lo suyo en vez de duplicar:
		// pudo haber cerrado la pestaña o escaneado el QR de nuevo.
		const { data: existente } = await supabase
			.from('participaciones')
			.select('id')
			.eq('corrida_id', corrida.id)
			.eq('dni', dni)
			.maybeSingle();

		if (existente) redirect(303, `/m/${params.numero}/participacion/${existente.id}`);

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

		redirect(303, `/m/${params.numero}/participacion/${participacion.id}`);
	}
};
