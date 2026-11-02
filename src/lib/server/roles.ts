import { supabase } from './supabase';
import type { Rol } from '$lib/tipos';

type RolDelDestinatario = Rol & {
	checklist: string | null;
	destinatario: string;
	loEligeElParticipante: boolean;
};

/**
 * Qué roles se ocupan en cada destinatario: seis roles y dos destinatarios, que
 * cambian sólo con una migración. Se piden casi en cada pantalla de mesa, así que
 * quedan en memoria un rato en vez de cruzar a la base cada vez. Si la consulta
 * falla no se guarda nada, y el próximo pedido vuelve a intentar.
 */
const DURACION = 5 * 60 * 1000;
let enMemoria: { hasta: number; filas: Promise<RolDelDestinatario[]> } | null = null;

function rolesPorDestinatario(): Promise<RolDelDestinatario[]> {
	if (enMemoria && enMemoria.hasta > Date.now()) return enMemoria.filas;

	const filas = (async () => {
		const { data, error } = await supabase
			.from('roles_por_destinatario')
			.select('destinatario, lo_elige_el_participante, rol:roles(codigo, nombre, observador, orden, checklist)');
		if (error) throw error;
		return (data ?? [])
			.filter((fila) => fila.rol !== null)
			.map((fila) => ({
				...fila.rol!,
				destinatario: fila.destinatario,
				loEligeElParticipante: fila.lo_elige_el_participante
			}))
			.sort((a, b) => a.orden - b.orden);
	})();

	enMemoria = { hasta: Date.now() + DURACION, filas };
	filas.catch(() => (enMemoria = null));
	return filas;
}

/**
 * Los roles que puede elegir quien escanea el QR de una mesa de este curso.
 *
 * No son todos los del sistema: el destinatario del curso decide cuáles se
 * ocupan. En un curso de docentes están los cinco de siempre; en uno de alumnos,
 * el observador del facilitador no existe —lo reemplaza el del proceso— y el
 * facilitador queda afuera de la lista porque lo ocupa el docente que conduce la
 * mesa, no un alumno.
 *
 * La misma regla la hace cumplir un trigger sobre `participaciones`: esto es para
 * no ofrecer lo que después se va a rechazar, no para autorizar nada.
 */
export async function rolesQueSeEligen(destinatario: string): Promise<Rol[]> {
	return rolesDelDestinatario(destinatario, true);
}

/**
 * Todos los roles que se ocupan en un curso de este destinatario, se elijan por
 * el QR o no. En un curso de alumnos incluye al facilitador, que ocupa el docente
 * que conduce la mesa: para el líder sigue siendo un rol de la corrida, y verlo
 * sin ocupar es lo que le recuerda que todavía no se declaró.
 */
export async function rolesDelDestinatario(
	destinatario: string,
	soloLosQueSeEligen = false
): Promise<Rol[]> {
	return (await rolesPorDestinatario())
		.filter((r) => r.destinatario === destinatario)
		.filter((r) => !soloLosQueSeEligen || r.loEligeElParticipante)
		.map(({ codigo, nombre, observador, orden }) => ({ codigo, nombre, observador, orden }));
}

/**
 * El checklist común vigente que corresponde a un curso, con sus ítems.
 *
 * Son dos en el sistema —el del observador del facilitador y el del observador
 * del proceso—, pero nunca conviven: cada destinatario ocupa uno solo. Así que la
 * pregunta no es «cuál de los dos» sino «cuál ocupa este curso», y eso ya lo dice
 * `roles_por_destinatario`. Hay uno vigente por rol en cada institución, así que
 * se acota a la del curso.
 */
export async function checklistComunDe(destinatario: string, tenantId: string) {
	const comun = (await rolesPorDestinatario()).find(
		(r) => r.destinatario === destinatario && r.checklist === 'comun'
	);
	if (!comun) return null;

	const { data } = await supabase
		.from('checklist_plantillas')
		.select('id, nombre, ponderado, checklist_items(peso)')
		.eq('estado', 'disponible')
		.eq('rol_codigo', comun.codigo)
		.eq('tenant_id', tenantId)
		.maybeSingle();

	return data ? { ...data, rolNombre: comun.nombre } : null;
}

/** Si ese rol se ocupa en este curso y lo elige el participante, no el sistema. */
export async function loEligeElParticipante(destinatario: string, rolCodigo: string) {
	return (await rolesPorDestinatario()).some(
		(r) => r.destinatario === destinatario && r.codigo === rolCodigo && r.loEligeElParticipante
	);
}
