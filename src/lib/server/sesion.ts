import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import type { Cookies } from '@sveltejs/kit';

/**
 * Sesión de administración.
 *
 * Es la única zona del sistema con clave: el líder de mesa y los participantes
 * entran sin credenciales, como pasa en el aula. Acá no hay usuarios ni roles,
 * hay una sola clave compartida por quienes preparan el evento.
 *
 * La sesión viaja firmada en la propia cookie y no se guarda nada en memoria:
 * en Vercel cada pedido puede caer en una instancia distinta, así que un
 * registro de sesiones en memoria se perdería entre pedido y pedido.
 */

const COOKIE = 'simunam_admin';
const DURACION = 12 * 60 * 60 * 1000; // Una jornada de trabajo.

/** La clave se puede cambiar sin tocar el código, poniendo CLAVE_ADMIN en el entorno. */
const claveDeAdmin = () => env.CLAVE_ADMIN || 'centrosimu123';

/**
 * La firma se deriva de la clave: si mañana cambian CLAVE_ADMIN, las cookies
 * emitidas con la anterior dejan de validar solas, sin lista de revocación.
 */
const firmar = (vence: number) =>
	createHmac('sha256', `simunam/sesion-admin/v1/${claveDeAdmin()}`)
		.update(String(vence))
		.digest('hex');

/** Comparación de largo constante: la longitud de la clave no se filtra por el tiempo. */
function iguales(a: string, b: string) {
	const uno = createHmac('sha256', 'simunam/comparacion').update(a).digest();
	const otro = createHmac('sha256', 'simunam/comparacion').update(b).digest();
	return timingSafeEqual(uno, otro);
}

export function claveDeAdminCorrecta(intento: string) {
	return iguales(intento, claveDeAdmin());
}

export function abrirSesionDeAdmin(cookies: Cookies) {
	const vence = Date.now() + DURACION;
	cookies.set(COOKIE, `${vence}.${firmar(vence)}`, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: DURACION / 1000
	});
}

export function cerrarSesionDeAdmin(cookies: Cookies) {
	cookies.delete(COOKIE, { path: '/' });
}

export function haySesionDeAdmin(cookies: Cookies) {
	const cookie = cookies.get(COOKIE);
	if (!cookie) return false;

	const [crudo, firma] = cookie.split('.');
	const vence = Number(crudo);
	if (!Number.isFinite(vence) || !firma) return false;
	// El vencimiento se controla en el servidor: la cookie del navegador puede
	// haber sido retocada, la firma no cubre eso por sí sola.
	if (vence <= Date.now()) return false;

	return iguales(firma, firmar(vence));
}
