import { error, fail } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import type { Actions, PageServerLoad } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * El código de la institución, derivado del nombre como el de los cursos: no se
 * lo pedimos a nadie. No va en ninguna URL —la del QR lleva el código del curso,
 * que es global—, pero sirve para nombrar la institución en una línea y es lo que
 * se escribe para confirmar que se le restablece la clave.
 *
 * El formato lo exige `tenants_codigo_formato`: empieza con letra o número y
 * tiene entre 2 y 24 caracteres.
 */
const LARGO = 24;

function codigoDesde(nombre: string) {
	const base = nombre
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, LARGO)
		.replace(/-+$/g, '');
	return base.length >= 2 ? base : 'institucion';
}

export const load: PageServerLoad = async () => {
	const { data: instituciones, error: fallo } = await supabase
		.from('instituciones_resumen')
		.select('*')
		.order('nombre');

	if (fallo) error(500, fallo.message);

	return { instituciones: instituciones ?? [] };
};

export const actions: Actions = {
	/**
	 * Dar de alta una institución. La fila y el hash de su clave se crean en la
	 * misma transacción, dentro de `crear_institucion()`: así no existe el estado
	 * intermedio de una institución sin clave, que cualquiera podría abrir.
	 *
	 * La clave no se devuelve ni se muestra después. Quien la escribió la conoce;
	 * dejarla en la respuesta la pondría en el historial del navegador y en
	 * cualquier registro de por medio, para no decir nada que no se sepa ya.
	 */
	crear: async ({ request }) => {
		const formulario = await request.formData();
		const nombre = String(formulario.get('nombre') ?? '').trim();
		const clave = String(formulario.get('clave') ?? '');

		const rechazar = (estado: number, mensaje: string) =>
			fail(estado, { nombre, mensaje, exito: null });

		if (nombre.length < 4) return rechazar(400, 'Escribí el nombre de la institución.');
		if (clave.length < 8) return rechazar(400, 'La clave tiene que tener al menos 8 caracteres.');

		// Si el código derivado ya está tomado, se le suma un número. Es el mismo
		// criterio que el de los cursos.
		const { data: existentes } = await supabase.from('tenants').select('codigo');
		const tomados = new Set((existentes ?? []).map((t) => t.codigo));
		const base = codigoDesde(nombre);
		let codigo = base;
		for (let n = 2; tomados.has(codigo); n++) {
			const sufijo = `-${n}`;
			codigo = base.slice(0, LARGO - sufijo.length).replace(/-+$/g, '') + sufijo;
		}

		const { data, error: fallo } = await supabase.rpc('crear_institucion', {
			p_nombre: nombre,
			p_codigo: codigo,
			p_clave: clave
		});

		if (fallo) {
			if (fallo.message.includes('ese nombre')) {
				return rechazar(409, `Ya hay una institución que se llama «${nombre}».`);
			}
			if (fallo.message.includes('ese codigo')) {
				return rechazar(409, 'El código que sale de ese nombre ya está tomado. Probá con otro.');
			}
			if (fallo.message.includes('al menos 8')) {
				return rechazar(400, 'La clave tiene que tener al menos 8 caracteres.');
			}
			if (fallo.message.includes('demasiado corto')) {
				return rechazar(400, 'Escribí el nombre de la institución.');
			}
			return rechazar(500, 'No se pudo crear la institución. Intentá de nuevo.');
		}

		const creada = data as unknown as { nombre: string; codigo: string };

		return {
			nombre: '',
			mensaje: null,
			exito:
				`«${creada.nombre}» quedó creada, con el código ${creada.codigo}. ` +
				'Pasale la clave a quien la va a administrar: el sistema no la vuelve a mostrar.'
		};
	},

	/**
	 * Restablecer la clave de una institución, que es lo que hoy obligaba a abrir
	 * la base. Deja afuera a quien tenga la anterior, así que se confirma
	 * escribiendo el código a mano —y el código contra el que se compara sale de
	 * la base y no del formulario, igual que al eliminar una mesa o un curso: si
	 * viniera del cliente, quien manda el pedido elegiría a la vez qué cambiar y
	 * contra qué se comprueba.
	 */
	restablecerClave: async ({ request }) => {
		const formulario = await request.formData();
		const id = String(formulario.get('id') ?? '');
		const clave = String(formulario.get('clave') ?? '');
		const confirmacion = String(formulario.get('confirmacion') ?? '')
			.trim()
			.toLowerCase();

		const rechazar = (estado: number, mensaje: string) =>
			fail(estado, { mensaje, exito: null, restableciendo: id });

		if (!UUID.test(id)) return rechazar(400, 'Elegí la institución.');

		const { data: institucion } = await supabase
			.from('tenants')
			.select('nombre, codigo')
			.eq('id', id)
			.maybeSingle();

		if (!institucion) return rechazar(404, 'Esa institución ya no existe.');

		if (confirmacion !== institucion.codigo) {
			return rechazar(
				400,
				`Para restablecer la clave hay que escribir el código de la institución: ${institucion.codigo}.`
			);
		}

		if (clave.length < 8) return rechazar(400, 'La clave tiene que tener al menos 8 caracteres.');

		const { error: fallo } = await supabase.rpc('fijar_clave_del_tenant', {
			p_tenant_id: id,
			p_clave: clave
		});

		if (fallo) {
			if (fallo.message.includes('no existe')) return rechazar(404, 'Esa institución ya no existe.');
			if (fallo.message.includes('al menos 8')) {
				return rechazar(400, 'La clave tiene que tener al menos 8 caracteres.');
			}
			return rechazar(500, 'No se pudo cambiar la clave. Intentá de nuevo.');
		}

		return {
			nombre: '',
			mensaje: null,
			restableciendo: null,
			exito:
				`«${institucion.nombre}» quedó con una clave nueva. ` +
				'Las sesiones que ya estaban abiertas con la anterior siguen valiendo hasta 12 horas.'
		};
	}
};
