<script lang="ts">
	import Icono from '$lib/Icono.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Mesas — MESAS</title>
</svelte:head>

<div class="pagina-cabecera">
	<div class="titulo">
		<h1>Mesas</h1>
		<p class="bajada">Cómo se desarrolló el trabajo de cada mesa</p>
	</div>
</div>

<div class="tarjeta">
	<div class="tarjeta-cabecera">
		<h2>Mesas del evento</h2>
		<span class="detalle">{data.mesas.length}</span>
	</div>

	{#if data.mesas.length === 0}
		<div class="vacio">Todavía no hay mesas creadas.</div>
	{:else}
		<div class="tabla-envoltorio" style="margin: 0">
			<table class="tabla">
				<thead>
					<tr>
						<th>Mesa</th>
						<th>Escenario</th>
						<th>Corridas</th>
						<th>Evaluaciones</th>
						<th class="acciones"></th>
					</tr>
				</thead>
				<tbody>
					{#each data.mesas as mesa (mesa.numero)}
						<tr>
							<td class="principal">{mesa.numero}</td>
							<td>{mesa.escenario}</td>
							<td>
								{#if mesa.corridas === 0}
									<span class="chip alerta">Sin corridas</span>
								{:else if mesa.corridaEnCurso}
									<span class="chip exito">Corrida {mesa.corridaEnCurso} en curso</span>
								{:else}
									<span class="chip neutro">{mesa.corridas} cerradas</span>
								{/if}
							</td>
							<td class="detalle">{mesa.evaluaciones}</td>
							<td class="acciones">
								<a class="boton fantasma" href="/admin/mesas/{mesa.numero}">
									Consultar
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
