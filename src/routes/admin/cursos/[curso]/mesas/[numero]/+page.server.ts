import { error, fail } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import { mostrarDni } from '$lib/dni';
import { mesaDelCurso } from '$lib/server/mesas';
import type { Actions, PageServerLoad } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const load: PageServerLoad = async ({ params }) => {
	const { curso, mesa: encontrada } = await mesaDelCurso(params.curso, params.numero);

	const { data: mesa, error: fallo } = await supabase
		.from('mesas')
		.select('id, numero, creada_en, escenario:escenarios(id, nombre)')
		.eq('id', encontrada.id)
		.maybeSingle();

	if (fallo) error(500, fallo.message);
	if (!mesa) error(404, 'Esa mesa ya no existe');

	const [{ data: corridas }, { data: evaluaciones }, { data: abiertos }] = await Promise.all([
		supabase
			.from('corridas')
			.select(
				`id, numero, habilitada, creada_en,
				 participaciones(
					id, dni, rol_codigo,
					rol:roles(nombre, orden),
					participante:participantes(nombre, apellido)
				 )`
			)
			.eq('mesa_id', mesa.id)
			.order('numero', { ascending: false }),
		supabase
			.from('evaluaciones_enviadas')
			.select('corrida_id, participacion_id')
			.eq('mesa_id', mesa.id),
		supabase.from('checklists_sin_enviar').select('corrida_id').eq('mesa_id', mesa.id)
	]);

	const evaluadas = new Set((evaluaciones ?? []).map((e) => e.participacion_id));
	const porCorrida = new Map<string, number>();
	for (const evaluacion of evaluaciones ?? []) {
		if (evaluacion.corrida_id) {
			porCorrida.set(evaluacion.corrida_id, (porCorrida.get(evaluacion.corrida_id) ?? 0) + 1);
		}
	}

	// Checklists abiertos y todavía sin enviar: se pierden si se elimina la corrida.
	const sinEnviarPorCorrida = new Map<string, number>();
	for (const abierto of abiertos ?? []) {
		if (abierto.corrida_id) {
			sinEnviarPorCorrida.set(
				abierto.corrida_id,
				(sinEnviarPorCorrida.get(abierto.corrida_id) ?? 0) + 1
			);
		}
	}

	// Vienen ordenadas de la más nueva a la más vieja, así que la última es la primera.
	const ultima = (corridas ?? [])[0]?.id ?? null;

	return {
		mesa: { numero: mesa.numero, creada_en: mesa.creada_en },
		curso,
		escenario: mesa.escenario,
		corridas: (corridas ?? []).map((corrida) => ({
			id: corrida.id,
			numero: corrida.numero,
			habilitada: corrida.habilitada,
			creada_en: corrida.creada_en,
			evaluaciones: porCorrida.get(corrida.id) ?? 0,
			sinEnviar: sinEnviarPorCorrida.get(corrida.id) ?? 0,
			/**
			 * Deshacer una corrida sólo tiene sentido en la última, y sólo mientras
			 * nadie haya enviado nada en ella. Las dos condiciones las vuelve a
			 * comprobar `borrar_corrida()` en la base: esto es para saber si mostrar
			 * el botón, no para autorizar nada.
			 */
			sePuedeEliminar: corrida.id === ultima && (porCorrida.get(corrida.id) ?? 0) === 0,
			// Quiénes ocuparon cada rol, en el orden en que el modelo los enumera.
			participaciones: corrida.participaciones
				.map((p) => ({
					id: p.id,
					dni: p.dni,
					rolCodigo: p.rol_codigo,
					rolNombre: p.rol?.nombre ?? p.rol_codigo,
					orden: p.rol?.orden ?? 99,
					nombre: p.participante
						? `${p.participante.nombre} ${p.participante.apellido}`
						: null,
					evaluo: evaluadas.has(p.id)
				}))
				.sort((a, b) => a.orden - b.orden || (a.nombre ?? a.dni).localeCompare(b.nombre ?? b.dni))
		}))
	};
};

type Resumen = {
	numero: number;
	participaciones: number;
	checklists_abiertos: number;
	vuelve_a: number | null;
};

const cuantas = (n: number, singular: string, plural: string) =>
	`${n} ${n === 1 ? singular : plural}`;

