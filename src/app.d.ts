// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		interface Locals {
			/**
			 * La institución de la sesión de administración, o null si el pedido no
			 * trae una válida. Es a la vez la credencial —hay sesión— y el alcance
			 * —de quién son los datos que puede ver y crear—.
			 */
			tenantId: string | null;
			/**
			 * Si el pedido trae una sesión de plataforma válida: la zona que da de
			 * alta instituciones y les restablece la clave. No es una institución ni
			 * un usuario, así que no tiene más que decir que sí o no.
			 */
			plataforma: boolean;
		}
		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	/**
	 * Lector de códigos del navegador. Todavía no está en las librerías de tipos
	 * de TypeScript porque no lo implementan todos los navegadores: en la pantalla
	 * del participante se comprueba en tiempo de ejecución antes de usarlo.
	 */
	class BarcodeDetector {
		constructor(opciones?: { formats?: string[] });
		detect(fuente: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
	}
}

export {};
