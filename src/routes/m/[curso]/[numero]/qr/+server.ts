import QRCode from 'qrcode';
import { mesaDelCurso } from '$lib/server/mesas';
import type { RequestHandler } from './$types';

/**
 * Código QR de la mesa: apunta a `/m/<curso>/<numero>`, donde el participante se
 * identifica y declara el rol que ocupa en la corrida habilitada.
 *
 * El código del curso va en la URL porque los números de mesa vuelven a empezar
 * en 1 en cada edición: sin él, `/m/1` sería de todas y de ninguna.
 */
export const GET: RequestHandler = async ({ params, url }) => {
	const { curso, mesa } = await mesaDelCurso(params.curso, params.numero);

	const destino = new URL(`/m/${curso.codigo}/${mesa.numero}`, url.origin).toString();
	const svg = await QRCode.toString(destino, {
		type: 'svg',
		errorCorrectionLevel: 'M',
		margin: 2,
		width: 512
	});

	return new Response(svg, {
		headers: {
			'content-type': 'image/svg+xml; charset=utf-8',
			'cache-control': 'public, max-age=3600'
		}
	});
};
