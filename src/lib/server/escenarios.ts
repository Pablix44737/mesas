import type { Cookies } from '@sveltejs/kit';

/**
 * Al eliminar un escenario se vuelve a la lista, que ya no tiene de dónde sacar
 * cuál era. Su nombre viaja en una cookie que la lista lee una sola vez.
 */
const COOKIE = 'escenario-eliminado';
const RUTA = '/admin/escenarios';

export function recordarEliminado(cookies: Cookies, nombre: string) {
	cookies.set(COOKIE, nombre, { path: RUTA, maxAge: 60, httpOnly: true, sameSite: 'lax' });
}

export function leerEliminado(cookies: Cookies): string | null {
	const nombre = cookies.get(COOKIE) ?? null;
	if (nombre) cookies.delete(COOKIE, { path: RUTA });
	return nombre;
}
