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
 * Que no exista el curso y que no exista la mesa son dos errores distintos para
 * quien escanea, así que se distinguen. Pero sólo cuando la mesa no aparece: en el
 * caso de todos los días alcanza una consulta (ver `mesaDelCurso`).
 *
 * `tenantId` acota a una institución. Lo pasa la administración, donde quien
 * consulta tiene sesión y no tiene por qué llegar a los cursos de otra pegando un
 * código en la barra. Las zonas del líder y del participante no lo pasan: ahí no
 * hay sesión, y el código del curso —único en todo el sistema— ya determina de
 * qué institución es lo que se está abriendo.
 *
 * Que no exista y que sea de otra institución devuelven lo mismo a propósito: así
 * la pantalla no sirve para averiguar qué códigos existen en otro lado.
 */
export async function cursoPorCodigo(codigo: string, tenantId?: string) {
	const consulta = supabase
		.from('cursos')
		.select('id, codigo, nombre, archivado, destinado_a, tenant_id')
		.eq('codigo', codigo);

	const { data, error: fallo } = await (tenantId
		? consulta.eq('tenant_id', tenantId)
		: consulta
	).maybeSingle();

	if (fallo) error(500, fallo.message);
	if (!data) error(404, 'Ese curso no existe');

	return data;
}

/**
 * Lo que trae cada búsqueda de una mesa: lo suyo, su curso y su escenario. Casi
 * todas las pantallas de mesa necesitan las tres cosas, así que van juntas en una
 * sola consulta en vez de una por cada una.
 */
const DE_LA_MESA = `id, numero, creada_en, curso_id, docente_dni,
	curso:cursos!inner(id, codigo, nombre, archivado, destinado_a, tenant_id),
	escenario:escenarios(
		id, nombre, planificacion_archivo, planificacion_tamano,
		checklist_tecnica:checklist_plantillas(id, nombre, ponderado)
	)`;

export async function mesaDelCurso(
	codigoDelCurso: string,
	numeroCrudo: string,
	tenantId?: string
) {
	const numero = Number(numeroCrudo);
	if (!Number.isInteger(numero) || numero <= 0) error(404, 'Mesa inexistente');

	// El curso viaja dentro de la misma consulta, filtrado por su código: un solo
	// viaje a la base en el caso de todos los días, que es que la mesa exista.
	let consulta = supabase
		.from('mesas')
		.select(DE_LA_MESA)
		.eq('numero', numero)
		.eq('cursos.codigo', codigoDelCurso);
	if (tenantId) consulta = consulta.eq('cursos.tenant_id', tenantId);

	const { data: mesa, error: fallo } = await consulta.maybeSingle();

	if (fallo) error(500, fallo.message);

	if (!mesa || !mesa.curso) {
		// Recién acá se distingue cuál de las dos cosas no existe: consultar el curso
		// solo tira su propio 404 si es el curso el que falta.
		const curso = await cursoPorCodigo(codigoDelCurso, tenantId);
		error(404, `El curso ${curso.nombre} no tiene una mesa ${numero}`);
	}

	return { curso: mesa.curso, mesa };
}

/** La raíz de una mesa en cada zona del sistema, para no repetir el armado. */
export const rutaDelParticipante = (codigo: string, numero: number) => `/m/${codigo}/${numero}`;
export const rutaDelLider = (codigo: string, numero: number) => `/mesas/${codigo}/${numero}`;
export const rutaDelAdmin = (codigo: string, numero: number) =>
	`/admin/cursos/${codigo}/mesas/${numero}`;
