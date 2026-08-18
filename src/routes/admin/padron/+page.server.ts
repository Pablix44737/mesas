import { error, fail } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import { dniValido, mostrarDni, normalizarDni } from '$lib/dni';
import type { Actions, PageServerLoad } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Todas las acciones devuelven la misma forma, así la página lee `mensaje` y
 * `exito` sin más. `editando` lleva el id de la fila que quedó a medio editar:
 * distingue lo tipeado en una edición de lo tipeado en el alta, que comparten
 * los mismos nombres de campo.
 */
const vacio = { dni: '', nombre: '', apellido: '', campo: '', editando: null as string | null };

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

		const valores = { dni, nombre, apellido, editando: null };
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
	 * Corregir una carga equivocada. El nombre y el apellido son cosméticos, pero
	 * el DNI es la llave con que las mesas identifican a la persona: cambiarlo
	 * dispara el trigger del padrón, que suelta los registros que la apuntaban con
	 * el DNI viejo y adopta los que estaban esperando el nuevo. Por eso los dos
	 * números se cuentan antes de tocar nada y se informan después: si no, el
	 * administrador ve aparecer y desaparecer registros sin saber por qué.
	 */
	editar: async ({ request }) => {
		const formulario = await request.formData();
		const id = String(formulario.get('id') ?? '');
		const dni = normalizarDni(String(formulario.get('dni') ?? ''));
		const nombre = String(formulario.get('nombre') ?? '').trim();
		const apellido = String(formulario.get('apellido') ?? '').trim();

		const valores = { dni, nombre, apellido, editando: id };
		const rechazar = (estado: number, mensaje: string, campo: string) =>
			fail(estado, { ...valores, mensaje, campo, exito: null });

		if (!UUID.test(id)) return fail(400, { ...vacio, mensaje: 'Persona inválida.', exito: null });
		if (!dniValido(dni)) return rechazar(400, 'Ingresá el DNI, sin puntos.', 'dni');
		if (nombre.length < 2) return rechazar(400, 'Ingresá el nombre.', 'nombre');
		if (apellido.length < 2) return rechazar(400, 'Ingresá el apellido.', 'apellido');

		const { data: antes } = await supabase
			.from('participantes')
			.select('dni, nombre, apellido')
			.eq('id', id)
			.maybeSingle();

		if (!antes) return rechazar(404, 'Esa persona ya no está en el padrón.', '');

		if (antes.dni === dni && antes.nombre === nombre && antes.apellido === apellido) {
			return { ...vacio, mensaje: null, exito: 'No había nada que cambiar.' };
		}

		const cambiaElDni = antes.dni !== dni;

		// Se cuentan antes del update: después, el trigger ya movió los vínculos y
		// estos dos números serían imposibles de reconstruir.
		let sueltos = 0;
		let adoptados = 0;
		if (cambiaElDni) {
			const [{ count: conElViejo }, { count: conElNuevo }] = await Promise.all([
				supabase
					.from('participaciones')
					.select('id', { count: 'exact', head: true })
					.eq('participante_id', id),
				supabase
					.from('participaciones')
					.select('id', { count: 'exact', head: true })
					.eq('dni', dni)
			]);
			sueltos = conElViejo ?? 0;
			adoptados = conElNuevo ?? 0;
		}

		// El DNI se manda sólo si cambió: el trigger del padrón escucha esa columna
		// y no hay motivo para despertarlo cuando se corrige un nombre.
		const { error: fallo } = await supabase
			.from('participantes')
			.update(cambiaElDni ? { dni, nombre, apellido } : { nombre, apellido })
			.eq('id', id);

		if (fallo) {
			return fallo.code === '23505'
				? rechazar(409, `El DNI ${mostrarDni(dni)} ya es de otra persona del padrón.`, 'dni')
				: rechazar(500, 'No se pudieron guardar los cambios. Intentá de nuevo.', '');
		}

		const quien = `${apellido}, ${nombre}`;
		if (!cambiaElDni) {
			return { ...vacio, mensaje: null, exito: `Los datos de ${quien} quedaron actualizados.` };
		}

		const partes: string[] = [];
		if (sueltos > 0) {
			partes.push(
				sueltos === 1
					? 'El registro que tenía en las mesas quedó sin identificar, con el DNI viejo'
					: `Sus ${sueltos} registros en las mesas quedaron sin identificar, con el DNI viejo`
			);
		}
		if (adoptados > 0) {
			const texto =
				adoptados === 1
					? 'quedó resuelto 1 registro que esperaba el DNI nuevo'
					: `quedaron resueltos ${adoptados} registros que esperaban el DNI nuevo`;
			// Encabeza la frase o se cuelga de la anterior, según haya o no registros sueltos.
			partes.push(partes.length > 0 ? `y ${texto}` : texto[0].toUpperCase() + texto.slice(1));
		}

		return {
			...vacio,
			mensaje: null,
			exito:
				`El DNI de ${quien} pasó de ${mostrarDni(antes.dni)} a ${mostrarDni(dni)}.` +
				(partes.length > 0 ? ` ${partes.join(' ')}.` : '')
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
