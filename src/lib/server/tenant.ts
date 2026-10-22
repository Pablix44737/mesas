import { error } from '@sveltejs/kit';

/**
 * A qué institución pertenece lo que se está por crear.
 *
 * Sale de la sesión, que el guardián de `hooks.server.ts` ya resolvió de la
 * cookie firmada. No consulta la base: la institución es parte de la credencial,
 * no un dato que haya que ir a buscar.
 *
 * Las cuatro tablas raíz —cursos, escenarios, checklist_plantillas y
 * participantes— tienen `tenant_id` NOT NULL y sin valor por defecto, a
 * propósito: un default haría que un alta que se olvidó de la institución
 * funcionara igual, cayendo siempre en la misma, y ése es justamente el error
 * que no queremos que pase inadvertido.
 *
 * Que falte acá sería un error de programación, no una falta de permiso: a este
 * punto no se llega sin pasar por el guardián, que ya redirige a `/ingresar`.
 */
export function tenantActual(locals: App.Locals): string {
	if (!locals.tenantId) {
		error(500, 'La sesión no dice a qué institución pertenece quien está administrando.');
	}

	return locals.tenantId;
}
