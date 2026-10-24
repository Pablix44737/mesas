import { error } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import { tenantActual } from '$lib/server/tenant';
import type { PageServerLoad } from './$types';

/**
 * Cuántas veces tiene que haberse respondido un criterio para que su tasa de
 * fallo signifique algo. Con tres respuestas, un solo fallo da 33% y ordena por
 * encima de un criterio que falló 8 de 30: el ranking lo encabezaría el ruido.
 *
 * Los que no llegan no se esconden —se cuentan aparte y se dice cuántos son—,
 * porque «todavía no hay con qué decirlo» es también una respuesta.
 */
const MINIMO = 5;

/** Cuántos criterios se listan: es un ranking para actuar, no un inventario. */
const CUANTOS = 12;

/**
 * Lo mismo para la concordancia, pero contra pares de observadores, que son
 * bastante más escasos que las respuestas: hay un par sólo cuando dos personas
 * miraron el mismo ciclo con el mismo checklist.
 */
const MINIMO_PARES = 4;

export const load: PageServerLoad = async ({ locals, url }) => {
	const tenant = tenantActual(locals);
	const elegido = url.searchParams.get('escenario');

	const [
		{ data: ciclos, error: falloCiclos },
		{ data: criterios, error: falloCriterios },
		{ data: concordancia, error: falloConcordancia }
	] = await Promise.all([
		supabase.from('ciclos_de_la_institucion').select('*').eq('tenant_id', tenant),
		supabase.from('criterios_evaluados').select('*').eq('tenant_id', tenant),
		supabase.from('concordancia_entre_observadores').select('*').eq('tenant_id', tenant)
	]);

	if (falloCiclos) error(500, falloCiclos.message);
	if (falloCriterios) error(500, falloCriterios.message);
	if (falloConcordancia) error(500, falloConcordancia.message);

	const todosLosCiclos = ciclos ?? [];
	const todosLosCriterios = criterios ?? [];
	const todaLaConcordancia = concordancia ?? [];

	// Los escenarios que se pueden mirar son los que tienen algo evaluado: ofrecer
	// uno vacío es ofrecer una pantalla en blanco.
	const escenarios = [
		...new Map(
			todosLosCriterios
				.filter((c) => c.escenario_id && c.escenario)
				.map((c) => [c.escenario_id!, { id: c.escenario_id!, nombre: c.escenario! }])
		).values()
	].sort((a, b) => a.nombre.localeCompare(b.nombre));

	// Un escenario que no existe o que no tiene nada evaluado cae en «todos», que
	// es lo que la pantalla sabe mostrar siempre.
	const escenarioId = escenarios.some((e) => e.id === elegido) ? elegido : null;

	const delEscenario = escenarioId
		? todosLosCriterios.filter((c) => c.escenario_id === escenarioId)
		: todosLosCriterios;

	/**
	 * Con «todos los escenarios» el mismo criterio del checklist común aparece una
	 * vez por escenario: la vista los separa a propósito. Acá se vuelven a sumar,
	 * que es lo que se quiere leer cuando no se está mirando una técnica puntual.
	 */
	const porCriterio = new Map<
		string,
		{
			itemId: string;
			criterio: string;
			checklist: string;
			plantillaId: string;
			rol: string;
			peso: number;
			respondido: number;
			fallos: number;
			escenarios: Set<string>;
		}
	>();

	for (const fila of delEscenario) {
		if (!fila.item_id || !fila.criterio) continue;

		const suyo = porCriterio.get(fila.item_id) ?? {
			itemId: fila.item_id,
			criterio: fila.criterio,
			checklist: fila.checklist ?? '',
			plantillaId: fila.plantilla_id ?? '',
			rol: fila.rol ?? '',
			peso: Number(fila.peso ?? 0),
			respondido: 0,
			fallos: 0,
			escenarios: new Set<string>()
		};

		suyo.respondido += fila.respondido ?? 0;
		suyo.fallos += fila.fallos ?? 0;
		if (fila.escenario) suyo.escenarios.add(fila.escenario);
		porCriterio.set(fila.item_id, suyo);
	}

	/**
	 * Concordancia: lo mismo que arriba, sumando por criterio cuando se miran
	 * todos los escenarios.
	 *
	 * La tasa de fallo del criterio viaja al lado a propósito. Un criterio que
	 * falla mucho y además se marca distinto no es lo mismo que uno que falla
	 * mucho y todos leen igual: el primero probablemente esté mal redactado, el
	 * segundo es algo que de verdad cuesta. Separarlos es la diferencia entre
	 * corregir el checklist y corregir la clase.
	 */
	const tasaDeFallo = new Map(
		[...porCriterio.values()].map((c) => [
			c.itemId,
			c.respondido > 0 ? c.fallos / c.respondido : null
		])
	);

	const deLaConcordancia = escenarioId
		? todaLaConcordancia.filter((c) => c.escenario_id === escenarioId)
		: todaLaConcordancia;

	const porPar = new Map<
		string,
		{ itemId: string; criterio: string; rol: string; pares: number; discrepan: number }
	>();

	for (const fila of deLaConcordancia) {
		if (!fila.item_id || !fila.criterio) continue;

		const suyo = porPar.get(fila.item_id) ?? {
			itemId: fila.item_id,
			criterio: fila.criterio,
			rol: fila.rol ?? '',
			pares: 0,
			discrepan: 0
		};

		suyo.pares += fila.pares ?? 0;
		suyo.discrepan += fila.discrepan ?? 0;
		porPar.set(fila.item_id, suyo);
	}

	const medidos = [...porCriterio.values()].filter((c) => c.respondido >= MINIMO);

	const puntosCriticos = medidos
		.map((c) => ({
			itemId: c.itemId,
			criterio: c.criterio,
			checklist: c.checklist,
			rol: c.rol,
			respondido: c.respondido,
			fallos: c.fallos,
			// La tasa de fallo es la que ordena: no depende del peso, y el peso en
			// este sistema se puede corregir hacia atrás.
			tasa: c.respondido > 0 ? c.fallos / c.respondido : 0,
			// Los puntos perdidos son la lectura de impacto, al lado.
			puntos: Math.round(c.peso * c.fallos * 10) / 10,
			// Con «todos», decir en cuántas técnicas aparece distingue un criterio del
			// checklist común de uno que es propio de un escenario.
			enEscenarios: c.escenarios.size,
			// Cuánto lo leen distinto los observadores: un criterio que falla mucho y
			// además se marca distinto probablemente esté mal redactado.
			pares: porPar.get(c.itemId)?.pares ?? 0,
			discrepan: porPar.get(c.itemId)?.discrepan ?? 0
		}))
		.sort((a, b) => b.tasa - a.tasa || b.fallos - a.fallos)
		.slice(0, CUANTOS);

	// Lo que no alcanza el mínimo: se dice cuántos son y no se los ordena.
	const sinSuficiente = porCriterio.size - medidos.length;

	const comparados = [...porPar.values()];
	const conSuficientesPares = comparados.filter((c) => c.pares >= MINIMO_PARES);

	const discrepancias = conSuficientesPares
		.map((c) => ({
			itemId: c.itemId,
			criterio: c.criterio,
			rol: c.rol,
			pares: c.pares,
			discrepan: c.discrepan,
			tasa: c.pares > 0 ? c.discrepan / c.pares : 0,
			fallo: tasaDeFallo.get(c.itemId) ?? null
		}))
		.filter((c) => c.discrepan > 0)
		.sort((a, b) => b.tasa - a.tasa || b.discrepan - a.discrepan)
		.slice(0, CUANTOS);

	// Cada criterio con suficientes comparaciones, ubicado por cuánto falla y cuánto
	// difieren: es lo que separa «está mal redactado» de «cuesta de verdad».
	const mapa = conSuficientesPares
		.map((c) => ({
			itemId: c.itemId,
			criterio: c.criterio,
			falla: tasaDeFallo.get(c.itemId) ?? null,
			difieren: c.pares > 0 ? c.discrepan / c.pares : 0
		}))
		.filter((c) => c.falla !== null);

	const paresTotales = comparados.reduce((total, c) => total + c.pares, 0);
	const discrepanTotales = comparados.reduce((total, c) => total + c.discrepan, 0);

	/**
	 * La evolución de un criterio, cuando se eligió uno.
	 *
	 * Dos ejes posibles y no son lo mismo. `vuelta` es el número de ciclo dentro
	 * de la mesa: el eje del modelo, donde la pregunta es si la segunda práctica
	 * sale mejor que la primera. `fecha` es el calendario: el eje que contesta si
	 * una corrección que se hizo sirvió. Hoy casi todo cae en un mismo día, así
	 * que el que tiene algo para decir es la vuelta; después del próximo evento el
	 * otro empieza a valer.
	 *
	 * Al lado del criterio va la serie de todo su checklist. Con cuatro respuestas
	 * por vuelta, una sola marca mueve el número veinticinco puntos: lo único que
	 * permite distinguir un movimiento real de un rebote es ver contra qué se
	 * mueve el conjunto, que sí tiene cientos de respuestas por vuelta.
	 */
	const porEje = url.searchParams.get('eje') === 'fecha' ? 'fecha' : 'vuelta';
	const criterioPedido = url.searchParams.get('criterio');
	const elCriterio = criterioPedido ? (porCriterio.get(criterioPedido) ?? null) : null;

	let evolucion: {
		criterio: { itemId: string; texto: string; rol: string; checklist: string };
		eje: 'vuelta' | 'fecha';
		puntos: {
			etiqueta: string;
			respondido: number;
			fallos: number;
			tasa: number;
			conjunto: number | null;
		}[];
	} | null = null;

	if (elCriterio) {
		const consulta = supabase
			.from('criterios_en_el_tiempo')
			.select('*')
			.eq('tenant_id', tenant)
			.eq('plantilla_id', elCriterio.plantillaId);

		const { data: enElTiempo } = escenarioId
			? await consulta.eq('escenario_id', escenarioId)
			: await consulta;

		// Una casilla por punto del eje: la del criterio y la de todo el checklist.
		const suyo = new Map<string, { respondido: number; fallos: number }>();
		const delChecklist = new Map<string, { respondido: number; fallos: number }>();

		for (const fila of enElTiempo ?? []) {
			const clave = porEje === 'fecha' ? (fila.dia ?? '') : String(fila.vuelta ?? '');
			if (!clave) continue;

			const sumar = (donde: Map<string, { respondido: number; fallos: number }>) => {
				const casilla = donde.get(clave) ?? { respondido: 0, fallos: 0 };
				casilla.respondido += fila.respondido ?? 0;
				casilla.fallos += fila.fallos ?? 0;
				donde.set(clave, casilla);
			};

			sumar(delChecklist);
			if (fila.item_id === elCriterio.itemId) sumar(suyo);
		}

		// El eje se ordena por su propia naturaleza: la vuelta es un número, el día
		// es una fecha ISO, que ordenada como texto queda cronológica igual.
		const claves = [...delChecklist.keys()].sort((a, b) =>
			porEje === 'vuelta' ? Number(a) - Number(b) : a.localeCompare(b)
		);

		evolucion = {
			criterio: {
				itemId: elCriterio.itemId,
				texto: elCriterio.criterio,
				rol: elCriterio.rol,
				checklist: elCriterio.checklist
			},
			eje: porEje,
			puntos: claves.map((clave) => {
				const propio = suyo.get(clave) ?? { respondido: 0, fallos: 0 };
				const todos = delChecklist.get(clave)!;
				return {
					etiqueta: clave,
					respondido: propio.respondido,
					fallos: propio.fallos,
					tasa: propio.respondido > 0 ? propio.fallos / propio.respondido : 0,
					conjunto: todos.respondido > 0 ? todos.fallos / todos.respondido : null
				};
			})
		};
	}

	const ciclosDelEscenario = escenarioId
		? todosLosCiclos.filter((c) => c.escenario_id === escenarioId)
		: todosLosCiclos;

	const respondidas = delEscenario.reduce((total, c) => total + (c.respondido ?? 0), 0);
	const fallidas = delEscenario.reduce((total, c) => total + (c.fallos ?? 0), 0);

	// Cuántas veces se practicó cada escenario: el modelo prescribe tres por
	// técnica, así que el que no llegó se ve de un vistazo.
	const practicas = new Map<
		string,
		{ id: string; nombre: string; ciclos: number; evaluaciones: number }
	>();
	for (const ciclo of todosLosCiclos) {
		if (!ciclo.escenario_id || !ciclo.escenario) continue;
		const suyo = practicas.get(ciclo.escenario_id) ?? {
			id: ciclo.escenario_id,
			nombre: ciclo.escenario,
			ciclos: 0,
			evaluaciones: 0
		};
		suyo.ciclos += 1;
		suyo.evaluaciones += ciclo.evaluaciones ?? 0;
		practicas.set(ciclo.escenario_id, suyo);
	}

	return {
		escenarios,
		escenarioElegido: escenarioId,
		puntosCriticos,
		sinSuficiente,
		minimo: MINIMO,
		// Lo que se midió, para que el ranking se lea sabiendo sobre cuánto está hecho.
		alcance: {
			ciclos: ciclosDelEscenario.length,
			evaluaciones: ciclosDelEscenario.reduce((t, c) => t + (c.evaluaciones ?? 0), 0),
			respondidas,
			fallidas,
			criterios: porCriterio.size,
			escenarios: new Set(ciclosDelEscenario.map((c) => c.escenario_id)).size,
			cumplimiento: respondidas > 0 ? (respondidas - fallidas) / respondidas : null
		},
		evolucion,
		practicas: [...practicas.values()].sort((a, b) => b.ciclos - a.ciclos),
		concordancia: {
			discrepancias,
			minimoPares: MINIMO_PARES,
			// Un «par» es un ciclo que tuvo dos observadores con el mismo checklist.
			// Sin pares no hay nada que comparar, y eso se dice en vez de mostrar
			// una tabla vacía.
			mapa,
			comparaciones: paresTotales,
			discrepan: discrepanTotales,
			tasa: paresTotales > 0 ? discrepanTotales / paresTotales : null,
			criterios: comparados.length
		}
	};
};
