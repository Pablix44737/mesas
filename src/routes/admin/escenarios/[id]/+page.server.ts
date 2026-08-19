import { error, fail } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import {
	TAMANO_MAXIMO,
	extensionDe,
	tipoAceptado,
	tipoNormalizado
} from '$lib/planificacion';
import type { Escenario } from '$lib/tipos';
import type { Actions, PageServerLoad } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUCKET = 'planificaciones';

/** Todas las acciones devuelven la misma forma, así la página lee `mensaje` y `exito` sin más. */
const rechazar = (estado: number, mensaje: string) => fail(estado, { mensaje, exito: null });

async function traerEscenario(id: string): Promise<Escenario> {
	if (!UUID.test(id)) error(404, 'El escenario no existe');

	const { data, error: fallo } = await supabase
		.from('escenarios')
		.select('*')
		.eq('id', id)
		.maybeSingle<Escenario>();

	if (fallo) error(500, fallo.message);
	if (!data) error(404, 'El escenario no existe');

	return data;
}

export const load: PageServerLoad = async ({ params }) => {
	const escenario = await traerEscenario(params.id);

	const { data: plantillas } = await supabase
		.from('checklist_plantillas')
		.select('id, nombre, ponderado')
		.eq('rol_codigo', 'observador_tecnica')
		.eq('estado', 'disponible')
		.order('nombre');

	// Cantidad de ítems de cada plantilla, para que el administrador elija con criterio.
	const { data: items } = await supabase
		.from('checklist_items')
		.select('plantilla_id')
		.in('plantilla_id', (plantillas ?? []).map((p) => p.id));

	const conteo = new Map<string, number>();
	for (const item of items ?? []) {
		conteo.set(item.plantilla_id, (conteo.get(item.plantilla_id) ?? 0) + 1);
	}

	return {
		escenario,
		plantillasDeTecnica: (plantillas ?? []).map((p) => ({
			...p,
			items: conteo.get(p.id) ?? 0
		}))
	};
};

export const actions: Actions = {
	/**
	 * Corregir el título. Las mesas guardan `escenario_id` y no una copia del
	 * nombre, así que las que ya lo practican pasan a mostrar el corregido sin que
	 * haya que tocarlas. `escenarios.nombre` es único: dos escenarios con el mismo
	 * título serían indistinguibles en el desplegable de crear una mesa.
	 */
	renombrar: async ({ request, params }) => {
		const escenario = await traerEscenario(params.id);

		const formulario = await request.formData();
		const nombre = String(formulario.get('nombre') ?? '').trim();

		// `renombrando` reabre el campo con lo tipeado aunque no haya JavaScript.
		const rechazarNombre = (estado: number, mensaje: string) =>
			fail(estado, { mensaje, exito: null, renombrando: true, nombre });

		if (nombre.length < 3) return rechazarNombre(400, 'El nombre no puede quedar vacío.');
		if (nombre === escenario.nombre) return { mensaje: null, exito: 'No había nada que cambiar.' };

		const { error: fallo } = await supabase
			.from('escenarios')
			.update({ nombre })
			.eq('id', escenario.id);

		if (fallo) {
			return fallo.code === '23505'
				? rechazarNombre(409, `Ya hay otro escenario que se llama «${nombre}».`)
				: rechazarNombre(400, 'No se pudo cambiar el nombre. Intentá de nuevo.');
		}

		return { mensaje: null, exito: `El escenario ahora se llama «${nombre}».` };
	},

	/** Asocia (o desasocia) el checklist con que se evalúa la técnica del escenario. */
	asociarChecklist: async ({ request, params }) => {
		await traerEscenario(params.id);

		const formulario = await request.formData();
		const elegido = String(formulario.get('plantillaId') ?? '');
		const plantillaId = elegido === '' ? null : elegido;

		if (plantillaId !== null && !UUID.test(plantillaId)) {
			return rechazar(400, 'Ese checklist no es válido.');
		}

		const { error: fallo } = await supabase
			.from('escenarios')
			.update({ checklist_tecnica_id: plantillaId })
			.eq('id', params.id);

		if (fallo) {
			return rechazar(400, 'No se pudo asociar el checklist. Intentá de nuevo.');
		}

		return {
			mensaje: null,
			exito: plantillaId
				? 'Checklist de la técnica asociado al escenario.'
				: 'El escenario quedó sin checklist de la técnica.'
		};
	},

	/** Adjunta la planificación que se le presentará al facilitador. */
	adjuntarPlanificacion: async ({ request, params }) => {
		const escenario = await traerEscenario(params.id);

		const formulario = await request.formData();
		const archivo = formulario.get('planificacion');

		if (!(archivo instanceof File) || archivo.size === 0) {
			return rechazar(400, 'Elegí un archivo para adjuntar.');
		}
		if (!tipoAceptado(archivo.type, archivo.name)) {
			return rechazar(400, 'La planificación tiene que ser un PDF o un documento Word.');
		}
		if (archivo.size > TAMANO_MAXIMO) {
			return rechazar(400, 'El archivo supera los 20 MB.');
		}

		const tipo = tipoNormalizado(archivo.type, archivo.name);
		const ruta = `${escenario.id}/planificacion${extensionDe(archivo.name)}`;

		const { error: falloSubida } = await supabase.storage
			.from(BUCKET)
			.upload(ruta, archivo, { contentType: tipo, upsert: true });

		if (falloSubida) {
			return rechazar(400, `No se pudo subir la planificación: ${falloSubida.message}`);
		}

		const { error: falloRegistro } = await supabase
			.from('escenarios')
			.update({
				planificacion_ruta: ruta,
				planificacion_archivo: archivo.name,
				planificacion_tipo: tipo,
				planificacion_tamano: archivo.size,
				planificacion_subida_en: new Date().toISOString()
			})
			.eq('id', escenario.id);

		if (falloRegistro) {
			// El objeto quedó huérfano en el bucket: lo sacamos para no dejar basura.
			await supabase.storage.from(BUCKET).remove([ruta]);
			return rechazar(400, 'No se pudo registrar la planificación. Intentá de nuevo.');
		}

		// Si la anterior tenía otra extensión, su objeto sigue ahí y ya no lo referencia nadie.
		if (escenario.planificacion_ruta && escenario.planificacion_ruta !== ruta) {
			await supabase.storage.from(BUCKET).remove([escenario.planificacion_ruta]);
		}

		return { mensaje: null, exito: 'Planificación adjuntada al escenario.' };
	},

	quitarPlanificacion: async ({ params }) => {
		const escenario = await traerEscenario(params.id);

		if (!escenario.planificacion_ruta) {
			return rechazar(409, 'Este escenario no tiene planificación adjunta.');
		}

		const { error: fallo } = await supabase
			.from('escenarios')
			.update({
				planificacion_ruta: null,
				planificacion_archivo: null,
				planificacion_tipo: null,
				planificacion_tamano: null,
				planificacion_subida_en: null
			})
			.eq('id', escenario.id);

		if (fallo) {
			return rechazar(400, 'No se pudo quitar la planificación. Intentá de nuevo.');
		}

		await supabase.storage.from(BUCKET).remove([escenario.planificacion_ruta]);

		return { mensaje: null, exito: 'Planificación quitada del escenario.' };
	}
};
