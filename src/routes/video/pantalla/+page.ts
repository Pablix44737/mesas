import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';

// El teléfono del video: las pantallas reales con datos inventados. Sólo en desarrollo.
export const ssr = false;

export const load = () => {
	if (!dev) error(404, 'Esta página no existe');
};
