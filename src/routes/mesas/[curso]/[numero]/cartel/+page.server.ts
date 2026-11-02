import { mesaDelCurso } from '$lib/server/mesas';
import type { PageServerLoad } from './$types';

/**
 * El cartel de la mesa: el QR grande, con el número a la vista, para proyectar,
 * imprimir o dejar sobre la mesa. Antes esto era el SVG pelado del endpoint del
 * QR, sin número ni forma de imprimirlo desde un teléfono.
 */
export const load: PageServerLoad = async ({ params, url }) => {
	const { curso, mesa: encontrada } = await mesaDelCurso(params.curso, params.numero);

	// Sólo lo que muestra el cartel: es una página pública.
	const mesa = {
		numero: encontrada.numero,
		escenario: encontrada.escenario ? { nombre: encontrada.escenario.nombre } : null
	};

	return { curso, mesa, origen: url.origin };
};
