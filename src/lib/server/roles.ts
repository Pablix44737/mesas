import { supabase } from './supabase';
import type { Rol } from '$lib/tipos';

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
	let consulta = supabase
		.from('roles_por_destinatario')
		.select('rol:roles(codigo, nombre, observador, orden)')
		.eq('destinatario', destinatario);

	if (soloLosQueSeEligen) consulta = consulta.eq('lo_elige_el_participante', true);

	const { data } = await consulta;

	return (data ?? [])
		.map((fila) => fila.rol)
		.filter((rol) => rol !== null)
		.sort((a, b) => a.orden - b.orden);
}

/**
 * El checklist común vigente que corresponde a un curso.
 *
 * Son dos en el sistema —el del observador del facilitador y el del observador
 * del proceso—, pero nunca conviven: cada destinatario ocupa uno solo. Así que la
 * pregunta no es «cuál de los dos» sino «cuál ocupa este curso», y eso ya lo dice
 * `roles_por_destinatario`.
 */
export async function checklistComunDe(destinatario: string) {
	const { data: roles } = await supabase
		.from('roles_por_destinatario')
		.select('rol_codigo, rol:roles!inner(checklist)')
		.eq('destinatario', destinatario)
		.eq('roles.checklist', 'comun');

	const codigos = (roles ?? []).map((r) => r.rol_codigo);
	if (codigos.length === 0) return null;

	const { data } = await supabase
		.from('checklist_plantillas')
		.select('id, nombre, ponderado, rol:roles(nombre)')
		.eq('estado', 'disponible')
		.in('rol_codigo', codigos)
		.maybeSingle();

	return data ? { ...data, rolNombre: data.rol?.nombre ?? '' } : null;
}

/** Si ese rol se ocupa en este curso y lo elige el participante, no el sistema. */
export async function loEligeElParticipante(destinatario: string, rolCodigo: string) {
	const { data } = await supabase
		.from('roles_por_destinatario')
		.select('rol_codigo')
		.eq('destinatario', destinatario)
		.eq('rol_codigo', rolCodigo)
		.eq('lo_elige_el_participante', true)
		.maybeSingle();

	return data !== null;
}
