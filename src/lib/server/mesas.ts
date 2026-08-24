import { error } from '@sveltejs/kit';
import { supabase } from './supabase';

/**
 * Resolver una mesa desde la URL.
 *
 * El número de mesa vuelve a empezar en 1 en cada curso, así que solo no
 * identifica nada: hace falta el par. Todas las rutas de mesa —la del
 * participante, la del líder y la del administrador— pasan por acá para que la
 * resolución sea una sola y no tres parecidas.
 *
 * Son dos consultas y no un embed filtrado a propósito: `curso.codigo` es la
 * parte que viene de la URL y conviene poder distinguir «ese curso no existe» de
 * «ese curso no tiene esa mesa», que son dos errores distintos para quien escanea.
 */
export async function cursoPorCodigo(codigo: string) {
	const { data, error: fallo } = await supabase
		.from('cursos')
		.select('id, codigo, nombre, archivado')
		.eq('codigo', codigo)
		.maybeSingle();

	if (fallo) error(500, fallo.message);
	if (!data) error(404, 'Ese curso no existe');

	return data;
}

export async function mesaDelCurso(codigoDelCurso: string, numeroCrudo: string) {
	const numero = Number(numeroCrudo);
	if (!Number.isInteger(numero) || numero <= 0) error(404, 'Mesa inexistente');

	const curso = await cursoPorCodigo(codigoDelCurso);

	const { data: mesa, error: fallo } = await supabase
		.from('mesas')
		.select('id, numero, creada_en, curso_id')
		.eq('curso_id', curso.id)
		.eq('numero', numero)
		.maybeSingle();

	if (fallo) error(500, fallo.message);
	if (!mesa) error(404, `El curso ${curso.nombre} no tiene una mesa ${numero}`);

	return { curso, mesa };
}

/** La raíz de una mesa en cada zona del sistema, para no repetir el armado. */
export const rutaDelParticipante = (codigo: string, numero: number) => `/m/${codigo}/${numero}`;
export const rutaDelLider = (codigo: string, numero: number) => `/mesas/${codigo}/${numero}`;
export const rutaDelAdmin = (codigo: string, numero: number) =>
	`/admin/cursos/${codigo}/mesas/${numero}`;
