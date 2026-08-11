<script lang="ts">
	import { enhance } from '$app/forms';
	import Icono from '$lib/Icono.svelte';
	import BarraSuperior from '$lib/BarraSuperior.svelte';

	let { data, form } = $props();

	let creando = $state(false);
</script>

<svelte:head>
	<title>Mesas — SIMUNaM</title>
</svelte:head>

<div class="app">
	<BarraSuperior volverA="/" titulo="Mesas" sub="Líder de mesa" />

	<div class="envoltorio">
		<div class="pagina-cabecera">
			<div class="titulo">
				<h1>Tus mesas</h1>
				<p class="bajada">Dar de alta la mesa que vas a coordinar y habilitar sus corridas</p>
			</div>
		</div>

		{#if form?.mensaje}
			<div class="aviso error" role="alert">
				<Icono nombre="error" />
				<span>{form.mensaje}</span>
			</div>
		{/if}

		<div class="tarjeta">
			<div class="tarjeta-cabecera">
				<h2>Crear una mesa</h2>
				<Icono nombre="mas" />
			</div>

			{#if data.escenarios.length === 0}
				<div class="aviso alerta" style="margin: 0">
					<Icono nombre="alerta" />
					<span>
						Todavía no hay escenarios preparados. El administrador tiene que dejar al menos uno
						disponible antes de que puedas crear una mesa.
					</span>
				</div>
			{:else}
				<form
					method="POST"
					action="?/crear"
					use:enhance={() => {
						creando = true;
						return async ({ update }) => {
							await update({ reset: false });
							creando = false;
						};
					}}
				>
					<div class="campo">
						<label for="numero">Número de mesa</label>
						<input
							id="numero"
							name="numero"
							type="number"
							inputmode="numeric"
							min="1"
							step="1"
							placeholder="1"
							value={form?.numero ?? ''}
							aria-invalid={form?.campo === 'numero'}
							required
						/>
					</div>

					<div class="campo">
						<label for="escenarioId">Escenario que se va a practicar</label>
						<p class="ayuda">La mesa hereda su planificación y sus checklists.</p>
						<select
							id="escenarioId"
							name="escenarioId"
							aria-invalid={form?.campo === 'escenarioId'}
							required
						>
							<option value="" disabled selected={!form?.escenarioId}>Elegí un escenario</option>
							{#each data.escenarios as escenario (escenario.id)}
								<option value={escenario.id} selected={form?.escenarioId === escenario.id}>
									{escenario.nombre}
								</option>
							{/each}
						</select>
					</div>

					<button class="boton bloque" type="submit" disabled={creando}>
						{creando ? 'Creando…' : 'Crear la mesa'}
					</button>
				</form>
			{/if}
		</div>

		<h2 class="etiqueta" style="margin: 24px 0 8px">Mesas creadas</h2>

		{#each data.mesas as mesa (mesa.id)}
			<a class="tarjeta-enlace" href="/mesas/{mesa.numero}">
				<span class="numero-mesa">{mesa.numero}</span>
				<span class="texto">
					<span class="titulo">{mesa.escenario?.nombre}</span>
					<span class="detalle">
						{#if mesa.corridaEnCurso}
							Corrida {mesa.corridaEnCurso} en curso
						{:else if mesa.corridas > 0}
							{mesa.corridas} corridas · ninguna en curso
						{:else}
							<span class="pendiente">Sin corridas habilitadas</span>
						{/if}
					</span>
				</span>
				<Icono nombre="adelante" clase="flecha" />
			</a>
		{:else}
			<div class="vacio">Todavía no hay mesas creadas.</div>
		{/each}
	</div>
</div>
