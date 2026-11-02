/**
 * Lo que muestra el teléfono, descrito por completo: el guion lo pide y la
 * pantalla lo dibuja. `datos` son los parámetros de la función de `datos.ts`
 * que corresponde a la pantalla. Después de dibujarla se escribe `escribir` y
 * se tocan los `clics`, en orden: así se abren las hojas de confirmación o se
 * elige un rol, con los mismos botones que usa la gente.
 */
export type Estado = {
	pantalla: 'inicio' | 'mesas' | 'mesa' | 'ciclo' | 'sumarse' | 'cotejo' | 'camara';
	datos?: Record<string, unknown>;
	escribir?: { sel: string; texto: string };
	clics?: string[];
	/** Lo que dice la barra de arriba del teléfono; por defecto, la dirección. */
	barra?: string;
};

/**
 * El guion de un video, en segundos de la voz. Todo lo que pasa en la imagen
 * cuelga de acá: qué muestra el teléfono, adónde se desplaza, qué se toca y qué
 * se resalta. Los tiempos salen de la transcripción por palabra de la voz.
 */
export type Guion = {
	/** El audio de la voz, relativo a la carpeta `video/`. */
	voz: string;
	/** El nombre del archivo que sale, sin extensión. */
	salida: string;
	/** La voz entra un poco después del primer cuadro. */
	demora: number;
	duracion: number;
	/** Debajo de «Guía rápida», en la tarjeta de apertura. */
	para: string;
	estados: [number, Estado][];
	/**
	 * Dónde está el desplazamiento del teléfono. Un selector se resuelve a la
	 * posición de ese elemento, menos el margen. Con `desde`, se llega de a poco
	 * entre `desde` y `v`; sin `desde`, salta en `v` (al cambiar de pantalla).
	 */
	desplazamientos: { v: number; y: number | string; margen?: number; desde?: number }[];
	/** Cada toque del dedo, sobre la palabra que lo pide. */
	toques: { v: number; sel: string }[];
	/** Lo que se marca con un anillo mientras la voz lo nombra. `url` es la barra de arriba. */
	resaltados: { v0: number; v1: number; sel: string }[];
	/** El título de cada paso, arriba del teléfono. */
	pasos: { v0: number; v1: number; numero: number; titulo: string }[];
	/** Una aclaración debajo del título, cuando hace falta. */
	notas: { v0: number; v1: number; texto: string }[];
	apertura: { hasta: number; sale: number };
	cierre: { desde: number; entra: number };
};
