import { error, fail, redirect } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import type { Actions, PageServerLoad } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const rechazar = (estado: number, mensaje: string) => fail(estado, { mensaje, exito: null });

async function traerPlantilla(id: string) {
	if (!UUID.test(id)) error(404, 'El checklist no existe');

	const { data, error: fallo } = await supabase
		.from('checklist_plantillas')
		.select('id, nombre, rol_codigo, ponderado, estado, rol:roles(nombre)')
		.eq('id', id)
		.maybeSingle();

	if (fallo) error(500, fallo.message);
	if (!data) error(404, 'El checklist no existe');

	return data;
}

function leerPeso(valor: FormDataEntryValue | null, ponderado: boolean): number | null {
	// Sin ponderar el peso lo fija la base en 1; no hace falta leerlo del formulario.
	if (!ponderado) return 1;
	const peso = Number(String(valor ?? '').replace(',', '.'));
	if (!Number.isFinite(peso) || peso < 0) return null;
	return peso;
}

export const load: PageServerLoad = async ({ params }) => {
	const plantilla = await traerPlantilla(params.id);

	const { data: items } = await supabase
		.from('checklist_items')
		.select('id, orden, texto, peso')
		.eq('plantilla_id', plantilla.id)
		.order('orden');

	// Si es el del facilitador, avisamos a cuál va a reemplazar al terminarlo.
	const { data: vigente } =
		plantilla.rol_codigo === 'observador_operacion' && plantilla.estado !== 'disponible'
			? await supabase
					.from('checklist_plantillas')
					.select('nombre')
					.eq('rol_codigo', 'observador_operacion')
					.eq('estado', 'disponible')
					.maybeSingle()
			: { data: null };

	const criterios = (items ?? []).map((i) => ({ ...i, peso: Number(i.peso) }));

	// Lo que impide darlo de baja: estar asociado a un escenario, o que alguien
	// ya lo haya abierto. Se cuenta acá para decir por qué no se puede.
	const [{ count: escenarios }, { count: instancias }] = await Promise.all([
		supabase
			.from('escenarios')
			.select('id', { count: 'exact', head: true })
			.eq('checklist_tecnica_id', plantilla.id),
		supabase
			.from('checklist_instancias')
			.select('id', { count: 'exact', head: true })
			.eq('plantilla_id', plantilla.id)
	]);

	return {
		plantilla,
		escenariosQueLoUsan: escenarios ?? 0,
		vecesQueSeUso: instancias ?? 0,
		items: criterios,
		maximo: criterios.reduce((total, i) => total + i.peso, 0),
		operacionVigente: vigente?.nombre ?? null
	};
};

