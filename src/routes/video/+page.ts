import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';

// Escenario para grabar el video de los líderes de mesa: sólo existe en desarrollo.
export const ssr = false;

export const load = () => {
	if (!dev) error(404, 'Esta página no existe');
};
