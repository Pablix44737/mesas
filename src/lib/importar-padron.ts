import { dniValido, normalizarDni } from '$lib/dni';

/** Una persona leída del archivo, lista para sumarse al padrón. */
export type PersonaLeida = { fila: number; dni: string; apellido: string; nombre: string };

/** Una fila que no se puede incorporar, con el número que tiene en la planilla. */
export type FilaConError = { fila: number; motivo: string };

export type Lectura =
	| { personas: PersonaLeida[]; errores: FilaConError[] }
	| { falla: string };

export const EXTENSIONES_DEL_LISTADO = ['.xlsx', '.xls', '.ods', '.csv'];

/** Más que esto no es un listado de alumnos: es un archivo equivocado. */
export const MAXIMO_DE_FILAS = 2000;

type Columna = 'dni' | 'apellido' | 'nombre' | 'apellidoYNombre';

/** Sin mayúsculas, tildes ni signos: «Nº de Documento» queda «n de documento». */
const aplanar = (texto: string) =>
	texto
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();

function columnaDe(encabezado: unknown): Columna | null {
	const texto = aplanar(String(encabezado ?? ''));
	const palabras = texto.split(' ');
	const dice = (prefijo: string) => palabras.some((palabra) => palabra.startsWith(prefijo));

	// «D.N.I.» queda «d n i»: se mira también sin espacios.
	const esDni = dice('dni') || texto.replace(/ /g, '') === 'dni';
	if (esDni || dice('documento') || /^(n|nro|num|numero)? ?doc$/.test(texto)) return 'dni';
	if (dice('apellido') && dice('nombre')) return 'apellidoYNombre';
	if (dice('apellido')) return 'apellido';
	if (dice('nombre')) return 'nombre';
	return null;
}

/** Dónde está cada dato, si esta fila es la de los encabezados. */
function encabezados(fila: unknown[]): Partial<Record<Columna, number>> | null {
	const posiciones: Partial<Record<Columna, number>> = {};
	fila.forEach((celda, indice) => {
		const columna = columnaDe(celda);
		if (columna && posiciones[columna] === undefined) posiciones[columna] = indice;
	});

	const tieneElNombre =
		(posiciones.apellido !== undefined && posiciones.nombre !== undefined) ||
		posiciones.apellidoYNombre !== undefined;

	return posiciones.dni !== undefined && tieneElNombre ? posiciones : null;
}

const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'di', 'van', 'von']);

/**
 * Los listados suelen venir todo en mayúsculas («GONZÁLEZ MARÍA»). El padrón
 * los guarda como se escriben: «González», «María», «de la Fuente».
 */
