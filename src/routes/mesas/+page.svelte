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
				<!-- <Icono nombre="mas" /> -->
			</div>

			{#if data.escenarios.length === 0 || data.cursos.length === 0}
				<div class="aviso alerta" style="margin: 0">
					<Icono nombre="alerta" />
					<span>
						{#if data.cursos.length === 0}
							Todavía no hay ningún curso en marcha. El administrador tiene que crear uno antes
							de que puedas crear una mesa.
						{:else}
							Todavía no hay escenarios preparados. El administrador tiene que dejar al menos uno
							disponible antes de que puedas crear una mesa.
						{/if}
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
						<label for="cursoId">Curso al que pertenece</label>
						<select id="cursoId" name="cursoId" aria-invalid={form?.campo === 'cursoId'} required>
							{#if data.cursos.length > 1}
								<option value="" disabled selected={!form?.cursoId}>Elegí un curso</option>
							{/if}
							{#each data.cursos as curso (curso.id)}
								<option
									value={curso.id}
									selected={form?.cursoId === curso.id || data.cursos.length === 1}
								>
									{curso.nombre}
								</option>
							{/each}
						</select>
					</div>

					<div class="campo">
						<label for="escenarioId">Escenario que se va a practicar</label>
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

		<!-- Una carpeta por curso: las mesas aparecen recién al abrirla. Con un solo
		     curso en marcha no hay nada que elegir, así que arranca abierta. -->
		{#each data.carpetas as carpeta (carpeta.id)}
			{@const enCurso = carpeta.mesas.filter((mesa) => mesa.corridaEnCurso).length}
			<details class="carpeta" open={data.carpetas.length === 1}>
				<summary>
					<span class="avatar-rol"><Icono nombre="carpeta" /></span>
					<span class="texto">
						<span class="titulo">{carpeta.nombre}</span>
						<span class="detalle">
							{carpeta.mesas.length}
							{carpeta.mesas.length === 1 ? 'mesa' : 'mesas'}
							{#if enCurso > 0}· {enCurso} en curso{/if}
						</span>
					</span>
					<Icono nombre="abajo" clase="flecha" />
				</summary>

				<div class="carpeta-mesas">
					{#each carpeta.mesas as mesa (mesa.id)}
						<a class="tarjeta-enlace" href="/mesas/{mesa.curso?.codigo}/{mesa.numero}">
							<span class="numero-mesa">{mesa.numero}</span>
							<span class="texto">
								<span class="titulo">{mesa.escenario?.nombre}</span>
								<span class="detalle">
									{#if mesa.corridaEnCurso}
										Corrida {mesa.corridaEnCurso} en curso
									{:else if mesa.corridas > 0}
										Cerrada · {mesa.corridas}
										{mesa.corridas === 1 ? 'corrida' : 'corridas'}
									{:else}
										<span class="pendiente">Sin corridas habilitadas</span>
									{/if}
								</span>
							</span>
							<Icono nombre="adelante" clase="flecha" />
						</a>
					{:else}
						<div class="vacio">Este curso todavía no tiene mesas.</div>
					{/each}
				</div>
			</details>
		{:else}
			<div class="vacio">Todavía no hay mesas creadas.</div>
		{/each}
	</div>
</div>
