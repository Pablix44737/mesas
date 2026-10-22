import { createHmac } from 'node:crypto';
import { iguales, secretoDeFirma } from '$lib/server/firma';
import type { Cookies } from '@sveltejs/kit';

/**
 * Sesión de administración.
 *
 * Es la zona del sistema con clave: el líder de mesa y los participantes entran
 * sin credenciales, como pasa en el aula. No hay usuarios ni roles: hay una
 * clave por institución, compartida por quienes preparan sus eventos. Las
 * claves se dan de alta en la zona de plataforma —ver `plataforma.ts`—, que es
 * la única que está por encima de una institución.
 *
 * La sesión viaja firmada en la propia cookie y no se guarda nada en memoria:
 * en Vercel cada pedido puede caer en una instancia distinta, así que un
 * registro de sesiones en memoria se perdería entre pedido y pedido. Lo que la
 * cookie lleva es a qué institución pertenece quien administra, que es lo que
 * decide qué datos ve y de quién son los que crea.
 */

const COOKIE = 'simunam_admin';
const DURACION = 12 * 60 * 60 * 1000; // Una jornada de trabajo.

/**
 * Con qué se firma.
 *
 * Antes la firma derivaba de la clave de administración, lo que tenía la virtud
 * de invalidar sola las cookies viejas al cambiarla. Con una clave por
 * institución eso ya no sirve: habría que saber de qué institución es la cookie
 * para poder validarla, y eso es justamente lo que la firma tiene que probar.
 *
 * Deriva entonces solo del secreto de base. A cambio se pierde aquella
 * invalidación automática: cambiar la clave de una institución ya no corta las
 * sesiones abiertas, que caducan dentro de las 12 horas.
 */
const firmar = (vence: number, tenantId: string) =>
	createHmac('sha256', secretoDeFirma('simunam/sesion-admin/v2'))
		.update(`${vence}.${tenantId}`)
		.digest('hex');

export function abrirSesionDeAdmin(cookies: Cookies, tenantId: string) {
	const vence = Date.now() + DURACION;
	cookies.set(COOKIE, `${vence}.${tenantId}.${firmar(vence, tenantId)}`, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: DURACION / 1000
	});
}

export function cerrarSesionDeAdmin(cookies: Cookies) {
	cookies.delete(COOKIE, { path: '/' });
}

/** La institución de la sesión, o null si no hay una válida. */
export function tenantDeLaSesion(cookies: Cookies): string | null {
	const cookie = cookies.get(COOKIE);
	if (!cookie) return null;

	const [crudo, tenantId, firma] = cookie.split('.');
	const vence = Number(crudo);
	if (!Number.isFinite(vence) || !tenantId || !firma) return null;
	// El vencimiento se controla en el servidor: la cookie del navegador puede
	// haber sido retocada, la firma no cubre eso por sí sola.
	if (vence <= Date.now()) return null;

	return iguales(firma, firmar(vence, tenantId)) ? tenantId : null;
}
