import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';

/**
 * Cómo se firma y cómo se compara.
 *
 * Está acá y no dentro de cada sesión porque hay dos: la de administración, que
 * pertenece a una institución, y la de plataforma, que está por encima de todas.
 * Lo que no puede pasar es que la cookie de una valga en la zona de la otra, y
 * eso se resuelve en un solo lugar.
 */

/**
 * De dónde sale el secreto.
 *
 * De la clave de servicio de la base, que ya es secreta y sin la cual la
 * aplicación no arranca. Así no hay un secreto más que configurar ni, lo que
 * importa más, un valor por defecto en el código: uno conocido permitiría
 * falsificar una sesión sin saber ninguna clave.
 *
 * `contexto` separa los usos —una cookie firmada para una zona no sirve en la
 * otra, aunque el secreto de base sea el mismo—. `partes` agrega lo que, si
 * cambia, tiene que invalidar sola las cookies ya emitidas.
 */
export function secretoDeFirma(contexto: string, ...partes: string[]) {
	const servicio = env.SUPABASE_SERVICE_ROLE_KEY;
	if (!servicio) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en el entorno del servidor.');

	return createHmac('sha256', contexto)
		.update([servicio, ...partes].join('\n'))
		.digest();
}

/** Comparación de largo constante: la longitud del valor no se filtra por el tiempo. */
export function iguales(a: string, b: string) {
	const uno = createHmac('sha256', 'simunam/comparacion').update(a).digest();
	const otro = createHmac('sha256', 'simunam/comparacion').update(b).digest();
	return timingSafeEqual(uno, otro);
}
