import { error, fail } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import { mesaDelCurso } from '$lib/server/mesas';
import type { Actions, PageServerLoad } from './$types';

type Resumen = { id: string; nombre: string; ponderado: boolean; items: number; maximo: number };

async function traerMesa(codigoDelCurso: string, numeroCrudo: string) {
	const { curso, mesa: encontrada } = await mesaDelCurso(codigoDelCurso, numeroCrudo);

	const { data: mesa, error: fallo } = await supabase
		.from('mesas')
		.select(
			`id, numero, creada_en,
			 escenario:escenarios(
				id, nombre, planificacion_archivo, planificacion_tamano,
				checklist_tecnica:checklist_plantillas(id, nombre, ponderado)
			 )`
		)
		.eq('id', encontrada.id)
		.maybeSingle();

	if (fallo) error(500, fallo.message);
	if (!mesa) error(404, 'Esa mesa ya no existe');

	return { curso, mesa };
}

export const load: PageServerLoad = async ({ params, url }) => {
	const { curso, mesa } = await traerMesa(params.curso, params.numero);

	// El del facilitador no cuelga del escenario: es común a todas las mesas.
	const [{ data: operacion }, { data: corridas }] = await Promise.all([
		supabase
			.from('checklist_plantillas')
			.select('id, nombre, ponderado')
			.eq('rol_codigo', 'observador_operacion')
			.eq('estado', 'disponible')
			.maybeSingle(),
		supabase
			.from('corridas')
			.select('id, numero, habilitada, creada_en')
			.eq('mesa_id', mesa.id)
			.order('numero', { ascending: false })
	]);

	const tecnica = mesa.escenario?.checklist_tecnica ?? null;
	const plantillas = [tecnica, operacion].filter((p) => p !== null);

	const { data: items } = await supabase
		.from('checklist_items')
		.select('plantilla_id, peso')
		.in(
			'plantilla_id',
			plantillas.map((p) => p.id)
		);

	// Cuántos criterios trae cada checklist y contra qué máximo se va a leer su resultado.
	const resumir = (plantilla: (typeof plantillas)[number] | null): Resumen | null => {
		if (!plantilla) return null;
		const suyos = (items ?? []).filter((i) => i.plantilla_id === plantilla.id);
		return {
			id: plantilla.id,
			nombre: plantilla.nombre,
			ponderado: plantilla.ponderado,
			items: suyos.length,
			maximo: suyos.reduce((total, i) => total + Number(i.peso), 0)
		};
	};

	// Quiénes están observando ahora mismo y todavía no enviaron: si el líder
	// avanza, esa observación se les va de la vista.
	const corridaEnCurso = (corridas ?? []).find((c) => c.habilitada) ?? null;
	const { data: sinEnviar } = corridaEnCurso
		? await supabase
				.from('checklists_sin_enviar')
				.select('dni, participante_nombre, rol_nombre, marcados, items')
				.eq('corrida_id', corridaEnCurso.id)
		: { data: null };

	// Quiénes entraron a la mesa y con qué rol. Al líder le sirve para saber, sin
	// andar preguntando, quién ya está y si los observadores enviaron lo suyo.
	const idsDeCorridas = (corridas ?? []).map((c) => c.id);
	const [{ data: participaciones }, { data: roles }] = await Promise.all([
		idsDeCorridas.length > 0
			? supabase
					.from('participaciones')
					.select(
						`id, dni, corrida_id, rol_codigo,
						 rol:roles(nombre, orden),
						 participante:participantes(nombre, apellido),
						 checklist_instancias(enviada_en)`
					)
					.in('corrida_id', idsDeCorridas)
			: Promise.resolve({ data: null }),
		supabase.from('roles').select('codigo, nombre, orden').order('orden')
	]);

	const todasLasParticipaciones = participaciones ?? [];

	const enLaCorridaEnCurso = todasLasParticipaciones
		.filter((p) => p.corrida_id === corridaEnCurso?.id)
		.map((p) => ({
			id: p.id,
			dni: p.dni,
			rolCodigo: p.rol_codigo,
			rolNombre: p.rol?.nombre ?? p.rol_codigo,
			orden: p.rol?.orden ?? 99,
			nombre: p.participante ? `${p.participante.nombre} ${p.participante.apellido}` : null,
			// Sólo los observadores abren checklist; para el resto queda en null.
			envio: p.checklist_instancias?.enviada_en != null
		}))
		.sort(
			(a, b) => a.orden - b.orden || (a.nombre ?? a.dni).localeCompare(b.nombre ?? b.dni)
		);

	const ocupados = new Set(enLaCorridaEnCurso.map((p) => p.rolCodigo));

	return {
		curso,
		participantes: enLaCorridaEnCurso,
		// Informativo, no una falta: una mesa puede correr sin asistente, por ejemplo.
		rolesLibres: (roles ?? []).filter((r) => !ocupados.has(r.codigo)).map((r) => r.nombre),
		// Personas distintas que pasaron por la mesa, contando todas sus corridas.
		personasEnLaMesa: new Set(todasLasParticipaciones.map((p) => p.dni)).size,
		// Para mostrar junto al QR la dirección que codifica, por si alguien
		// prefiere tipearla en vez de escanear.
		origen: url.origin,
		sinEnviar: (sinEnviar ?? []).map((p) => ({
			quien: p.participante_nombre ?? `DNI ${p.dni}`,
			rol: p.rol_nombre ?? '',
			marcados: p.marcados ?? 0,
			items: p.items ?? 0
		})),
		mesa: { id: mesa.id, numero: mesa.numero, creada_en: mesa.creada_en },
		escenario: mesa.escenario,
		checklistDeTecnica: resumir(tecnica),
		checklistDeOperacion: resumir(operacion),
		corridas: corridas ?? [],
		corridaEnCurso: (corridas ?? []).find((c) => c.habilitada) ?? null
	};
};

export const actions: Actions = {
	/**
	 * Cierra la corrida en curso y abre la siguiente. Las dos cosas pasan dentro
	 * de la función de base, para que la mesa nunca quede sin corrida habilitada.
	 */
	habilitarSiguiente: async ({ params }) => {
		const { curso, mesa } = await traerMesa(params.curso, params.numero);

		const { data: corrida, error: fallo } = await supabase.rpc('habilitar_siguiente_corrida', {
			p_mesa_id: mesa.id
		});

		if (fallo || !corrida) {
			return fail(400, {
				mensaje: 'No se pudo habilitar la corrida. Intentá de nuevo.',
				exito: null
			});
		}

		return {
			mensaje: null,
			exito: `Corrida ${corrida.numero} habilitada. Los participantes ya pueden identificarse.`
		};
	}
};
