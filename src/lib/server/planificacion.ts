import { error } from '@sveltejs/kit';
import { supabase } from './supabase';

type Adjunto = {
	planificacion_ruta: string | null;
	planificacion_archivo: string | null;
	planificacion_tipo: string | null;
};

/**
 * Sirve la planificación desde el bucket privado. El objeto no es alcanzable por
 * URL directa: siempre pasa por un endpoint del servidor. Lo usan tanto la
 * pantalla de administración como la de la mesa, que la hereda de su escenario.
 */
export async function responderConLaPlanificacion(escenario: Adjunto): Promise<Response> {
	if (!escenario.planificacion_ruta) {
		error(404, 'Este escenario no tiene planificación adjunta');
	}

	const { data: archivo, error: fallo } = await supabase.storage
		.from('planificaciones')
		.download(escenario.planificacion_ruta);

	if (fallo || !archivo) error(500, 'No se pudo leer la planificación');

	const tipo = escenario.planificacion_tipo ?? 'application/octet-stream';
	// El PDF se abre en el visor del navegador; el Word se descarga.
	const disposicion = tipo === 'application/pdf' ? 'inline' : 'attachment';
	const nombre = encodeURIComponent(escenario.planificacion_archivo ?? 'planificacion');

	return new Response(archivo, {
		headers: {
			'content-type': tipo,
			'content-disposition': `${disposicion}; filename*=UTF-8''${nombre}`,
			'cache-control': 'private, no-store'
		}
	});
}
