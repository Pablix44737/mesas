import { error } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import { cursoPorCodigo } from '$lib/server/mesas';
import { tenantActual } from '$lib/server/tenant';
import type { RequestHandler } from './$types';

/**
 * Todas las evaluaciones enviadas en el curso, en una planilla: una fila por
 * criterio respondido, para archivar la edición o trabajarla en otro lado.
 *
 * Separada por punto y coma y con BOM, que es lo que Excel en español abre sin
 * preguntar: con coma, los decimales de los pesos se mezclarían con las columnas.
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const curso = await cursoPorCodigo(params.curso, tenantActual(locals));

	const { data: mesas } = await supabase
		.from('mesas')
		.select('id, numero, escenario:escenarios(nombre)')
		.eq('curso_id', curso.id);

	const escenarioDe = new Map((mesas ?? []).map((m) => [m.id, m.escenario?.nombre ?? '']));
	const idsDeMesas = (mesas ?? []).map((m) => m.id);
	if (idsDeMesas.length === 0) error(404, 'Este curso todavía no tiene mesas');

	const { data: evaluaciones, error: fallo } = await supabase
		.from('evaluaciones_enviadas')
		.select('*')
		.in('mesa_id', idsDeMesas)
		.order('mesa_numero')
		.order('corrida_numero')
		.order('rol_orden');

	if (fallo) error(500, fallo.message);

	const enviadas = evaluaciones ?? [];
	const instancias = enviadas.map((e) => e.instancia_id).filter((id) => id !== null);
	const plantillas = [...new Set(enviadas.map((e) => e.plantilla_id).filter((id) => id !== null))];

	const [{ data: items }, { data: respuestas }] =
		enviadas.length > 0
			? await Promise.all([
					supabase
						.from('checklist_items')
						.select('id, plantilla_id, orden, texto, peso')
						.in('plantilla_id', plantillas)
						.order('orden'),
					supabase
						.from('checklist_respuestas')
						.select('instancia_id, item_id, cumplido')
						.in('instancia_id', instancias)
				])
			: [{ data: [] }, { data: [] }];

	const cumplidos = new Set(
		(respuestas ?? []).filter((r) => r.cumplido).map((r) => `${r.instancia_id}:${r.item_id}`)
	);

	const celda = (valor: unknown) => {
		const texto = valor === null || valor === undefined ? '' : String(valor);
		return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
	};
	const decimal = (n: unknown) => String(Number(n ?? 0)).replace('.', ',');
	const fechaYHora = (iso: string | null) =>
		iso
			? new Date(iso).toLocaleString('es-AR', {
					dateStyle: 'short',
					timeStyle: 'short',
					hour12: false,
					timeZone: 'America/Argentina/Buenos_Aires'
				})
			: '';

	const filas: unknown[][] = [
		[
			'Mesa',
			'Escenario',
			'Ciclo',
			'Rol',
			'Observador',
			'DNI',
			'Enviada',
			'Checklist',
			'Resultado',
			'Máximo',
			'N.º',
			'Criterio',
			'Peso',
			'Hizo'
		]
	];

	for (const e of enviadas) {
		const suyos = (items ?? []).filter((i) => i.plantilla_id === e.plantilla_id);
		suyos.forEach((item, i) => {
			filas.push([
				e.mesa_numero,
				escenarioDe.get(e.mesa_id ?? '') ?? '',
				e.corrida_numero,
				e.rol_nombre,
				e.observador_nombre ?? 'Sin identificar',
				e.observador_dni,
				fechaYHora(e.enviada_en),
				e.checklist,
				decimal(e.resultado),
				decimal(e.maximo),
				i + 1,
				item.texto,
				decimal(item.peso),
				cumplidos.has(`${e.instancia_id}:${item.id}`) ? 'Sí' : 'No'
			]);
		});
	}

	const csv = '﻿' + filas.map((fila) => fila.map(celda).join(';')).join('\r\n') + '\r\n';

	return new Response(csv, {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="evaluaciones-${curso.codigo}.csv"`,
			'cache-control': 'no-store'
		}
	});
};
