<script lang="ts">
	import { tick } from 'svelte';
	import QRCode from 'qrcode';
	import Icono from '$lib/Icono.svelte';
	import Inicio from '../../+page.svelte';
	import MisMesas from '../../mesas/+page.svelte';
	import Mesa from '../../mesas/[curso]/[numero]/+page.svelte';
	import Ciclo from '../../mesas/[curso]/[numero]/corridas/[corrida]/+page.svelte';
	import Sumarse from '../../m/[curso]/[numero]/+page.svelte';
	import Cotejo from '../../m/[curso]/[numero]/participacion/[participacionId]/+page.svelte';
	import { ciclo, cotejo, mesa, misMesas, sumarse } from '../datos';
	import type { Estado } from '../tipos';

	/**
	 * El teléfono del video: las pantallas reales con datos inventados. Cambiar de
	 * estado vuelve a montar la pantalla, así cada cuadro sale igual sin importar
	 * desde dónde se llegó.
	 */
	const DESTINO = 'https://simunam.com/m/mesas-manana/3';

	let estado = $state<Estado>({ pantalla: 'inicio' });
	let clave = $state('');
	let qr = $state('');

	const props = $derived.by(() => {
		const datos = (estado.datos ?? {}) as never;
		switch (estado.pantalla) {
			case 'mesas':
				return misMesas();
			case 'mesa':
				return mesa(datos);
			case 'ciclo':
				return ciclo();
			case 'sumarse':
				return sumarse();
			case 'cotejo':
				return cotejo(datos);
			default:
				return null;
		}
	});

	async function mostrar(nuevo: Estado) {
		const nueva = JSON.stringify(nuevo);
		if (nueva === clave) return false;
		qr ||= await QRCode.toDataURL(DESTINO, { errorCorrectionLevel: 'M', margin: 2, width: 512 });
		estado = nuevo;
		clave = nueva;
		await tick();
		// El QR real sale de un endpoint con base de datos: acá se dibuja en el navegador.
		for (const img of document.querySelectorAll<HTMLImageElement>('img[src$="/qr"]')) img.src = qr;
		if (nuevo.escribir) {
			const campo = document.querySelector<HTMLInputElement>(nuevo.escribir.sel);
			if (campo) {
				campo.value = nuevo.escribir.texto;
				campo.dispatchEvent(new Event('input', { bubbles: true }));
				campo.focus({ preventScroll: true });
			}
		}
		for (const sel of nuevo.clics ?? []) {
			document.querySelector<HTMLElement>(sel)?.click();
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
	{:else if estado.pantalla === 'camara'}
		<!-- No es una pantalla de la app: es la cámara del teléfono leyendo el cartel. -->
		<div class="camara">
			<div class="visor">
				<img src={qr} alt="" />
				<span class="linea" aria-hidden="true"></span>
				<span class="esquina a"></span><span class="esquina b"></span>
				<span class="esquina c"></span><span class="esquina d"></span>
			</div>
			<p class="camara-ayuda">Apuntá al QR de tu mesa</p>
			{#if estado.datos?.detectado}
				<a class="enlace" href={DESTINO}>
					<Icono nombre="externo" tamano={16} />
					<span>simunam.com/m/mesas-manana/3</span>
				</a>
			{/if}
		</div>
	{:else if estado.pantalla === 'mesas'}
		<MisMesas data={props!.data as any} form={props!.form as any} />
	{:else if estado.pantalla === 'mesa'}
		<Mesa data={props!.data as any} form={props!.form as any} />
	{:else if estado.pantalla === 'ciclo'}
		<Ciclo data={props!.data as any} />
	{:else if estado.pantalla === 'sumarse'}
		<Sumarse data={props!.data as any} form={props!.form as any} />
	{:else}
		<Cotejo data={props!.data as any} form={props!.form as any} />
	{/if}
{/key}

<style>
	.camara {
		position: fixed;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 22px;
		background:
			radial-gradient(circle at 50% 40%, #3b4a55, #0c1419 75%);
		color: #fff;
	}
	.visor {
		position: relative;
		width: 230px;
		height: 230px;
		padding: 14px;
		box-sizing: border-box;
		background: #fff;
		border-radius: 10px;
		transform: rotate(-4deg);
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
	}
	.visor img {
		width: 100%;
		height: 100%;
		display: block;
	}
	.linea {
		position: absolute;
		left: 8px;
		right: 8px;
		top: calc(8px + var(--escaneo, 0.5) * 210px);
		height: 3px;
		border-radius: 2px;
		background: #99cc33;
		box-shadow: 0 0 12px 2px rgba(153, 204, 51, 0.7);
	}
	.esquina {
		position: absolute;
		width: 34px;
		height: 34px;
		border: 4px solid #fff;
		filter: drop-shadow(0 0 3px rgba(0, 0, 0, 0.6));
	}
	.esquina.a {
		top: -22px;
		left: -22px;
		border-right: 0;
		border-bottom: 0;
		border-radius: 10px 0 0 0;
	}
	.esquina.b {
		top: -22px;
		right: -22px;
		border-left: 0;
		border-bottom: 0;
		border-radius: 0 10px 0 0;
	}
	.esquina.c {
		bottom: -22px;
		left: -22px;
		border-right: 0;
		border-top: 0;
		border-radius: 0 0 0 10px;
	}
	.esquina.d {
		bottom: -22px;
		right: -22px;
		border-left: 0;
		border-top: 0;
		border-radius: 0 0 10px 0;
	}
	.camara-ayuda {
		margin: 18px 0 0;
		font: 500 15px/1.3 var(--fuente-texto);
		opacity: 0.85;
	}
	.enlace {
		position: absolute;
		bottom: 90px;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 18px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.95);
		color: #12303f;
		font: 600 14px/1 var(--fuente-texto);
		text-decoration: none;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
	}
</style>
