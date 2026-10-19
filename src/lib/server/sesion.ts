import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import type { Cookies } from '@sveltejs/kit';

/**
 * Sesión de administración.
 *
 * Es la única zona del sistema con clave: el líder de mesa y los participantes
 * entran sin credenciales, como pasa en el aula. No hay usuarios ni roles: hay
 * una clave por institución, compartida por quienes preparan sus eventos.
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
 * Deriva entonces de la clave de servicio de la base, que ya es secreta y sin la
 * cual la aplicación no arranca. Así no hay un secreto más que configurar ni, lo
 * que importa más, un valor por defecto en el código: uno conocido permitiría
 * falsificar una cookie de administración de cualquier institución sin saber
 * ninguna clave.
 *
 * A cambio se pierde aquella invalidación automática: cambiar la clave de una
 * institución ya no corta las sesiones abiertas, que caducan dentro de las 12
 * horas.
 */
function secretoDeFirma() {
	const clave = env.SUPABASE_SERVICE_ROLE_KEY;
	if (!clave) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en el entorno del servidor.');
	return createHmac('sha256', 'simunam/sesion-admin/v2').update(clave).digest();
}

/** La firma cubre el vencimiento y la institución: ni uno ni otra se pueden retocar. */
const firmar = (vence: number, tenantId: string) =>
	createHmac('sha256', secretoDeFirma()).update(`${vence}.${tenantId}`).digest('hex');

/** Comparación de largo constante: la longitud del valor no se filtra por el tiempo. */
function iguales(a: string, b: string) {
	const uno = createHmac('sha256', 'simunam/comparacion').update(a).digest();
	const otro = createHmac('sha256', 'simunam/comparacion').update(b).digest();
	return timingSafeEqual(uno, otro);
}

/**
 * La clave de transición. Vale sólo mientras una institución todavía no fijó la
 * suya; al usarla, el ingreso la adopta como clave de esa institución y esta
 * variable deja de tener efecto. Está para que el sistema que ya está en marcha
 * no quede afuera al repartirse las claves por institución.
 */
export const claveDeTransicion = () => env.CLAVE_ADMIN || 'centrosimu123';

export function claveDeTransicionCorrecta(intento: string) {
	return iguales(intento, claveDeTransicion());
}

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
