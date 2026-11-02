import { error, fail, redirect } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import { tenantActual } from '$lib/server/tenant';
import { mostrarDni } from '$lib/dni';
import { mesaDelCurso } from '$lib/server/mesas';
import { avisar } from '$lib/server/aviso';
import { evaluacionesDeLaCorrida } from '$lib/server/evaluaciones';
import { rolesDelDestinatario } from '$lib/server/roles';
import type { Actions, PageServerLoad } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Si ese ciclo —o esa participación— es de esta mesa.
 *
 * Los ids de las acciones destructivas vienen del formulario, así que comprobar
 * la mesa es lo que impide que, cambiándolos, se borre algo de otra institución.
 * Un ciclo cuelga de la mesa; una participación, del ciclo.
 */
async function esDeLaMesa(tabla: 'corridas' | 'participaciones', id: string, mesaId: string) {
	if (tabla === 'corridas') {
		const { data } = await supabase
			.from('corridas')
			.select('id')
			.eq('id', id)
			.eq('mesa_id', mesaId)
			.maybeSingle();
		return data !== null;
	}

	const { data } = await supabase
		.from('participaciones')
		.select('id, corrida:corridas!inner(mesa_id)')
		.eq('id', id)
		.eq('corridas.mesa_id', mesaId)
		.maybeSingle();
	return data !== null;
}

