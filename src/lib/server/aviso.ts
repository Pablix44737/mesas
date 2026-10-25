import type { Cookies } from '@sveltejs/kit';

/**
 * Al eliminar algo se vuelve a la lista, que ya no tiene de dónde sacar qué era.
 * El nombre viaja en una cookie acotada a esa lista, que la lee una sola vez.
 */
const COOKIE = 'eliminado';

export function recordarEliminado(cookies: Cookies, lista: string, nombre: string) {
	cookies.set(COOKIE, nombre, { path: lista, maxAge: 60, httpOnly: true, sameSite: 'lax' });
}

export function leerEliminado(cookies: Cookies, lista: string): string | null {
	const nombre = cookies.get(COOKIE) ?? null;
	if (nombre) cookies.delete(COOKIE, { path: lista });
	return nombre;
}

/**
 * Lo mismo, pero con el mensaje entero: cuando lo que se eliminó arrastró otras
 * cosas, la pantalla a la que se vuelve no sabría contarlas.
 */
const AVISO = 'aviso';

export function avisar(cookies: Cookies, ruta: string, texto: string) {
	cookies.set(AVISO, texto, { path: ruta, maxAge: 60, httpOnly: true, sameSite: 'lax' });
}

export function leerAviso(cookies: Cookies, ruta: string): string | null {
	const texto = cookies.get(AVISO) ?? null;
	if (texto) cookies.delete(AVISO, { path: ruta });
	return texto;
}
