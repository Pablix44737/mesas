/** Cómo se representa cada rol del modelo MESAS en la interfaz. */
export const iconoDeRol: Record<string, string> = {
	observador_operacion: 'escenario',
	observador_tecnica: 'observador',
	facilitador: 'facilitador',
	operador: 'operador',
	asistente: 'asistente'
};

export const queHaceElRol: Record<string, string> = {
	observador_operacion: 'Evaluás el desarrollo del escenario',
	observador_tecnica: 'Evaluás la ejecución de la técnica',
	facilitador: 'Recibís la planificación y evaluás la técnica',
	operador: 'Practicás la técnica',
	asistente: 'Acompañás al operador durante la técnica'
};

/** Los observadores llevan checklist; el resto, no. */
export const esObservador = (rolCodigo: string) =>
	rolCodigo === 'observador_operacion' || rolCodigo === 'observador_tecnica';

/**
 * Quiénes completan una lista de cotejo durante la corrida.
 *
 * No es lo mismo que `esObservador`: el facilitador también evalúa la técnica
 * —con el mismo checklist del escenario que usa su observador— pero no es un rol
 * observador. Esa distinción importa porque `roles.observador` decide de qué rol
 * puede ser una plantilla, y el facilitador no tiene una propia: usa la prestada.
 */
export const llevaChecklist = (rolCodigo: string) =>
	esObservador(rolCodigo) || rolCodigo === 'facilitador';

export const practicaLaTecnica = (rolCodigo: string) =>
	rolCodigo === 'operador' || rolCodigo === 'asistente';
