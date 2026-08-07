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
	facilitador: 'Guiás al operador y recibís la planificación',
	operador: 'Practicás la técnica',
	asistente: 'Acompañás al operador durante la técnica'
};

/** Los observadores llevan checklist; el resto, no. */
export const esObservador = (rolCodigo: string) =>
	rolCodigo === 'observador_operacion' || rolCodigo === 'observador_tecnica';

export const practicaLaTecnica = (rolCodigo: string) =>
	rolCodigo === 'operador' || rolCodigo === 'asistente';
