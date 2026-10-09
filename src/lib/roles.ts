/** Cómo se representa cada rol del modelo MESAS en la interfaz. */
export const iconoDeRol: Record<string, string> = {
	observador_operacion: 'escenario',
	observador_proceso: 'corrida',
	observador_tecnica: 'observador',
	facilitador: 'facilitador',
	operador: 'operador',
	asistente: 'asistente'
};

export const queHaceElRol: Record<string, string> = {
	observador_operacion: 'Evaluás el desempeño del facilitador',
	observador_proceso: 'Evaluás cómo se desarrolla la simulación',
	observador_tecnica: 'Evaluás la ejecución de la técnica',
	facilitador: 'Recibís la planificación y evaluás la técnica',
	operador: 'Practicás la técnica',
	asistente: 'Acompañás al operador durante la técnica'
};

/**
 * De dónde sale la lista de cotejo que completa cada rol. Espeja `roles.checklist`
 * en la base, que es la que manda:
 *
 *   `comun`          una plantilla propia del rol, la misma para todas las mesas
 *   `del_escenario`  la lista de cotejo de la técnica que trae el escenario
 *   `null`           el rol no evalúa
 */
export type OrigenDelChecklist = 'comun' | 'del_escenario' | null;

/**
 * Quién evalúa durante la corrida, a partir de lo que dijo la base.
 *
 * Se recibe el origen en vez de deducirlo del código del rol porque los roles son
 * datos: el observador del proceso nació sin tocar una línea de esta función, y el
 * que venga después tampoco debería tener que tocarla.
 */
export const llevaChecklist = (origen: OrigenDelChecklist) => origen !== null;

export const practicaLaTecnica = (rolCodigo: string) =>
	rolCodigo === 'operador' || rolCodigo === 'asistente';
