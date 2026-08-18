import { error, fail } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [{ data: mesas, error: fallo }, { data: evaluaciones }] = await Promise.all([
		supabase
			.from('mesas')
			.select('id, numero, escenario:escenarios(nombre), corridas(numero, habilitada)')
			.order('numero'),
		supabase.from('evaluaciones_enviadas').select('mesa_id')
	]);

	if (fallo) error(500, fallo.message);

	const porMesa = new Map<string, number>();
	for (const evaluacion of evaluaciones ?? []) {
		if (evaluacion.mesa_id) {
			porMesa.set(evaluacion.mesa_id, (porMesa.get(evaluacion.mesa_id) ?? 0) + 1);
		}
	}

	return {
		mesas: (mesas ?? []).map((mesa) => ({
			id: mesa.id,
			numero: mesa.numero,
			escenario: mesa.escenario?.nombre ?? null,
			corridas: mesa.corridas.length,
			corridaEnCurso: mesa.corridas.find((c) => c.habilitada)?.numero ?? null,
			evaluaciones: porMesa.get(mesa.id) ?? 0
		}))
	};
};

type Resumen = {
	numero: number;
	corridas: number;
	participaciones: number;
	evaluaciones: number;
	enviadas: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const cuantas = (n: number, singular: string, plural: string) =>
	`${n} ${n === 1 ? singular : plural}`;

export const actions: Actions = {
	/**
	 * Eliminar una mesa se lleva puesto todo lo que colgó de ella: sus corridas,
	 * quiénes ocuparon cada rol y las evaluaciones que se hicieron, enviadas o no.
	 * No hay vuelta atrás, así que el número de mesa se escribe a mano: es el único
	 * paso de todo el sistema que destruye trabajo de otras personas.
	 *
	 * Contar y borrar pasan dentro de `borrar_mesa()`, en una sola transacción, así
	 * lo que se informa es lo que de verdad se destruyó y no lo que había cuando se
	 * dibujó la confirmación.
	 */
	eliminar: async ({ request }) => {
		const formulario = await request.formData();
		const id = String(formulario.get('id') ?? '');
		const confirmacion = String(formulario.get('confirmacion') ?? '').trim();

		const rechazar = (estado: number, mensaje: string) =>
			fail(estado, { mensaje, exito: null, eliminando: id });

		if (!UUID.test(id)) return fail(400, { mensaje: 'Mesa inválida.', exito: null, eliminando: null });

		// El número contra el que se confirma sale de la base y no del formulario:
		// si viniera del cliente, quien manda el pedido estaría eligiendo a la vez
		// qué borrar y contra qué se comprueba, y la traba no trabaría nada.
		const { data: mesa } = await supabase.from('mesas').select('numero').eq('id', id).maybeSingle();

		if (!mesa) return rechazar(404, 'Esa mesa ya no existe: alguien la eliminó antes.');

		if (confirmacion !== String(mesa.numero)) {
			return rechazar(400, `Para eliminarla hay que escribir el número de la mesa: ${mesa.numero}.`);
		}

		const { data, error: fallo } = await supabase.rpc('borrar_mesa', { p_mesa_id: id });

		if (fallo) {
			return rechazar(
				fallo.code === 'P0002' ? 404 : 500,
				fallo.code === 'P0002'
					? 'Esa mesa ya no existe: alguien la eliminó antes.'
					: 'No se pudo eliminar la mesa. Intentá de nuevo.'
			);
		}

		const resumen = data as unknown as Resumen;

		// Cuántas evaluaciones cayeron, y cuántas de ellas ya estaban enviadas: es la
		// parte del arrastre que de verdad duele, así que se dice en una sola frase.
		const evaluaciones = () => {
			if (resumen.evaluaciones === 0) return 'ninguna evaluación';
			const total = cuantas(resumen.evaluaciones, 'evaluación', 'evaluaciones');
			if (resumen.enviadas === 0) return `${total} sin enviar`;
			if (resumen.enviadas === resumen.evaluaciones) {
				return resumen.evaluaciones === 1 ? `${total} ya enviada` : `${total}, todas ya enviadas`;
			}
			return `${total}, ${resumen.enviadas} de ellas ya ${resumen.enviadas === 1 ? 'enviada' : 'enviadas'}`;
		};

		// Una mesa que nunca se usó no necesita el inventario de lo que arrastró.
		if (resumen.corridas === 0) {
			return {
				mensaje: null,
				eliminando: null,
				exito: `La mesa ${resumen.numero} quedó eliminada. No llegó a tener corridas, así que no había nada registrado en ella.`
			};
		}

		return {
			mensaje: null,
			eliminando: null,
			exito:
				`La mesa ${resumen.numero} quedó eliminada, y con ella ` +
				`${cuantas(resumen.corridas, 'corrida', 'corridas')}, ` +
				`${cuantas(resumen.participaciones, 'rol ocupado', 'roles ocupados')} y ` +
				`${evaluaciones()}. El padrón y el material del escenario quedaron intactos.`
		};
	}
};
