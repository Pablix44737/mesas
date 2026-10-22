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

export const load: PageServerLoad = async ({ locals, url }) => {
	const tenant = tenantActual(locals);
	const elegido = url.searchParams.get('escenario');

	const [{ data: ciclos, error: falloCiclos }, { data: criterios, error: falloCriterios }] =
		await Promise.all([
			supabase.from('ciclos_de_la_institucion').select('*').eq('tenant_id', tenant),
			supabase.from('criterios_evaluados').select('*').eq('tenant_id', tenant)
		]);

	if (falloCiclos) error(500, falloCiclos.message);
	if (falloCriterios) error(500, falloCriterios.message);

	const todosLosCiclos = ciclos ?? [];
	const todosLosCriterios = criterios ?? [];

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
			enEscenarios: c.escenarios.size
		}))
		.sort((a, b) => b.tasa - a.tasa || b.fallos - a.fallos)
		.slice(0, CUANTOS);

	// Lo que no alcanza el mínimo: se dice cuántos son y no se los ordena.
	const sinSuficiente = porCriterio.size - medidos.length;

	const ciclosDelEscenario = escenarioId
		? todosLosCiclos.filter((c) => c.escenario_id === escenarioId)
		: todosLosCiclos;

	const respondidas = delEscenario.reduce((total, c) => total + (c.respondido ?? 0), 0);
	const fallidas = delEscenario.reduce((total, c) => total + (c.fallos ?? 0), 0);

	// Cuántas veces se practicó cada escenario: el modelo prescribe tres por
	// técnica, así que el que no llegó se ve de un vistazo.
	const practicas = new Map<string, { nombre: string; ciclos: number; evaluaciones: number }>();
	for (const ciclo of todosLosCiclos) {
		if (!ciclo.escenario_id || !ciclo.escenario) continue;
		const suyo = practicas.get(ciclo.escenario_id) ?? {
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
			cumplimiento: respondidas > 0 ? (respondidas - fallidas) / respondidas : null
		},
		practicas: [...practicas.values()].sort((a, b) => b.ciclos - a.ciclos)
	};
};