export function capitalizar(texto: string): string {
	const limpio = texto.replace(/\s+/g, ' ').trim();
	const todoIgual = limpio === limpio.toUpperCase() || limpio === limpio.toLowerCase();
	if (!todoIgual) return limpio;

	return limpio
		.toLowerCase()
		.split(' ')
		.map((palabra, indice) =>
			indice > 0 && PARTICULAS.has(palabra)
				? palabra
				: palabra.replace(/(^|[-'’])(\p{L})/gu, (_, antes, letra) => antes + letra.toUpperCase())
		)
		.join(' ');
}

const texto = (celda: unknown) => (celda === null || celda === undefined ? '' : String(celda));

/** Excel guarda el DNI como número: 14156225, o 14156225.0 si la celda tiene decimales. */
const dniDe = (celda: unknown) =>
	typeof celda === 'number' ? String(Math.round(celda)) : normalizarDni(texto(celda));

/**
 * Recorre las filas de una hoja y separa lo que se puede incorporar de lo que no.
 * `primeraFila` es el número que la planilla le da a la primera, para que los
 * errores se puedan buscar en el archivo.
 */
export function interpretarFilas(filas: unknown[][], primeraFila = 1): Lectura {
	// Los encabezados no siempre están arriba de todo: muchas planillas llevan
	// antes un título o la fecha.
	const inicio = filas.slice(0, 10).findIndex((fila) => encabezados(fila) !== null);
	if (inicio === -1) {
		return { falla: 'El archivo tiene que tener las columnas DNI, Apellido y Nombre.' };
	}

	const columnas = encabezados(filas[inicio])!;
	const personas: PersonaLeida[] = [];
	const errores: FilaConError[] = [];
	const vistas = new Map<string, number>();

	for (let i = inicio + 1; i < filas.length; i++) {
		const fila = filas[i];
		const numero = primeraFila + i;
		if (fila.every((celda) => texto(celda).trim() === '')) continue;

		const dni = dniDe(fila[columnas.dni!]);
		let apellido: string;
		let nombre: string;

		if (columnas.apellido !== undefined && columnas.nombre !== undefined) {
			apellido = capitalizar(texto(fila[columnas.apellido]));
			nombre = capitalizar(texto(fila[columnas.nombre]));
		} else {
			const completo = texto(fila[columnas.apellidoYNombre!]);
			const coma = completo.indexOf(',');
			if (coma === -1 && completo.trim() !== '') {
				errores.push({ fila: numero, motivo: 'Falta la coma entre el apellido y el nombre' });
				continue;
			}
			apellido = capitalizar(completo.slice(0, Math.max(coma, 0)));
			nombre = capitalizar(completo.slice(coma + 1));
		}

		if (texto(fila[columnas.dni!]).trim() === '') {
			errores.push({ fila: numero, motivo: 'Falta el DNI' });
		} else if (!dniValido(dni)) {
			errores.push({ fila: numero, motivo: `El DNI «${texto(fila[columnas.dni!]).trim()}» no es válido` });
		} else if (apellido.length < 2) {
			errores.push({ fila: numero, motivo: 'Falta el apellido' });
		} else if (nombre.length < 2) {
			errores.push({ fila: numero, motivo: 'Falta el nombre' });
		} else if (vistas.has(dni)) {
			errores.push({ fila: numero, motivo: `El DNI ya aparece en la fila ${vistas.get(dni)}` });
		} else {
			vistas.set(dni, numero);
			personas.push({ fila: numero, dni, apellido, nombre });
		}
	}

	if (personas.length + errores.length === 0) {
		return { falla: 'El archivo no tiene personas debajo de los encabezados.' };
	}
	if (personas.length + errores.length > MAXIMO_DE_FILAS) {
		return { falla: `El archivo tiene más de ${MAXIMO_DE_FILAS} filas.` };
	}

	return { personas, errores };
}

/**
 * Un CSV guardado desde Excel en Windows no viene en UTF-8 sino en Windows-1252:
 * leído como UTF-8, «Núñez» llega roto. Se prueba primero UTF-8 estricto.
 */
function decodificar(bytes: ArrayBuffer): string {
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		return new TextDecoder('windows-1252').decode(bytes);
	}
}

/**
 * Excel en castellano separa con punto y coma; el resto del mundo, con coma. Se
 * miran varias líneas porque la primera puede ser un título sin separadores.
 */
function separadorDe(contenido: string): string {
	const comienzo = contenido.split(/\r?\n/, 10).join('\n');
	const cuenta = (signo: string) => comienzo.split(signo).length - 1;
	return [';', '\t', ','].reduce((mejor, signo) => (cuenta(signo) > cuenta(mejor) ? signo : mejor), ',');
}

/** Lee la planilla en el navegador. La librería se baja recién cuando hace falta. */
export async function leerListado(archivo: File): Promise<Lectura> {
	const XLSX = await import('xlsx');
	const bytes = await archivo.arrayBuffer();

	let libro: import('xlsx').WorkBook;
	try {
		if (archivo.name.toLowerCase().endsWith('.csv')) {
			const contenido = decodificar(bytes).replace(/^﻿/, '');
			// `raw` deja cada celda como texto: sin esto, un apellido como «Marzo»
			// podría leerse como una fecha.
			libro = XLSX.read(contenido, { type: 'string', raw: true, FS: separadorDe(contenido) });
		} else {
			libro = XLSX.read(bytes, { type: 'array' });
		}
	} catch {
		return { falla: 'No se pudo leer el archivo. Probá guardarlo de nuevo como .xlsx o .csv.' };
	}

	// La primera hoja que tenga los encabezados: a veces la primera es una carátula.
	let primeraFalla: Lectura | null = null;
	for (const nombre of libro.SheetNames) {
		const hoja = libro.Sheets[nombre];
		if (!hoja['!ref']) continue;
		const filas = XLSX.utils.sheet_to_json<unknown[]>(hoja, {
			header: 1,
			raw: true,
			defval: '',
			blankrows: true
		});
		const primeraFila = XLSX.utils.decode_range(hoja['!ref']).s.r + 1;
		const lectura = interpretarFilas(filas, primeraFila);
		if (!('falla' in lectura)) return lectura;
		primeraFalla ??= lectura;
	}

	return primeraFalla ?? { falla: 'El archivo está vacío.' };
}
