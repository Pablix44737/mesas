<!--
	El `@` del nombre saltea el layout de la zona: acá todavía no hay sesión, así
	que no corresponde la barra con el botón de salir. Es la misma pantalla
	completa que /ingresar.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import Icono from '$lib/Icono.svelte';
	import Marca from '$lib/Marca.svelte';

	let { form } = $props();

	let entrando = $state(false);
</script>

<svelte:head>
	<title>Plataforma — SIMUNaM</title>
</svelte:head>

<div class="bienvenida">
	<main class="bienvenida-caja angosta">
		<header class="bienvenida-encabezado">
			<span class="bienvenida-logo"><Marca alto={38} /></span>
			<h1>Plataforma</h1>
			<p>Alta y claves de las instituciones.</p>
		</header>

		{#if form?.mensaje}
			<div class="aviso error" role="alert">
				<Icono nombre="error" />
				<span>{form.mensaje}</span>
			</div>
		{/if}

		<div class="tarjeta">
			<form
				method="POST"
				use:enhance={() => {
					entrando = true;
					return async ({ update }) => {
						await update();
						entrando = false;
					};
				}}
			>
				<div class="campo">
					<label for="clave">Clave de la plataforma</label>
					<div class="campo-con-icono">
						<Icono nombre="escudo" />
						<!-- svelte-ignore a11y_autofocus -->
						<input
							id="clave"
							name="clave"
							type="password"
							autocomplete="current-password"
							enterkeyhint="go"
							aria-invalid={Boolean(form?.mensaje)}
							autofocus
							required
						/>
					</div>
				</div>

				<button class="boton bloque" type="submit" disabled={entrando}>
					{entrando ? 'Entrando…' : 'Entrar'}
					{#if !entrando}<Icono nombre="adelante" tamano={16} />{/if}
				</button>
			</form>
		</div>

		<p class="pie">
			No es la clave de una institución: eso se ingresa en
			<a href="/ingresar">la administración</a>.
		</p>
	</main>
</div>