export const actions: Actions = {
	/**
	 * Corregir el título. Vale en cualquier estado, incluso con el checklist ya en
	 * uso: el nombre es una etiqueta, no la identidad —esa es el id—, y las
	 * evaluaciones enviadas lo leen de la plantilla, así que pasan a mostrar el
	 * título corregido. Es el mismo instrumento, bien escrito; misma lógica con la
	 * que un cambio de peso corre el resultado de lo ya enviado.
	 */
	renombrar: async ({ request, params }) => {
		const plantilla = await traerPlantilla(params.id);

		const formulario = await request.formData();
		const nombre = String(formulario.get('nombre') ?? '').trim();

		// `renombrando` reabre el campo con lo tipeado aunque no haya JavaScript.
		const rechazarNombre = (estado: number, mensaje: string) =>
			fail(estado, { mensaje, exito: null, renombrando: true, nombre });

		if (nombre.length < 3) return rechazarNombre(400, 'El nombre no puede quedar vacío.');
		if (nombre === plantilla.nombre) return { mensaje: null, exito: 'No había nada que cambiar.' };

		const { error: fallo } = await supabase
			.from('checklist_plantillas')
			.update({ nombre })
			.eq('id', plantilla.id);

		if (fallo) return rechazarNombre(400, 'No se pudo cambiar el nombre. Intentá de nuevo.');

		return { mensaje: null, exito: `El checklist ahora se llama «${nombre}».` };
	},

	agregarItem: async ({ request, params }) => {
		const plantilla = await traerPlantilla(params.id);

		const formulario = await request.formData();
		const texto = String(formulario.get('texto') ?? '').trim();
		const peso = leerPeso(formulario.get('peso'), plantilla.ponderado);

		if (texto.length < 3) return rechazar(400, 'Escribí el criterio a evaluar.');
		if (peso === null) return rechazar(400, 'El peso tiene que ser un número no negativo.');

		const { data: ultimo } = await supabase
			.from('checklist_items')
			.select('orden')
			.eq('plantilla_id', plantilla.id)
			.order('orden', { ascending: false })
			.limit(1)
			.maybeSingle();

		const { error: fallo } = await supabase.from('checklist_items').insert({
			plantilla_id: plantilla.id,
			orden: (ultimo?.orden ?? 0) + 1,
			texto,
			peso
		});

		if (fallo) return rechazar(400, 'No se pudo agregar el criterio. Intentá de nuevo.');

		return { mensaje: null, exito: 'Criterio agregado.' };
	},

	editarItem: async ({ request, params }) => {
		const plantilla = await traerPlantilla(params.id);

		const formulario = await request.formData();
		const itemId = String(formulario.get('itemId') ?? '');
		const texto = String(formulario.get('texto') ?? '').trim();
		const peso = leerPeso(formulario.get('peso'), plantilla.ponderado);

		if (!UUID.test(itemId)) return rechazar(400, 'Criterio inválido.');
		if (texto.length < 3) return rechazar(400, 'El criterio no puede quedar vacío.');
		if (peso === null) return rechazar(400, 'El peso tiene que ser un número no negativo.');

		const { error: fallo } = await supabase
			.from('checklist_items')
			.update({ texto, peso })
			.eq('id', itemId)
			.eq('plantilla_id', plantilla.id);

		if (fallo) return rechazar(400, 'No se pudo guardar el criterio. Intentá de nuevo.');

		return { mensaje: null, exito: 'Criterio guardado.' };
	},

	/**
	 * Guarda el orden completo de los criterios, en un solo viaje.
	 *
	 * La pantalla reacomoda la lista localmente —con las flechas o arrastrando— y
	 * recién manda el orden final. Antes cada flecha era una llamada, así que
	 * llevar el último criterio al primer lugar costaba N-1 viajes a la base.
	 *
	 * `reordenar_criterios()` comprueba que la lista sea exactamente la del
	 * checklist: si alguien agregó o quitó un criterio mientras tanto, rechaza en
	 * vez de aplicar un orden que ya no corresponde.
	 */
	/**
	 * Dar de baja un checklist. `borrar_checklist()` rechaza si está asociado a un
	 * escenario o si alguien lo abrió alguna vez: una instancia es el trabajo de
	 * una persona, aunque no lo haya enviado. Sus criterios caen por cascada.
	 */
	eliminar: async ({ params }) => {
		const plantilla = await traerPlantilla(params.id);

		const { error: fallo } = await supabase.rpc('borrar_checklist', {
			p_plantilla_id: plantilla.id
		});

		if (fallo) {
			if (fallo.message.includes('ya no existe')) {
				return rechazar(404, 'Ese checklist ya no existe: alguien lo eliminó antes.');
			}
			if (fallo.message.includes('asociado')) {
				return rechazar(
					409,
					'Hay escenarios que usan este checklist. Desasociálo de ellos antes de eliminarlo.'
				);
			}
			if (fallo.message.includes('se uso')) {
				return rechazar(
					409,
					'Alguien ya completó este checklist en una mesa, así que no se puede eliminar: se perdería ese trabajo.'
				);
			}
			return rechazar(500, 'No se pudo eliminar el checklist. Intentá de nuevo.');
		}

		redirect(303, '/admin/checklists');
	},

	reordenarItems: async ({ request, params }) => {
		const plantilla = await traerPlantilla(params.id);

		const formulario = await request.formData();
		const orden = String(formulario.get('orden') ?? '')
			.split(',')
			.filter(Boolean);

		if (orden.length === 0) return rechazar(400, 'No llegó ningún orden que guardar.');
		if (!orden.every((id) => UUID.test(id))) return rechazar(400, 'Orden inválido.');

		const { error: fallo } = await supabase.rpc('reordenar_criterios', {
			p_plantilla_id: plantilla.id,
			p_items: orden
		});

		if (fallo) {
			return rechazar(
				409,
				'Los criterios cambiaron mientras reordenabas. Recargá la página y probá de nuevo.'
			);
		}

		// Sin aviso de éxito: el orden nuevo ya se ve en la lista.
		return { mensaje: null, exito: null };
	},

	/**
	 * Mueve un criterio un lugar arriba o abajo. Queda para cuando no hay
	 * JavaScript: con JavaScript la pantalla reacomoda localmente y guarda el
	 * orden entero con `reordenarItems`, en un viaje en vez de uno por flecha.
	 */
	moverItem: async ({ request, params }) => {
		const plantilla = await traerPlantilla(params.id);

		const formulario = await request.formData();
		const itemId = String(formulario.get('itemId') ?? '');
		const hacia = String(formulario.get('hacia') ?? '');

		if (!UUID.test(itemId)) return rechazar(400, 'Criterio inválido.');
		if (hacia !== 'arriba' && hacia !== 'abajo') return rechazar(400, 'Dirección inválida.');

		// Que el criterio sea de este checklist y no de otro.
		const { data: item } = await supabase
			.from('checklist_items')
			.select('id')
			.eq('id', itemId)
			.eq('plantilla_id', plantilla.id)
			.maybeSingle();

		if (!item) return rechazar(404, 'Ese criterio no es de este checklist.');

		const { error: fallo } = await supabase.rpc('mover_criterio', {
			p_item_id: itemId,
			p_hacia: hacia
		});

		if (fallo) return rechazar(400, 'No se pudo mover el criterio. Intentá de nuevo.');

		// Sin aviso de éxito: el movimiento se ve solo en la lista.
		return { mensaje: null, exito: null };
	},

	quitarItem: async ({ request, params }) => {
		const plantilla = await traerPlantilla(params.id);

		const formulario = await request.formData();
		const itemId = String(formulario.get('itemId') ?? '');
		if (!UUID.test(itemId)) return rechazar(400, 'Criterio inválido.');

		const { error: fallo } = await supabase
			.from('checklist_items')
			.delete()
			.eq('id', itemId)
			.eq('plantilla_id', plantilla.id);

		if (fallo) return rechazar(400, 'No se pudo quitar el criterio. Intentá de nuevo.');

		return { mensaje: null, exito: 'Criterio quitado.' };
	},

	/** Al despoderar, un trigger iguala todos los pesos en 1. */
	ponderacion: async ({ request, params }) => {
		const plantilla = await traerPlantilla(params.id);

		const formulario = await request.formData();
		const ponderado = formulario.get('ponderado') === 'true';

		const { error: fallo } = await supabase
			.from('checklist_plantillas')
			.update({ ponderado })
			.eq('id', plantilla.id);

		if (fallo) return rechazar(400, 'No se pudo cambiar la ponderación. Intentá de nuevo.');

		return {
			mensaje: null,
			exito: ponderado
				? 'Checklist ponderado: asigná un peso a cada criterio.'
				: 'Checklist sin ponderar: todos los criterios pesan lo mismo.'
		};
	},

	/** Da el checklist por terminado: queda disponible para usarse. */
	terminar: async ({ params }) => {
		const plantilla = await traerPlantilla(params.id);

		const { data, error: fallo } = await supabase.rpc('dar_por_terminado_el_checklist', {
			p_plantilla_id: plantilla.id
		});

		if (fallo || !data) {
			return rechazar(
				400,
				fallo?.message.includes('sin criterios')
					? 'Un checklist sin criterios no puede darse por terminado.'
					: 'No se pudo dar por terminado el checklist. Intentá de nuevo.'
			);
		}

		return {
			mensaje: null,
			exito: `«${data.nombre}» quedó creado y disponible para usarse.`
		};
	}
};
