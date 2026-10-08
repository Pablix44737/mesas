import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
export default {
	preprocess: vitePreprocess(),
	kit: {
		// Node en funciones serverless: la app lee y escribe en Supabase en cada
		// pedido, así que no hay nada que prerenderizar.
		//
		// `gru1` (São Paulo) es la misma región donde está la base. Sin esto Vercel
		// ejecutaba en `iad1` (Washington): cada consulta cruzaba el continente dos
		// veces, ~230 ms de ida y vuelta, mientras la base resolvía en 2 ms. Una
		// pantalla con cinco consultas encadenadas se iba a dos segundos sin que
		// nadie estuviera haciendo nada lento. Estando al lado, ese viaje es de ~2 ms.
		adapter: adapter({ runtime: 'nodejs22.x', regions: ['gru1'] })
	}
};
