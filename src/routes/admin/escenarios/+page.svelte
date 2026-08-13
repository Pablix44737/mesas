<script lang="ts">
	import { enhance } from '$app/forms';
	import Icono from '$lib/Icono.svelte';

	let { data, form } = $props();

	let creando = $state(false);
</script>

<svelte:head>
	<title>Escenarios — SIMUNaM</title>
</svelte:head>

<div class="pagina-cabecera">
	<div class="titulo">
		<h1>Escenarios</h1>
		<p class="bajada">Lo que las mesas van a poder practicar</p>
	</div>
</div>

{#if form?.mensaje}
	<div class="aviso error" role="alert">
		<Icono nombre="error" />
		<span>{form.mensaje}</span>
	</div>
{/if}

<div class="rejilla dos">
	<div class="tarjeta" style="margin: 0">
		<div class="tarjeta-cabecera">
			<h2>Preparar un escenario</h2>
			<Icono nombre="mas" />
		</div>
		<form
			method="POST"
			action="?/crear"
			use:enhance={() => {
				creando = true;
				return async ({ update }) => {
					await update();
					creando = false;
				};
			}}
		>
			<div class="campo">
				<label for="nombre">Nombre del escenario</label>
				<input
					id="nombre"
					name="nombre"
					type="text"
					autocomplete="off"
					placeholder="Manejo inicial del paciente politraumatizado"
					value={form?.nombre ?? ''}
					required
				/>
			</div>
			<button class="boton bloque" type="submit" disabled={creando}>
				{creando ? 'Creando…' : 'Dar de alta el escenario'}
			</button>
		</form>
	</div>

	<div class="tarjeta" style="margin: 0">
		<div class="tarjeta-cabecera">
			<h2>Checklist de la operación</h2>
			<Icono nombre="checklist" />
		</div>
		{#if data.checklistDeOperacion}
			<div class="identidad">
				<span class="nombre" style="font-size: 16px">{data.checklistDeOperacion.nombre}</span>
				<span class="detalle">
					Es común a todos los escenarios: se presenta en toda mesa donde alguien ocupe ese rol.
				</span>
			</div>
		{:else}
			<div class="aviso alerta" style="margin: 0">
				<Icono nombre="alerta" />
				<span>
					Todavía no hay un checklist del observador de la operación. Sin él, ese rol no recibe
					material en ninguna mesa.
				</span>
			</div>
		{/if}
	</div>
</div>

<div class="tarjeta">
	<div class="tarjeta-cabecera">
		<h2>Escenarios disponibles</h2>
		<span class="detalle">{data.escenarios.length}</span>
	</div>

	{#if data.escenarios.length === 0}
		<div class="vacio">Todavía no hay escenarios preparados.</div>
	{:else}
		<div class="tabla-envoltorio">
			<table class="tabla">
				<thead>
					<tr>
						<th>Escenario</th>
						<th>Checklist de la técnica</th>
						<th>Planificación</th>
						<th class="acciones"></th>
					</tr>
				</thead>
				<tbody>
					{#each data.escenarios as escenario (escenario.id)}
						<tr>
							<td class="principal">{escenario.nombre}</td>
							<td>
								{#if escenario.checklist_tecnica}
									{escenario.checklist_tecnica.nombre}
								{:else}
									<span class="chip alerta">Sin asociar</span>
								{/if}
							</td>
							<td>
								{#if escenario.planificacion_archivo}
									<span class="chip exito sin-punto">
										<Icono nombre="planificacion" tamano={14} />
										{escenario.planificacion_archivo}
									</span>
								{:else}
									<span class="chip alerta">Sin adjuntar</span>
								{/if}
							</td>
							<td class="acciones">
								<a class="boton fantasma" href="/admin/escenarios/{escenario.id}">
									Preparar
									<Icono nombre="adelante" tamano={16} />
								</a>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
