// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		interface Locals {
			/** Si el pedido trae una sesión de administración válida. */
			admin: boolean;
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
