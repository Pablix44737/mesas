import { error, fail, redirect } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import { avisar, leerAviso } from '$lib/server/aviso';
import { tenantActual } from '$lib/server/tenant';
import type { Actions, PageServerLoad } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * El código va a ser parte de la URL del QR, así que se deriva del nombre en vez
 * de pedírselo al administrador: sin tildes, sin espacios y acotado, que es lo
 * que la base exige. Si dos cursos derivan el mismo, se numera.
 */
function codigoDesde(nombre: string) {
	const base = nombre
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 40)
		.replace(/-+$/g, '');
	return base.length >= 2 ? base : 'curso';
}

export const load: PageServerLoad = async ({ locals, cookies }) => {
	const tenant = tenantActual(locals);
	const aviso = leerAviso(cookies, '/admin/cursos');

	// Los cursos primero: las mesas no llevan institución —la heredan del curso—,
	// así que acotarlas es acotarlas a estos cursos.
	const { data: cursos, error: fallo } = await supabase
		.from('cursos')
		.select('*')
		.eq('tenant_id', tenant)
		.order('archivado')
		.order('creado_en', { ascending: false });

	if (fallo) error(500, fallo.message);

	const idsDeCursos = (cursos ?? []).map((c) => c.id);

	const [{ data: mesas }, { data: destinatarios }] = await Promise.all([
		idsDeCursos.length > 0
			? supabase.from('mesas').select('id, curso_id').in('curso_id', idsDeCursos)
			: Promise.resolve({ data: [] }),
		supabase.from('destinatarios').select('*').order('orden')
	]);

	const idsDeMesas = (mesas ?? []).map((m) => m.id);

	const [{ data: corridas }, { data: enviadas }] =
		idsDeMesas.length > 0
			? await Promise.all([
					supabase.from('corridas').select('mesa_id, habilitada').in('mesa_id', idsDeMesas),
					supabase.from('evaluaciones_enviadas').select('mesa_id').in('mesa_id', idsDeMesas)
				])
			: [{ data: [] }, { data: [] }];

	// Cuánto trabajo tiene encima cada curso: es lo que distingue una tarjeta de otra.
	const cursoDeMesa = new Map((mesas ?? []).map((m) => [m.id, m.curso_id]));
	const contar = (filas: { mesa_id: string | null }[]) => {
		const por = new Map<string, number>();
		for (const fila of filas) {
			const curso = fila.mesa_id ? cursoDeMesa.get(fila.mesa_id) : undefined;
			if (curso) por.set(curso, (por.get(curso) ?? 0) + 1);
		}
		return por;
	};

	const corridasPorCurso = contar(corridas ?? []);
	// Una mesa con su ciclo habilitado es una mesa trabajando ahora mismo.
	const enCursoPorCurso = contar((corridas ?? []).filter((c) => c.habilitada));
	const evaluacionesPorCurso = contar(enviadas ?? []);
	const mesasPorCurso = new Map<string, number>();
	for (const mesa of mesas ?? []) {
		mesasPorCurso.set(mesa.curso_id, (mesasPorCurso.get(mesa.curso_id) ?? 0) + 1);
	}

	const nombreDelDestinatario = new Map((destinatarios ?? []).map((d) => [d.codigo, d.nombre]));

	return {
		aviso,
		destinatarios: destinatarios ?? [],
		cursos: (cursos ?? []).map((curso) => ({
			...curso,
			destinatario: nombreDelDestinatario.get(curso.destinado_a) ?? curso.destinado_a,
			mesas: mesasPorCurso.get(curso.id) ?? 0,
			corridas: corridasPorCurso.get(curso.id) ?? 0,
			mesasEnCurso: enCursoPorCurso.get(curso.id) ?? 0,
			evaluaciones: evaluacionesPorCurso.get(curso.id) ?? 0
		}))
	};
};

export const actions: Actions = {
	crear: async ({ request, locals, cookies }) => {
		const formulario = await request.formData();
		const nombre = String(formulario.get('nombre') ?? '').trim();
		const destinadoA = String(formulario.get('destinadoA') ?? '');

		// `campo` dice debajo de qué mostrar el error; vacío, es un error de todo el alta.
		const rechazar = (estado: number, mensaje: string, campo = '') =>
			fail(estado, { nombre, destinadoA, mensaje, campo, exito: null });

		if (nombre.length < 4) return rechazar(400, 'Escribí el nombre del curso.', 'nombre');
		if (!destinadoA) return rechazar(400, 'Elegí a quién está destinado el curso.', 'destinadoA');

		// El código se deriva del nombre; si ya está tomado, se le suma un número.
		const { data: existentes } = await supabase.from('cursos').select('codigo');
		const tomados = new Set((existentes ?? []).map((c) => c.codigo));
		const base = codigoDesde(nombre);
		let codigo = base;
		for (let n = 2; tomados.has(codigo); n++) codigo = `${base.slice(0, 38)}-${n}`;

		const { error: fallo } = await supabase
			.from('cursos')
			.insert({ nombre, codigo, destinado_a: destinadoA, tenant_id: tenantActual(locals) });

		if (fallo) {
			if (fallo.code === '23505') {
				return rechazar(409, `Ya hay un curso que se llama «${nombre}».`, 'nombre');
			}
			// Clave foránea: el destinatario que llegó no es ninguno de los cargados.
			if (fallo.code === '23503') return rechazar(400, 'Ese destinatario no existe.', 'destinadoA');
			return rechazar(500, 'No se pudo crear el curso. Intentá de nuevo.');
		}

		// Recién creado, lo que sigue es mirarlo: se va a su pantalla con el aviso.
		const ruta = `/admin/cursos/${codigo}`;
		avisar(cookies, ruta, `«${nombre}» quedó creado. Ya podés darle mesas.`);
		redirect(303, ruta);
	},

	/**
	 * Archivar no borra nada: saca al curso del frente para que las ediciones
	 * viejas no compitan por la atención con la que está en marcha. Sus mesas y
	 * evaluaciones siguen consultándose igual.
	 */
	archivar: async ({ request, locals }) => {
		const formulario = await request.formData();
		const id = String(formulario.get('id') ?? '');
		const archivado = formulario.get('archivado') === 'true';

		const rechazar = (estado: number, mensaje: string) =>
			fail(estado, { nombre: '', destinadoA: '', mensaje, campo: '', exito: null });

		if (!UUID.test(id)) return rechazar(400, 'Curso inválido.');

		// Acotado a la institución de la sesión: el id viene del formulario, así que
		// sin esto se podría archivar el curso de otra mandando el suyo.
		const { data: curso, error: fallo } = await supabase
			.from('cursos')
			.update({ archivado })
			.eq('id', id)
			.eq('tenant_id', tenantActual(locals))
			.select('nombre')
			.maybeSingle();

		if (fallo) return rechazar(400, 'No se pudo cambiar el estado del curso. Intentá de nuevo.');
		if (!curso) return rechazar(404, 'Ese curso ya no existe.');

		return {
			nombre: '',
			destinadoA: '',
			mensaje: null,
			campo: '',
			exito: archivado
				? `«${curso.nombre}» quedó archivado. Sus mesas se siguen consultando.`
				: `«${curso.nombre}» volvió a los cursos en marcha.`
		};
	}
};
