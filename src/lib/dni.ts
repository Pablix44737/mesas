/** Deja solo los digitos: tolera puntos, espacios y guiones al tipear. */
export function normalizarDni(valor: string): string {
	return valor.replace(/\D/g, '');
}

/** Un DNI valido para el sistema es una cadena de 6 a 9 digitos. */
export function dniValido(dni: string): boolean {
	return /^\d{6,9}$/.test(dni);
}

/** Formatea un DNI con separadores de miles para mostrarlo. */
export function mostrarDni(dni: string): string {
	return dni.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
