<script lang="ts">
	import { tick } from 'svelte';
	import QRCode from 'qrcode';
	import Inicio from '../../+page.svelte';
	import MisMesas from '../../mesas/+page.svelte';
	import Mesa from '../../mesas/[curso]/[numero]/+page.svelte';
	import Ciclo from '../../mesas/[curso]/[numero]/corridas/[corrida]/+page.svelte';
	import { ciclo, mesa, misMesas } from '../datos';

	/**
	 * Lo que muestra el teléfono, descrito por completo: la escena del video lo
	 * pide y esta página lo dibuja. Cambiar de estado vuelve a montar la pantalla,
	 * así cada cuadro sale igual sin importar desde dónde se llegó.
	 */
	type Estado = {
		pantalla: 'inicio' | 'mesas' | 'mesa' | 'ciclo';
		mesa?: Parameters<typeof mesa>[0];
		dialogo?: 'siguiente' | 'cierre' | null;
	};

	let estado = $state<Estado>({ pantalla: 'inicio' });
	let clave = $state('');
	const props = $derived(
		estado.pantalla === 'mesas'
			? misMesas()
			: estado.pantalla === 'mesa'
				? mesa(estado.mesa ?? {})
				: estado.pantalla === 'ciclo'
					? ciclo()
					: null
	);

	let qr = '';

	async function mostrar(nuevo: Estado) {
		const nueva = JSON.stringify(nuevo);
		if (nueva === clave) return false;
		estado = nuevo;
		clave = nueva;
		await tick();
		// El QR real sale de un endpoint con base de datos: acá se dibuja en el navegador.
		qr ||= await QRCode.toDataURL('https://simunam.com/m/mesas-manana/3', {
			errorCorrectionLevel: 'M',
			margin: 2,
			width: 512
		});
		for (const img of document.querySelectorAll<HTMLImageElement>('img[src$="/qr"]')) img.src = qr;
		if (nuevo.dialogo) {
			const boton = document.querySelector<HTMLButtonElement>(
				nuevo.dialogo === 'siguiente' ? '.acciones-mesa .boton.enviar' : '.acciones-mesa .boton.secundario'
			);
			boton?.click();
			await tick();
		}
		await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
		return true;
	}

	// Nada de lo que se toca en el video llega a un servidor.
	$effect(() => {
		const frenar = (e: Event) => {
			e.preventDefault();
			e.stopImmediatePropagation();
		};
		window.addEventListener('submit', frenar, true);
		(window as unknown as { pantalla: unknown }).pantalla = { mostrar };
		return () => window.removeEventListener('submit', frenar, true);
	});
</script>

<svelte:head>
	<style>
		/* Las transiciones las anima el video, cuadro por cuadro. */
		*,
		*::before,
		*::after {
			transition: none !important;
			animation: none !important;
			caret-color: transparent !important;
		}
		html {
			scrollbar-width: none;
		}
	</style>
</svelte:head>

{#key clave}
	{#if estado.pantalla === 'inicio'}
		<Inicio />
	{:else if estado.pantalla === 'mesas'}
		<MisMesas data={props!.data as any} form={props!.form as any} />
	{:else if estado.pantalla === 'mesa'}
		<Mesa data={props!.data as any} form={props!.form as any} />
	{:else}
		<Ciclo data={props!.data as any} />
	{/if}
{/key}
