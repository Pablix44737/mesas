import { error, fail, redirect } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import { avisar, leerAviso } from '$lib/server/aviso';
import { tenantActual } from '$lib/server/tenant';
import type { Actions, PageServerLoad } from './$types';

async function traerCurso(codigo: string, tenantId: string) {
	const { data, error: fallo } = await supabase
		.from('cursos')
		.select('*')
		.eq('codigo', codigo)
		.eq('tenant_id', tenantId)
		.maybeSingle();

	if (fallo) error(500, fallo.message);
	if (!data) error(404, 'El curso no existe');

	return data;
}

export const load: PageServerLoad = async ({ params, locals, cookies }) => {
	const curso = await traerCurso(params.curso, tenantActual(locals));
	const aviso = leerAviso(cookies, `/admin/cursos/${curso.codigo}`);

	const { data: mesas } = await supabase
		.from('mesas')
		.select('id, numero, escenario:escenarios(nombre), corridas(id, numero, habilitada, creada_en)')
		.eq('curso_id', curso.id)
		.order('numero');

	const idsDeMesas = (mesas ?? []).map((m) => m.id);
	const corridasDelCurso = (mesas ?? []).flatMap((mesa) => mesa.corridas.map((c) => c.id));
	const enCurso = (mesas ?? []).flatMap((mesa) =>
		mesa.corridas.filter((c) => c.habilitada).map((c) => c.id)
	);

	// El destinatario decide qué roles se ocupan, así que mientras nadie haya
	// declarado uno todavía se puede corregir. Después no: quedarían
	// participaciones con roles que el curso ya no admite.
	const [{ data: destinatarios }, { data: evaluaciones }, { data: ocupados }, { data: abiertos }] =
		await Promise.all([
			supabase.from('destinatarios').select('*').order('orden'),
			idsDeMesas.length > 0
				? supabase.from('evaluaciones_enviadas').select('mesa_id').in('mesa_id', idsDeMesas)
				: Promise.resolve({ data: [] }),
			corridasDelCurso.length > 0
				? supabase.from('participaciones').select('corrida_id').in('corrida_id', corridasDelCurso)
				: Promise.resolve({ data: [] }),
			// Lo que quedó abierto en los ciclos en curso: es lo que todavía puede
			// llegar, y lo que se pierde si el líder pasa de ciclo sin enviarlo.
			enCurso.length > 0
				? supabase.from('checklists_sin_enviar').select('corrida_id').in('corrida_id', enCurso)
				: Promise.resolve({ data: [] })
		]);

	const contar = <T>(filas: T[], clave: (fila: T) => string | null) => {
		const por = new Map<string, number>();
		for (const fila of filas) {
			const k = clave(fila);
			if (k) por.set(k, (por.get(k) ?? 0) + 1);
		}
		return por;
	};
	const evaluacionesPorMesa = contar(evaluaciones ?? [], (e) => e.mesa_id);
	const rolesPorCorrida = contar(ocupados ?? [], (p) => p.corrida_id);
	const abiertosPorCorrida = contar(abiertos ?? [], (a) => a.corrida_id);

	return {
		aviso,
		curso,
		destinatarios: destinatarios ?? [],
		rolesYaOcupados: (ocupados ?? []).length,
		mesas: (mesas ?? []).map((mesa) => {
			const ciclos = [...mesa.corridas].sort((a, b) => a.numero - b.numero);
			const actual = ciclos.find((c) => c.habilitada) ?? null;
			return {
				id: mesa.id,
				numero: mesa.numero,
				escenario: mesa.escenario?.nombre ?? null,
				ciclos: ciclos.map((c) => ({ numero: c.numero, enCurso: c.habilitada })),
				evaluaciones: evaluacionesPorMesa.get(mesa.id) ?? 0,
				enCurso: actual
					? {
							numero: actual.numero,
							desde: actual.creada_en,
							roles: rolesPorCorrida.get(actual.id) ?? 0,
							abiertos: abiertosPorCorrida.get(actual.id) ?? 0
						}
					: null
			};
		})
	};
};

