import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import type { Database } from '$lib/database.types';

/**
 * Cliente de servidor.
 *
 * Los participantes se identifican solo por DNI, sin credencial, así que ninguna
 * tabla se expone al navegador: todas tienen RLS activo y ninguna política, lo
 * que las deja inaccesibles para las claves publicables. Todo el acceso pasa por
 * este cliente, que corre únicamente en el servidor. El bucket `planificaciones`
 * es privado y se sirve por endpoint, nunca por URL directa.
 *
 * Las claves se leen del entorno en runtime (`$env/dynamic/private`) y el cliente
 * se crea recién en el primer uso. Con `$env/static/private` el build las exigía
 * y fallaba en cualquier plataforma donde las variables se configuran después de
 * crear el proyecto.
 */
let cliente: SupabaseClient<Database> | null = null;

function obtenerCliente(): SupabaseClient<Database> {
	if (cliente) return cliente;

	const url = env.SUPABASE_URL;
	const clave = env.SUPABASE_SERVICE_ROLE_KEY;

	if (!url || !clave) {
		throw new Error(
			'Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en el entorno del servidor.'
		);
	}

	cliente = createClient<Database>(url, clave, {
		auth: { persistSession: false, autoRefreshToken: false }
	});
	return cliente;
}

export const supabase = new Proxy({} as SupabaseClient<Database>, {
	get(_, propiedad) {
		const real = obtenerCliente() as unknown as Record<string | symbol, unknown>;
		const valor = real[propiedad];
		return typeof valor === 'function' ? valor.bind(real) : valor;
	}
});