export const load: PageServerLoad = async ({ params, locals, url }) => {
	const { curso, mesa: encontrada } = await mesaDelCurso(params.curso, params.numero, tenantActual(locals));

	const mesa = {
		id: encontrada.id,
		numero: encontrada.numero,
		creada_en: encontrada.creada_en,
		escenario: encontrada.escenario
			? { id: encontrada.escenario.id, nombre: encontrada.escenario.nombre }
			: null
	};

	const [{ data: corridas }, { data: evaluaciones }, { data: abiertos }, roles] = await Promise.all([
		supabase
			.from('corridas')
			.select(
				`id, numero, habilitada, creada_en,
				 participaciones(
					id, dni, rol_codigo,
					rol:roles(nombre, orden, observador),
					participante:participantes(nombre, apellido)
				 )`
			)
			.eq('mesa_id', mesa.id)
			.order('numero', { ascending: false }),
		supabase
			.from('evaluaciones_enviadas')
			.select('corrida_id, participacion_id, enviada_en')
			.eq('mesa_id', mesa.id),
		supabase
			.from('checklists_sin_enviar')
			.select('corrida_id, participacion_id, marcados')
			.eq('mesa_id', mesa.id),
		// Los roles que se ocupan en un curso como este: los que falten en el ciclo
		// en curso son los que el líder todavía tiene que conseguir.
		rolesDelDestinatario(curso.destinado_a)
	]);

	const enviadaEn = new Map((evaluaciones ?? []).map((e) => [e.participacion_id, e.enviada_en]));
	const marcasAbiertas = new Map((abiertos ?? []).map((a) => [a.participacion_id, a.marcados ?? 0]));
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

	// Las evaluaciones de un ciclo se abren en un panel; cuál, lo dice la dirección.
	const cicloPedido = Number(url.searchParams.get('ciclo'));
	const cicloAbierto = (corridas ?? []).find((c) => c.numero === cicloPedido) ?? null;

	return {
		mesa: { id: mesa.id, numero: mesa.numero, creada_en: mesa.creada_en },
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
			// Los que nadie ocupó, sólo mientras el ciclo está en curso: después ya no
			// hay a quién avisarle.
			sinOcupar: corrida.habilitada
				? roles
						.filter((rol) => !corrida.participaciones.some((p) => p.rol_codigo === rol.codigo))
						.map((rol) => ({ codigo: rol.codigo, nombre: rol.nombre }))
				: [],
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
					evaluo: enviadaEn.has(p.id),
					enviadaEn: enviadaEn.get(p.id) ?? null,
					observador: p.rol?.observador ?? false,
					// Un checklist abierto sin enviar, con cuántas marcas lleva.
					marcas: marcasAbiertas.get(p.id) ?? null
				}))
				.sort((a, b) => a.orden - b.orden || (a.nombre ?? a.dni).localeCompare(b.nombre ?? b.dni))
		})),
		evaluacionesDelCiclo: cicloAbierto
			? {
					numero: cicloAbierto.numero,
					enCurso: cicloAbierto.habilitada,
					desde: cicloAbierto.creada_en,
					evaluaciones: await evaluacionesDeLaCorrida(cicloAbierto.id)
				}
			: null
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
	 * Eliminar la mesa se lleva puesto todo lo que colgó de ella: sus corridas,
	 * quiénes ocuparon cada rol y las evaluaciones que se hicieron, enviadas o no.
	 * No hay vuelta atrás, así que el número de mesa se escribe a mano: es el único
	 * paso de todo el sistema que destruye trabajo de otras personas.
	 *
	 * Contar y borrar pasan dentro de `borrar_mesa()`, en una sola transacción, así
	 * lo que se informa es lo que de verdad se destruyó y no lo que había cuando se
	 * dibujó la confirmación. El número contra el que se confirma sale de la base,
	 * no del formulario.
	 */
	eliminarMesa: async ({ request, params, locals, cookies }) => {
		const { curso, mesa } = await mesaDelCurso(params.curso, params.numero, tenantActual(locals));

		const confirmacion = String((await request.formData()).get('confirmacion') ?? '').trim();
		const rechazar = (estado: number, mensaje: string) =>
			fail(estado, { mensaje, exito: null, eliminandoMesa: true });

		if (confirmacion !== String(mesa.numero)) {
			return rechazar(400, `Para eliminarla hay que escribir el número de la mesa: ${mesa.numero}.`);
		}

		const { data, error: fallo } = await supabase.rpc('borrar_mesa', { p_mesa_id: mesa.id });

		if (fallo) {
			return rechazar(
				fallo.code === 'P0002' ? 404 : 500,
				fallo.code === 'P0002'
					? 'Esa mesa ya no existe: alguien la eliminó antes.'
					: 'No se pudo eliminar la mesa. Intentá de nuevo.'
			);
		}

		const resumen = data as unknown as {
			numero: number;
			corridas: number;
			participaciones: number;
			evaluaciones: number;
			enviadas: number;
		};

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
		const texto =
			resumen.corridas === 0
				? `La mesa ${resumen.numero} quedó eliminada.`
				: `La mesa ${resumen.numero} quedó eliminada, y con ella ` +
					`${cuantas(resumen.corridas, 'ciclo', 'ciclos')}, ` +
					`${cuantas(resumen.participaciones, 'rol ocupado', 'roles ocupados')} y ` +
					`${evaluaciones()}. El padrón y el material del escenario quedaron intactos.`;

		const ruta = `/admin/cursos/${curso.codigo}`;
		avisar(cookies, ruta, texto);
		redirect(303, ruta);
	},

	/**
	 * Deshacer una corrida habilitada por error: se elimina y la mesa vuelve a la
	 * anterior. Las reglas —que sea la última y que no tenga evaluaciones enviadas—
	 * las hace cumplir `borrar_corrida()` en la base, todo dentro de una
	 * transacción, así el borrado y la reapertura de la anterior no pueden quedar a
	 * medias y no chocan con un líder que esté habilitando la siguiente.
	 */
	eliminarCorrida: async ({ request, params, locals }) => {
		const { mesa } = await mesaDelCurso(params.curso, params.numero, tenantActual(locals));

		const formulario = await request.formData();
		const id = String(formulario.get('corridaId') ?? '');

		const rechazar = (estado: number, mensaje: string) => fail(estado, { mensaje, exito: null });

		if (!UUID.test(id)) return rechazar(400, 'Ciclo inválido.');

		// Que el ciclo sea de la mesa de la URL, que ya está acotada a la institución
		// de la sesión: el id viene del formulario y sin esto alcanzaría con mandar
		// el de un ciclo de otra institución.
		if (!(await esDeLaMesa('corridas', id, mesa.id))) {
			return rechazar(404, 'Ese ciclo no es de esta mesa.');
		}

		const { data, error: fallo } = await supabase.rpc('borrar_corrida', { p_corrida_id: id });

		if (fallo) {
			// Los tres casos son carreras: entre que se dibujó la pantalla y se tocó
			// el botón, alguien habilitó otra corrida o envió una evaluación.
			if (fallo.message.includes('ya no existe')) {
				return rechazar(404, 'Ese ciclo ya no existe: alguien lo eliminó antes.');
			}
			if (fallo.message.includes('ultima corrida')) {
				return rechazar(
					409,
					'Mientras tanto se habilitó otro ciclo, así que este dejó de ser el último. Recargá la página.'
				);
			}
			if (fallo.message.includes('evaluaciones enviadas')) {
				return rechazar(
					409,
					'Mientras tanto alguien envió una evaluación en este ciclo, así que ya no se puede eliminar.'
				);
			}
			return rechazar(500, 'No se pudo eliminar el ciclo. Intentá de nuevo.');
		}

		const resumen = data as unknown as Resumen;
		const arrastro =
			resumen.participaciones === 0
				? 'No se había identificado nadie en él'
				: `Se fueron con él ${cuantas(resumen.participaciones, 'rol ocupado', 'roles ocupados')}` +
					(resumen.checklists_abiertos > 0
						? ` y ${cuantas(resumen.checklists_abiertos, 'checklist abierto sin enviar', 'checklists abiertos sin enviar')}`
						: '');

		return {
			mensaje: null,
			exito:
				`El ciclo ${resumen.numero} quedó eliminado. ${arrastro}. ` +
				(resumen.vuelve_a !== null
					? `La mesa vuelve al ciclo ${resumen.vuelve_a}, que quedó habilitado de nuevo.`
					: 'La mesa queda sin ciclos: el líder puede habilitar el primero cuando corresponda.')
		};
	},

	/**
	 * Dar de baja el registro de quien entró con el rol equivocado, para que pueda
	 * volver a escanear y elegir bien. `unique (corrida_id, dni)` es lo que hace
	 * falta liberar: mientras el registro exista, el sistema lo lleva siempre al
	 * que ya tiene en lugar de dejarlo elegir de nuevo.
	 */
	eliminarParticipacion: async ({ request, params, locals }) => {
		const { mesa } = await mesaDelCurso(params.curso, params.numero, tenantActual(locals));

		const formulario = await request.formData();
		const id = String(formulario.get('participacionId') ?? '');

		const rechazar = (estado: number, mensaje: string) => fail(estado, { mensaje, exito: null });

		if (!UUID.test(id)) return rechazar(400, 'Registro inválido.');

		// Mismo motivo que arriba: el id lo manda el formulario.
		if (!(await esDeLaMesa('participaciones', id, mesa.id))) {
			return rechazar(404, 'Ese registro no es de esta mesa.');
		}

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
					'Esa persona ya envió su checklist, así que su registro no se puede eliminar.'
				);
			}
			return rechazar(500, 'No se pudo eliminar el registro. Intentá de nuevo.');
		}

		const resumen = data as unknown as { dni: string; rol: string; corrida: number; marcas: number };

		return {
			mensaje: null,
			exito:
				`El DNI ${mostrarDni(resumen.dni)} dejó de estar registrado como ${resumen.rol} en el ciclo ${resumen.corrida}` +
				(resumen.marcas > 0
					? `, y con eso se fueron ${cuantas(resumen.marcas, 'marca que había hecho', 'marcas que había hecho')} con ese rol`
					: '') +
				'. Ya puede volver a escanear el QR y entrar con el rol correcto.'
		};
	}
};
