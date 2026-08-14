<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import Icono from '$lib/Icono.svelte';
	import BarraSuperior from '$lib/BarraSuperior.svelte';

	let { form } = $props();

	/**
	 * El camino natural es escanear el QR con la cámara del teléfono, que abre la
	 * mesa directamente sin pasar por acá. Esta pantalla es para quien ya tiene la
	 * app abierta: le presta la cámara si el navegador sabe leer códigos, y si no,
	 * le deja escribir el número de mesa. El número a mano nunca se esconde, porque
	 * el lector no existe en todos los navegadores y la cámara se puede denegar.
	 */
	let hayLector = $state(false);
	let escaneando = $state(false);
	let avisoDeCamara = $state<string | null>(null);
	let video = $state<HTMLVideoElement | null>(null);

	let flujo: MediaStream | null = null;
	// Fuera de `$state`: sólo corta el bucle de lectura, no pinta nada.
	let leyendo = false;

	onMount(() => {
		hayLector = 'BarcodeDetector' in window;
	});

	// Al salir de la pantalla hay que soltar la cámara y frenar el bucle a mano:
	// si no, el teléfono se queda con la luz de la cámara encendida.
	onDestroy(() => {
		leyendo = false;
		flujo?.getTracks().forEach((pista) => pista.stop());
		flujo = null;
	});

	/** El QR de la mesa lleva la URL completa; también se acepta un número pelado. */
	function rutaDeMesa(texto: string) {
		const limpio = texto.trim();
		const enLaUrl = limpio.match(/\/m\/(\d+)\/?$/);
		if (enLaUrl) return `/m/${enLaUrl[1]}`;
		if (/^\d+$/.test(limpio)) return `/m/${limpio}`;
		return null;
	}

	function cerrarCamara() {
		leyendo = false;
		escaneando = false;
		flujo?.getTracks().forEach((pista) => pista.stop());
		flujo = null;
	}

	async function abrirCamara() {
		avisoDeCamara = null;
		escaneando = true;
		await tick();

		try {
			flujo = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: 'environment' }
			});
			if (!video) return cerrarCamara();
			video.srcObject = flujo;
			await video.play();
		} catch {
			cerrarCamara();
			avisoDeCamara =
				'No pudimos abrir la cámara. Revisá el permiso del navegador o escribí el número de mesa.';
			return;
		}

		leyendo = true;
		buscarElCodigo(new BarcodeDetector({ formats: ['qr_code'] }));
	}

	async function buscarElCodigo(lector: BarcodeDetector) {
		if (!leyendo || !video) return;

		try {
			const [codigo] = await lector.detect(video);
			if (codigo) {
				const destino = rutaDeMesa(codigo.rawValue);
				if (destino) {
					cerrarCamara();
					await goto(destino);
					return;
				}
				avisoDeCamara = 'Ese código no es el de una mesa de SIMUNaM.';
			}
		} catch {
			// Fotograma ilegible (movimiento, poca luz): se intenta con el siguiente.
		}

		// Cuatro lecturas por segundo alcanzan de sobra y no calientan el teléfono.
		setTimeout(() => buscarElCodigo(lector), 250);
	}
</script>

<svelte:head>
	<title>Entrar a una mesa — SIMUNaM</title>
</svelte:head>

<div class="app">
	<BarraSuperior volverA="/" titulo="Entrar a una mesa" sub="Participante" />

	<div class="envoltorio">
		<div class="tarjeta">
			<div class="tarjeta-cabecera">
				<h2>Escaneá el QR de tu mesa</h2>
				<Icono nombre="qr" />
			</div>

			{#if escaneando}
				<div class="lector">
					<!-- svelte-ignore a11y_media_has_caption -->
					<video bind:this={video} playsinline muted></video>
					<p class="detalle">Apuntá al código QR que está en tu mesa.</p>
					<button class="boton secundario bloque" type="button" onclick={cerrarCamara}>
						Cancelar
					</button>
				</div>
			{:else}
				<p class="ayuda">
					El QR está pegado en la mesa. Podés leerlo con la cámara de tu teléfono, que te trae
					directo acá.
				</p>

				{#if hayLector}
					<button class="boton bloque" type="button" onclick={abrirCamara}>
						<Icono nombre="qr" />
						Abrir la cámara
					</button>
				{/if}
			{/if}

			{#if avisoDeCamara}
				<div class="aviso alerta" style="margin: 16px 0 0" role="alert">
					<Icono nombre="alerta" />
					<span>{avisoDeCamara}</span>
				</div>
			{/if}
		</div>

		<div class="tarjeta">
			<div class="tarjeta-cabecera">
				<h2>O entrá por el número</h2>
				<Icono nombre="mesa" />
			</div>

			{#if form?.mensaje}
				<div class="aviso error" role="alert">
					<Icono nombre="error" />
					<span>{form.mensaje}</span>
				</div>
			{/if}

			<form method="POST" use:enhance>
				<div class="campo">
					<label for="numero">Número de mesa</label>
					<p class="ayuda">El que figura en el cartel, junto al código QR.</p>
					<input
						id="numero"
						name="numero"
						type="number"
						inputmode="numeric"
						min="1"
						step="1"
						placeholder="1"
						enterkeyhint="go"
						value={form?.numero ?? ''}
						aria-invalid={Boolean(form?.mensaje)}
						required
					/>
				</div>

				<button class="boton bloque" type="submit">
					Ir a la mesa
					<Icono nombre="adelante" tamano={16} />
				</button>
			</form>
		</div>

		<p class="pie">
			Al entrar vas a identificarte con tu DNI y a declarar el rol que ocupás en la corrida.
		</p>
	</div>
</div>
