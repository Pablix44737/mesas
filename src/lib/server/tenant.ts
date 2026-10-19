import { error } from '@sveltejs/kit';
import { supabase } from './supabase';

/**
 * A qué institución pertenece lo que se está por crear.
 *
 * Las cuatro tablas raíz —cursos, escenarios, checklist_plantillas y
 * participantes— tienen `tenant_id` NOT NULL y sin valor por defecto, a
 * propósito: un default haría que un alta que se olvidó del tenant funcionara
 * igual, cayendo siempre en la misma institución, y ése es justamente el error
 * que no queremos que pase inadvertido.
 *
 * Por ahora hay una sola y se la resuelve así. Cuando la sesión del
 * administrador lleve su institución —la etapa siguiente—, esto pasa a leerla de
 * ahí y deja de consultar.
 *
 * Mientras tanto falla a propósito si aparece una segunda: es preferible que el
 * alta se niegue a seguir, y no que elija una cualquiera y se la asigne a quien
 * no corresponde. El sistema se planta hasta que la identidad esté resuelta.
 */
export async function tenantActual(): Promise<string> {
	const { data, error: fallo } = await supabase.from('tenants').select('id').limit(2);

	if (fallo) error(500, fallo.message);
	if (!data || data.length === 0) error(500, 'No hay ninguna institución cargada.');

	if (data.length > 1) {
		error(
			500,
			'Hay más de una institución cargada y la sesión todavía no dice a cuál pertenece quien ' +
				'está administrando. Hasta que eso se resuelva, el sistema no puede dar de alta nada: ' +
				'elegir una al azar sería asignarle los datos a la institución equivocada.'
		);
	}

	return data[0].id;
}
