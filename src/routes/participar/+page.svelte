<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import Icono from '$lib/Icono.svelte';

	let { data, form } = $props();

	/**
	 * El camino natural es escanear el QR con la cámara del teléfono, que abre la
	 * mesa directamente sin pasar por acá. Esta pantalla es para quien ya tiene la
	 * app abierta: le presta la cámara si el navegador sabe leer códigos, y si no,
	 * le deja escribir el número de mesa. El número a mano nunca se esconde, porque
	 * el lector no existe en todos los navegadores y la cámara se puede denegar.
	 */
	let hayLector = $state(false);
	let escaneando = $state(false);
	/** No se pudo abrir la cámara: el número pasa a ser lo principal. */
	let camaraFallo = $state(false);
	/** La cámara leyó un código que no es de una mesa: sigue buscando. */
	let codigoAjeno = $state(false);
	let video = $state<HTMLVideoElement | null>(null);
	let yendo = $state(false);
	/** Los campos tocados después del último envío: su error ya no aplica. */
	let corregidos = $state<Record<string, boolean>>({});

	let flujo: MediaStream | null = null;
	// Fuera de `$state`: sólo corta el bucle de lectura, no pinta nada.
	let leyendo = false;

	const camaraPrincipal = $derived(hayLector && !camaraFallo);
	const errorDe = (campo: string) =>
		form?.mensaje && form.campo === campo && !corregidos[campo] ? form.mensaje : null;
	const errorGeneral = $derived(form?.mensaje && !form.campo ? form.mensaje : null);

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

	/**
	 * El QR de la mesa lleva la URL completa, con el código del curso adelante del
	 * número. Se siguen aceptando los carteles viejos —`/m/<numero>` a secas—: esa
	 * ruta existe y resuelve sola mientras ese número sea de una sola mesa.
	 */
	function rutaDeMesa(texto: string) {
		const limpio = texto.trim();
		const conCurso = limpio.match(/\/m\/([a-z0-9-]+)\/(\d+)\/?$/i);
		if (conCurso) return `/m/${conCurso[1]}/${conCurso[2]}`;
		const viejo = limpio.match(/\/m\/(\d+)\/?$/);
		if (viejo) return `/m/${viejo[1]}`;
		return null;
	}

	function cerrarCamara() {
		leyendo = false;
		escaneando = false;
		codigoAjeno = false;
		flujo?.getTracks().forEach((pista) => pista.stop());
		flujo = null;
	}

	async function abrirCamara() {
		camaraFallo = false;
		codigoAjeno = false;
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
			camaraFallo = true;
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
				codigoAjeno = true;
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

<div class="entrar-pagina">
	<header class="mesa-cabecera">
		<div class="mesa-cabecera-dentro entrar-angosto">
			<div class="mesa-navegacion">
				<a class="mesa-volver" href="/">
					<Icono nombre="atras" />
					Inicio
				</a>
			</div>
			<div class="mesa-titulo-fila">
				<div class="mesa-titulo">
					<h1>Entrar a una mesa</h1>
					<p class="mesa-escenario">Participante</p>
				</div>
			</div>
		</div>
	</header>

	<main class="entrar-cuerpo entrar-angosto">
		{#if data.cursos.length === 0}
			<section class="mesa-tarjeta evaluado-vacio">
				<span class="evaluado-vacio-icono alerta"><Icono nombre="alerta" tamano={24} /></span>
				<strong>No hay ningún curso en marcha.</strong>
				<span>Avisale al líder de mesa.</span>
			</section>
		{:else}
			{#if camaraFallo}
				<div class="entrar-aviso" role="alert">
					<Icono nombre="camara-apagada" />
					<span>
						No pudimos abrir la cámara. Revisá el permiso del navegador o escribí el número de mesa.
					</span>
				</div>
			{/if}

			{#if hayLector}
				<button
					class="entrar-escanear"
					class:principal={camaraPrincipal}
					type="button"
					onclick={abrirCamara}
				>
					<span class="entrar-escanear-icono"><Icono nombre="escanear" tamano={32} grosor={2} /></span>
					<span class="entrar-escanear-texto">
						<strong>{camaraFallo ? 'Probar de nuevo' : 'Escanear el QR'}</strong>
						<span>Con la cámara de tu celular</span>
					</span>
					<Icono nombre="avanzar" tamano={22} grosor={2.25} />
				</button>

				<p class="entrar-separador"><span>o con el número de mesa</span></p>
			{/if}

			<form
				class="mesa-tarjeta entrar-formulario"
				method="POST"
				use:enhance={() => {
					yendo = true;
					return async ({ update }) => {
						await update({ reset: false });
						yendo = false;
						corregidos = {};
					};
				}}
			>
				{#if !hayLector}
					<h2>¿En qué mesa estás?</h2>
				{/if}

				{#if errorGeneral}
					<p class="dialogo-error" role="alert">
						<Icono nombre="error" tamano={18} />
						{errorGeneral}
					</p>
				{/if}

				{#if data.cursos.length === 1}
					<input type="hidden" name="cursoId" value={data.cursos[0].id} />
					<p class="entrar-curso-unico">
						<Icono nombre="curso" tamano={18} />
						{data.cursos[0].nombre}
					</p>
				{:else}
					<div>
						<label for="cursoId">Curso</label>
						<select
							id="cursoId"
							name="cursoId"
							onchange={() => {
								corregidos.cursoId = true;
								corregidos.numero = true;
							}}
							aria-invalid={Boolean(errorDe('cursoId'))}
							required
						>
							<option value="" disabled selected={!form?.cursoId}>Elegí tu curso</option>
							{#each data.cursos as curso (curso.id)}
								<option value={curso.id} selected={form?.cursoId === curso.id}>{curso.nombre}</option>
							{/each}
						</select>
						{#if errorDe('cursoId')}
							<p class="campo-error"><Icono nombre="error" tamano={16} />{errorDe('cursoId')}</p>
						{/if}
					</div>
				{/if}

				<div>
					<label for="numero">Número de mesa</label>
					<input
						id="numero"
						class="entrar-numero"
						name="numero"
						type="text"
						inputmode="numeric"
						pattern="[0-9]*"
						autocomplete="off"
						enterkeyhint="go"
						placeholder="Ej.: 3"
						value={form?.numero ?? ''}
						oninput={() => (corregidos.numero = true)}
						aria-invalid={Boolean(errorDe('numero'))}
						aria-describedby="numero-ayuda"
						required
					/>
					{#if errorDe('numero')}
						<p class="campo-error" id="numero-ayuda">
							<Icono nombre="error" tamano={16} />{errorDe('numero')}
						</p>
					{:else}
						<p class="ayuda" id="numero-ayuda">El que figura en el cartel, junto al código QR.</p>
					{/if}
				</div>

				<button
					class="boton bloque"
					class:enviar={!camaraPrincipal}
					class:secundario={camaraPrincipal}
					type="submit"
					disabled={yendo}
				>
					{yendo ? 'Buscando la mesa…' : 'Ir a la mesa'}
					{#if !yendo}<Icono nombre="avanzar" tamano={20} grosor={2.25} />{/if}
				</button>
			</form>

			{#if !hayLector}
				<p class="entrar-nota">
					<Icono nombre="camara" />
					También podés escanear el QR del cartel con la cámara del teléfono.
				</p>
			{/if}
		{/if}
	</main>
</div>

{#if escaneando}
	<!-- La cámara a pantalla completa, con un recuadro que dice dónde va el código. -->
	<div class="lector-qr" role="dialog" aria-modal="true" aria-label="Escanear el QR">
		<!-- svelte-ignore a11y_media_has_caption -->
		<video bind:this={video} playsinline muted></video>
		<div class="lector-qr-arriba">
			<p class="lector-qr-indicacion">Apuntá al QR de tu mesa</p>
			{#if codigoAjeno}
				<p class="lector-qr-aviso" role="status">
					<Icono nombre="alerta" tamano={18} />
					Ese código no es el de una mesa de SIMUNaM.
				</p>
			{/if}
		</div>
		<div class="lector-qr-centro">
			<div class="lector-qr-guia" class:ajeno={codigoAjeno} aria-hidden="true">
				<span></span><span></span><span></span><span></span>
			</div>
		</div>
		<div class="lector-qr-abajo">
			<button type="button" onclick={cerrarCamara}>
				<Icono nombre="cerrar" tamano={18} grosor={2.25} />
				Cancelar
			</button>
		</div>
	</div>
{/if}
