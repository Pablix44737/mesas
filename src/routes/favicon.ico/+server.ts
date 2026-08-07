import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * El navegador pide `/favicon.ico` por su cuenta aunque el documento declare
 * otro icono. Sin esto, cada navegación deja un 404 en la consola.
 */
export const GET: RequestHandler = () => redirect(301, '/icon.svg');
