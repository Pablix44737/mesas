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
