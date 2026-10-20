import { createHmac } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { iguales, secretoDeFirma } from '$lib/server/firma';
import type { Cookies } from '@sveltejs/kit';

/**
 * Sesión de plataforma.
 *
 * La única zona que está por encima de una institución: la que las da de alta y
 * les restablece la clave. No es un usuario ni una fila de la base — es el
 * entorno. Quien tiene `CLAVE_PLATAFORMA` es quien despliega el sistema, que es
 * exactamente quien hoy podría hacer esto mismo por SQL.
 *
 * Si algún día el alta la tiene que dar alguien que no despliega, lo que se
 * agrega es una tabla de superadmins y cambia solo cómo se autentica: la zona,
 * la cookie y las pantallas ya quedan hechas.
 *
 * No hay clave por defecto a propósito. Sin la variable configurada la zona no
 * existe —devuelve 404, como cualquier dirección inventada—, en vez de existir
 * con una clave que está en el código.
 */

const COOKIE = 'simunam_plataforma';
const DURACION = 2 * 60 * 60 * 1000; // Se entra, se da un alta y se sale.

export const claveDeLaPlataforma = () => env.CLAVE_PLATAFORMA ?? '';

/** Si no hay clave configurada, la zona entera no existe. */
export const hayZonaDePlataforma = () => claveDeLaPlataforma().length > 0;

/**
 * Acá sí la clave entra en el secreto de firma, y eso recupera algo que la
 * sesión de administración tuvo que resignar: cambiar `CLAVE_PLATAFORMA` —o
 * sacarla— corta en el acto las sesiones abiertas. Se puede porque hay una sola
 * clave para toda la zona, así que validar la cookie no exige saber de antemano
 * de quién es.
 */
const firmar = (vence: number) =>
	createHmac('sha256', secretoDeFirma('simunam/sesion-plataforma/v1', claveDeLaPlataforma()))
		.update(String(vence))
		.digest('hex');

export function claveDePlataformaCorrecta(intento: string) {
	return hayZonaDePlataforma() && iguales(intento, claveDeLaPlataforma());
}

export function abrirSesionDePlataforma(cookies: Cookies) {
	const vence = Date.now() + DURACION;
	cookies.set(COOKIE, `${vence}.${firmar(vence)}`, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: DURACION / 1000
	});
}

export function cerrarSesionDePlataforma(cookies: Cookies) {
	cookies.delete(COOKIE, { path: '/' });
}

export function haySesionDePlataforma(cookies: Cookies): boolean {
	if (!hayZonaDePlataforma()) return false;

	const cookie = cookies.get(COOKIE);
	if (!cookie) return false;

	const [crudo, firma] = cookie.split('.');
	const vence = Number(crudo);
	if (!Number.isFinite(vence) || !firma) return false;
	if (vence <= Date.now()) return false;

	return iguales(firma, firmar(vence));
}
