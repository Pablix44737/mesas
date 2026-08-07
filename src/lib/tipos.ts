export type Rol = {
	codigo: string;
	nombre: string;
	observador: boolean;
	orden: number;
};

/**
 * `en_construccion`: el administrador la está cargando, no se usa todavía.
 * `disponible`: terminada, se puede asociar a un escenario y presentar en una mesa.
 * `reemplazada`: fue el checklist de la operación vigente hasta que otro lo sustituyó.
 */
export type EstadoDeChecklist = 'en_construccion' | 'disponible' | 'reemplazada';

export type PlantillaChecklist = {
	id: string;
	rol_codigo: string;
	nombre: string;
	ponderado: boolean;
	estado: EstadoDeChecklist;
};

/**
 * Fila de `public.resultados_de_evaluacion`. El resultado se calcula contra los
 * pesos vigentes, así que cambiar la ponderación de un ítem también cambia el
 * resultado de las evaluaciones ya enviadas.
 */
export type ResultadoDeEvaluacion = {
	resultado: number;
	maximo: number;
	itemsCumplidos: number;
	items: number;
	/** Proporción de los criterios cumplida, de 0 a 100. */
	porcentaje: number;
};

export type Escenario = {
	id: string;
	nombre: string;
	checklist_tecnica_id: string | null;
	/** Ruta del objeto en el bucket privado `planificaciones`. */
	planificacion_ruta: string | null;
	/** Nombre con que el administrador subió el archivo. */
	planificacion_archivo: string | null;
	planificacion_tipo: string | null;
	planificacion_tamano: number | null;
	planificacion_subida_en: string | null;
	disponible: boolean;
	creado_en: string;
};
