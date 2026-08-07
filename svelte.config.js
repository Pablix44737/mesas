import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
export default {
	preprocess: vitePreprocess(),
	kit: {
		// Node en funciones serverless: la app lee y escribe en Supabase en cada
		// pedido, así que no hay nada que prerenderizar.
		adapter: adapter({ runtime: 'nodejs22.x' })
	}
};