export const actions: Actions = {
	/**
	 * Corregir el nombre, el destinatario o los dos, de una vez. El código no se
	 * toca: va a estar impreso en los QR.
	 *
	 * El destinatario lo cambia `cambiar_el_destinatario()`, que lo rechaza si ya se
	 * declaró algún rol: el destinatario decide cuáles se ocupan, y cambiarlo
	 * después dejaría participaciones con roles que su propio curso ya no admite.
	 */
	editar: async ({ request, params, locals }) => {
		const curso = await traerCurso(params.curso, tenantActual(locals));

		const formulario = await request.formData();
		const nombre = String(formulario.get('nombre') ?? '').trim();
		const destinadoA = String(formulario.get('destinadoA') ?? curso.destinado_a);

		// `editando` reabre el panel con lo elegido aunque no haya JavaScript.
		const rechazar = (estado: number, mensaje: string, campo = '') =>
			fail(estado, { mensaje, campo, exito: null, editando: true, nombre, destinadoA });

		if (nombre.length < 4) return rechazar(400, 'El nombre no puede quedar vacío.', 'nombre');

		const cambiaElNombre = nombre !== curso.nombre;
		const cambiaElDestinatario = destinadoA !== curso.destinado_a;
		if (!cambiaElNombre && !cambiaElDestinatario) {
			return { mensaje: null, campo: '', exito: 'No había nada que cambiar.' };
		}

		// El destinatario primero: es lo que puede no estar permitido, y así un
		// rechazo no deja el nombre cambiado a medias.
		if (cambiaElDestinatario) {
			const { error: fallo } = await supabase.rpc('cambiar_el_destinatario', {
				p_curso_id: curso.id,
				p_destinatario: destinadoA
			});

			if (fallo) {
				if (fallo.message.includes('ya no existe')) return rechazar(404, 'Ese curso ya no existe.');
				if (fallo.message.includes('roles ocupados')) {
					return rechazar(
						409,
						'En este curso ya se ocuparon roles, así que su destinatario no se puede cambiar.',
						'destinadoA'
					);
				}
				if (fallo.message.includes('destinatario no existe')) {
					return rechazar(400, 'Elegí uno de los destinatarios de la lista.', 'destinadoA');
				}
				return rechazar(500, 'No se pudo cambiar el destinatario. Intentá de nuevo.');
			}
		}

		if (cambiaElNombre) {
			const { error: fallo } = await supabase.from('cursos').update({ nombre }).eq('id', curso.id);

			if (fallo) {
				return fallo.code === '23505'
					? rechazar(409, `Ya hay otro curso que se llama «${nombre}».`, 'nombre')
					: rechazar(400, 'No se pudo cambiar el nombre. Intentá de nuevo.');
			}
		}

		const mensajes = [];
		if (cambiaElNombre) mensajes.push(`El curso ahora se llama «${nombre}».`);
		if (cambiaElDestinatario) mensajes.push(`«${nombre}» quedó con su destinatario corregido.`);

		return { mensaje: null, campo: '', exito: mensajes.join(' ') };
	},

	/**
	 * Archivar no borra nada: saca al curso del frente para que las ediciones
	 * viejas no compitan por la atención con la que está en marcha. Sus mesas y
	 * evaluaciones siguen consultándose igual.
	 */
	archivar: async ({ request, params, locals }) => {
		const curso = await traerCurso(params.curso, tenantActual(locals));
		const archivado = (await request.formData()).get('archivado') === 'true';

		const { error: fallo } = await supabase
			.from('cursos')
			.update({ archivado })
			.eq('id', curso.id);

		if (fallo) {
			return fail(400, {
				mensaje: 'No se pudo cambiar el estado del curso. Intentá de nuevo.',
				campo: '',
				exito: null
			});
		}

		return {
			mensaje: null,
			campo: '',
			exito: archivado
				? `«${curso.nombre}» quedó archivado. Sus mesas se siguen consultando.`
				: `«${curso.nombre}» volvió a los cursos en marcha.`
		};
	},

	/**
	 * Eliminar el curso entero: sus mesas, y con ellas todo lo que colgó de cada
	 * una. Es pensado para los cursos de prueba; una edición real que terminó se
	 * archiva. Se confirma escribiendo el nombre, y el nombre contra el que se
	 * compara sale de la base y no del formulario.
	 *
	 * `borrar_curso()` cuenta y borra en una sola transacción.
	 */
	eliminarCurso: async ({ request, params, locals, cookies }) => {
		const curso = await traerCurso(params.curso, tenantActual(locals));

		const formulario = await request.formData();
		const confirmacion = String(formulario.get('confirmacion') ?? '').trim();

		const rechazar = (estado: number, mensaje: string) =>
			fail(estado, { mensaje, campo: '', exito: null, eliminandoCurso: true });

		// Sin distinguir mayúsculas ni espacios de más: lo que se pide es intención,
		// no exactitud tipográfica.
		const normalizar = (texto: string) => texto.toLocaleLowerCase('es').replace(/\s+/g, ' ').trim();
		if (normalizar(confirmacion) !== normalizar(curso.nombre)) {
			return rechazar(400, `Para eliminarlo hay que escribir el nombre del curso: «${curso.nombre}».`);
		}

		const { error: fallo } = await supabase.rpc('borrar_curso', { p_curso_id: curso.id });

		if (fallo) {
			return rechazar(
				fallo.code === 'P0002' ? 404 : 500,
				fallo.code === 'P0002'
					? 'Ese curso ya no existe: alguien lo eliminó antes.'
					: 'No se pudo eliminar el curso. Intentá de nuevo.'
			);
		}

		avisar(cookies, '/admin/cursos', `«${curso.nombre}» quedó eliminado.`);
		redirect(303, '/admin/cursos');
	}
};

