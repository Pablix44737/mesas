<script lang="ts">
	import { enhance } from '$app/forms';
	import Icono from '$lib/Icono.svelte';
	import Marca from '$lib/Marca.svelte';

	let { form } = $props();

	let entrando = $state(false);
</script>

<svelte:head>
	<title>Administración — SIMUNaM</title>
</svelte:head>

<div class="bienvenida">
	<main class="bienvenida-caja angosta">
		<header class="bienvenida-encabezado">
			<span class="bienvenida-logo"><Marca alto={38} /></span>
			<h1>Administración</h1>
			<p>Esta parte del sistema prepara el evento, así que pide la clave del equipo.</p>
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
					<label for="clave">Clave de administración</label>
					<div class="campo-con-icono">
						<Icono nombre="candado" />
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

		<p class="pie"><a href="/">Volver a la pantalla de inicio</a></p>
	</main>
</div>