export const actions: Actions = {
	/**
	 * Deshacer una corrida habilitada por error: se elimina y la mesa vuelve a la
	 * anterior. Las reglas —que sea la última y que no tenga evaluaciones enviadas—
	 * las hace cumplir `borrar_corrida()` en la base, todo dentro de una
	 * transacción, así el borrado y la reapertura de la anterior no pueden quedar a
	 * medias y no chocan con un líder que esté habilitando la siguiente.
	 */
	eliminarCorrida: async ({ request }) => {
		const formulario = await request.formData();
		const id = String(formulario.get('corridaId') ?? '');

		const rechazar = (estado: number, mensaje: string) => fail(estado, { mensaje, exito: null });

		if (!UUID.test(id)) return rechazar(400, 'Corrida inválida.');

		const { data, error: fallo } = await supabase.rpc('borrar_corrida', { p_corrida_id: id });

		if (fallo) {
			// Los tres casos son carreras: entre que se dibujó la pantalla y se tocó
			// el botón, alguien habilitó otra corrida o envió una evaluación.
			if (fallo.message.includes('ya no existe')) {
				return rechazar(404, 'Esa corrida ya no existe: alguien la eliminó antes.');
			}
			if (fallo.message.includes('ultima corrida')) {
				return rechazar(
					409,
					'Mientras tanto se habilitó otra corrida, así que ésta dejó de ser la última. Recargá la página.'
				);
			}
			if (fallo.message.includes('evaluaciones enviadas')) {
				return rechazar(
					409,
					'Mientras tanto alguien envió una evaluación en esta corrida, así que ya no se puede eliminar.'
				);
			}
			return rechazar(500, 'No se pudo eliminar la corrida. Intentá de nuevo.');
		}

		const resumen = data as unknown as Resumen;
		const arrastro =
			resumen.participaciones === 0
				? 'No se había identificado nadie en ella'
				: `Se fueron con ella ${cuantas(resumen.participaciones, 'rol ocupado', 'roles ocupados')}` +
					(resumen.checklists_abiertos > 0
						? ` y ${cuantas(resumen.checklists_abiertos, 'checklist abierto sin enviar', 'checklists abiertos sin enviar')}`
						: '');

		return {
			mensaje: null,
			exito:
				`La corrida ${resumen.numero} quedó eliminada. ${arrastro}. ` +
				(resumen.vuelve_a !== null
					? `La mesa vuelve a la corrida ${resumen.vuelve_a}, que quedó habilitada de nuevo.`
					: 'La mesa queda sin corridas: el líder puede habilitar la primera cuando corresponda.')
		};
	},

	/**
	 * Dar de baja el registro de quien entró con el rol equivocado, para que pueda
	 * volver a escanear y elegir bien. `unique (corrida_id, dni)` es lo que hace
	 * falta liberar: mientras el registro exista, el sistema lo lleva siempre al
	 * que ya tiene en lugar de dejarlo elegir de nuevo.
	 */
	eliminarParticipacion: async ({ request }) => {
		const formulario = await request.formData();
		const id = String(formulario.get('participacionId') ?? '');

		const rechazar = (estado: number, mensaje: string) => fail(estado, { mensaje, exito: null });

		if (!UUID.test(id)) return rechazar(400, 'Registro inválido.');

		const { data, error: fallo } = await supabase.rpc('borrar_participacion', {
			p_participacion_id: id
		});

		if (fallo) {
			if (fallo.message.includes('ya no existe')) {
				return rechazar(404, 'Ese registro ya no existe: alguien lo eliminó antes.');
			}
			if (fallo.message.includes('ya envio su checklist')) {
				return rechazar(
					409,
					'Esa persona ya envió su checklist, así que su registro no se puede eliminar. Su evaluación quedó hecha con ese rol.'
				);
			}
			return rechazar(500, 'No se pudo eliminar el registro. Intentá de nuevo.');
		}

		const resumen = data as unknown as { dni: string; rol: string; corrida: number; marcas: number };

		return {
			mensaje: null,
			exito:
				`El DNI ${mostrarDni(resumen.dni)} dejó de estar registrado como ${resumen.rol} en la corrida ${resumen.corrida}` +
				(resumen.marcas > 0
					? `, y con eso se fueron ${cuantas(resumen.marcas, 'marca que había hecho', 'marcas que había hecho')} con ese rol`
					: '') +
				'. Ya puede volver a escanear el QR y entrar con el rol correcto.'
		};
	}
};
