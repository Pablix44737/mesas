import { error, fail } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import { dniValido, normalizarDni } from '$lib/dni';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [{ data: padron, error: fallo }, { data: pendientes }] = await Promise.all([
		supabase.from('participantes').select('id, dni, nombre, apellido').order('apellido'),
		supabase
			.from('participaciones_sin_resolver')
			.select('*')
			.order('dni')
			.order('mesa_numero')
			.order('corrida_numero')
	]);

	if (fallo) error(500, fallo.message);

	// Un mismo DNI desconocido puede haber ocupado roles en varias corridas:
	// se incorpora una sola vez y se resuelven todos sus registros.
	const porDni = new Map<string, { dni: string; registros: string[] }>();
	for (const p of pendientes ?? []) {
		const dni = p.dni ?? '';
		const entrada = porDni.get(dni) ?? { dni, registros: [] };
		entrada.registros.push(
			`Mesa ${p.mesa_numero} · corrida ${p.corrida_numero} · ${p.rol_nombre}`
		);
		porDni.set(dni, entrada);
	}

	return {
		padron: padron ?? [],
		pendientes: [...porDni.values()]
	};
};

export const actions: Actions = {
	incorporar: async ({ request }) => {
		const formulario = await request.formData();
		const dni = normalizarDni(String(formulario.get('dni') ?? ''));
		const nombre = String(formulario.get('nombre') ?? '').trim();
		const apellido = String(formulario.get('apellido') ?? '').trim();

		const valores = { dni, nombre, apellido };
		const rechazar = (estado: number, mensaje: string, campo: string) =>
			fail(estado, { ...valores, mensaje, campo, exito: null });

		if (!dniValido(dni)) return rechazar(400, 'Ingresá el DNI, sin puntos.', 'dni');
		if (nombre.length < 2) return rechazar(400, 'Ingresá el nombre.', 'nombre');
		if (apellido.length < 2) return rechazar(400, 'Ingresá el apellido.', 'apellido');

		const { error: fallo } = await supabase
			.from('participantes')
			.insert({ dni, nombre, apellido });

		if (fallo) {
			return fallo.code === '23505'
				? rechazar(409, `El DNI ${dni} ya está en el padrón.`, 'dni')
				: rechazar(500, 'No se pudo incorporar a la persona. Intentá de nuevo.', '');
		}

		// El trigger del padrón resuelve solo las participaciones que esperaban este DNI.
		const { count } = await supabase
			.from('participaciones')
			.select('id', { count: 'exact', head: true })
			.eq('dni', dni);

		const registros = count ?? 0;
		return {
			dni: '',
			nombre: '',
			apellido: '',
			mensaje: null,
			campo: '',
			exito:
				registros > 0
					? `${nombre} ${apellido} quedó en el padrón, y con eso ${registros === 1 ? 'se resolvió 1 registro que lo esperaba' : `se resolvieron ${registros} registros que lo esperaban`}.`
					: `${nombre} ${apellido} quedó incorporado al padrón.`
		};
	}
};
