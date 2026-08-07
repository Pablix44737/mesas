import { error } from '@sveltejs/kit';
import QRCode from 'qrcode';
import { supabase } from '$lib/server/supabase';
import type { RequestHandler } from './$types';

/**
 * Codigo QR de la mesa: apunta a `/m/<numero>`, donde el participante se
 * identifica y declara el rol que ocupa en la corrida habilitada.
 */
export const GET: RequestHandler = async ({ params, url }) => {
	const numero = Number(params.numero);
	if (!Number.isInteger(numero) || numero <= 0) error(404, 'Mesa inexistente');

	const { data: mesa } = await supabase
		.from('mesas')
		.select('numero')
		.eq('numero', numero)
		.maybeSingle();

	if (!mesa) error(404, `No existe la mesa ${numero}`);

	const destino = new URL(`/m/${numero}`, url.origin).toString();
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
