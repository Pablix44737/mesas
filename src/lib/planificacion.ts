/** Formatos en que se acepta la planificación del escenario. */
export const TIPOS_ACEPTADOS: Record<string, string> = {
	'application/pdf': '.pdf',
	'application/msword': '.doc',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx'
};

export const EXTENSIONES_ACEPTADAS = ['.pdf', '.doc', '.docx'];

/** El bucket rechaza cualquier cosa más grande; lo validamos antes para dar un mensaje claro. */
export const TAMANO_MAXIMO = 20 * 1024 * 1024;

export function extensionDe(nombreArchivo: string): string {
	const punto = nombreArchivo.lastIndexOf('.');
	return punto === -1 ? '' : nombreArchivo.slice(punto).toLowerCase();
}

/**
 * Algunos navegadores mandan el content-type vacío o genérico para .doc y .docx,
 * así que la extensión alcanza para aceptar el archivo.
 */
export function tipoAceptado(tipo: string, nombreArchivo: string): boolean {
	if (tipo in TIPOS_ACEPTADOS) return true;
	return EXTENSIONES_ACEPTADAS.includes(extensionDe(nombreArchivo));
}

/** Content-type con el que guardamos, cuando el navegador no manda uno útil. */
export function tipoNormalizado(tipo: string, nombreArchivo: string): string {
	if (tipo in TIPOS_ACEPTADOS) return tipo;
	switch (extensionDe(nombreArchivo)) {
		case '.pdf':
			return 'application/pdf';
		case '.doc':
			return 'application/msword';
		case '.docx':
			return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
		default:
			return 'application/octet-stream';
	}
}

export function mostrarTamano(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
