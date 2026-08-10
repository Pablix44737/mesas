import { error, fail } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import { dniValido, normalizarDni } from '$lib/dni';
import type { Actions, PageServerLoad } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Todas las acciones devuelven la misma forma, así la página lee `mensaje` y `exito` sin más. */
const vacio = { dni: '', nombre: '', apellido: '', campo: '' };

export const load: PageServerLoad = async () => {
	const [{ data: padron, error: fallo }, { data: pendientes }, { data: registros }] =
		await Promise.all([
			supabase.from('participantes').select('id, dni, nombre, apellido').order('apellido'),
			supabase
				.from('participaciones_sin_resolver')
				.select('*')
				.order('dni')
				.order('mesa_numero')
				.order('corrida_numero'),
			supabase.from('participaciones').select('participante_id')
		]);

	if (fallo) error(500, fallo.message);

	// Cuántos roles ocupó cada persona: es lo que hay que saber antes de quitarla.
	const conteo = new Map<string, number>();
	for (const registro of registros ?? []) {
		if (registro.participante_id) {
			conteo.set(registro.participante_id, (conteo.get(registro.participante_id) ?? 0) + 1);
		}
	}

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
		padron: (padron ?? []).map((persona) => ({
			...persona,
			registros: conteo.get(persona.id) ?? 0
		})),
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
			...vacio,
			mensaje: null,
			exito:
				registros > 0
					? `${nombre} ${apellido} quedó en el padrón, y con eso ${registros === 1 ? 'se resolvió 1 registro que estaba esperando ese DNI' : `se resolvieron ${registros} registros que estaban esperando ese DNI`}.`
					: `${nombre} ${apellido} quedó incorporado al padrón.`
		};
	},

	/**
	 * Quitar a alguien del padrón no borra lo que hizo en las mesas: sus
	 * participaciones y evaluaciones quedan, con el DNI, pero sin nombre. Si se lo
	 * vuelve a incorporar, se resuelven solas.
	 */
	quitar: async ({ request }) => {
		const formulario = await request.formData();
		const id = String(formulario.get('id') ?? '');

		const rechazar = (estado: number, mensaje: string) =>
			fail(estado, { ...vacio, mensaje, exito: null });

		if (!UUID.test(id)) return rechazar(400, 'Persona inválida.');

		const { data: persona } = await supabase
			.from('participantes')
			.select('nombre, apellido')
			.eq('id', id)
			.maybeSingle();

		if (!persona) return rechazar(404, 'Esa persona ya no está en el padrón.');

		const { count } = await supabase
			.from('participaciones')
			.select('id', { count: 'exact', head: true })
			.eq('participante_id', id);

		const { error: fallo } = await supabase.from('participantes').delete().eq('id', id);

		if (fallo) return rechazar(400, 'No se pudo quitar a la persona. Intentá de nuevo.');

		const registros = count ?? 0;
		return {
			...vacio,
			mensaje: null,
			exito:
				registros > 0
					? `${persona.nombre} ${persona.apellido} salió del padrón. ${registros === 1 ? 'Su registro quedó sin identificar, con el DNI. Si esa persona vuelve al padrón, se resuelve solo.' : `Sus ${registros} registros quedaron sin identificar, con el DNI. Si esa persona vuelve al padrón, se resuelven solos.`}`
					: `${persona.nombre} ${persona.apellido} salió del padrón.`
		};
	}
};
