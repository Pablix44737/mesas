<script lang="ts">
	import { enhance } from '$app/forms';
	import Icono from '$lib/Icono.svelte';

	let { data, form } = $props();

	let creando = $state(false);

	const rotulo: Record<string, string> = {
		en_construccion: 'En construcción',
		disponible: 'Disponible',
		reemplazada: 'Reemplazada'
	};
</script>

<svelte:head>
	<title>Checklists — SIMUNaM</title>
</svelte:head>

<div class="pagina-cabecera">
	<div class="titulo">
		<h1>Checklists</h1>
		<p class="bajada">Los criterios con que los observadores evalúan la corrida</p>
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
		<h2>Crear un checklist</h2>
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
		<div class="rejilla dos" style="margin-bottom: 0">
			<div class="campo">
				<label for="nombre">Nombre</label>
				<input
					id="nombre"
					name="nombre"
					type="text"
					autocomplete="off"
					placeholder="Técnica: manejo inicial del politraumatizado"
					value={form?.nombre ?? ''}
					aria-invalid={form?.campo === 'nombre'}
					required
				/>
			</div>

			<div class="campo">
				<label for="rolCodigo">Rol observador al que corresponde</label>
				<select id="rolCodigo" name="rolCodigo" aria-invalid={form?.campo === 'rolCodigo'} required>
					<option value="" disabled selected={!form?.rolCodigo}>Elegí el rol</option>
					{#each data.roles as rol (rol.codigo)}
						<option value={rol.codigo} selected={form?.rolCodigo === rol.codigo}>
							{rol.nombre}
						</option>
					{/each}
				</select>
			</div>
		</div>

		<label class="interruptor" style="margin-bottom: 16px">
			<input type="checkbox" name="ponderado" checked={form?.ponderado ?? false} />
			<span>
				<span class="rol-nombre">Ponderar el checklist</span>
				<span class="detalle">
					Cada ítem lleva su propio peso. Sin ponderar, todos valen lo mismo.
				</span>
			</span>
		</label>

		<button class="boton" type="submit" disabled={creando}>
			{creando ? 'Creando…' : 'Empezar a cargarlo'}
			<Icono nombre="adelante" tamano={16} />
		</button>
	</form>
</div>

<div class="tarjeta">
	<div class="tarjeta-cabecera">
		<h2>Checklists cargados</h2>
		<span class="detalle">{data.plantillas.length}</span>
	</div>

	{#if data.plantillas.length === 0}
		<div class="vacio">Todavía no hay checklists cargados.</div>
	{:else}
		<div class="tabla-envoltorio" style="margin: 0">
			<table class="tabla">
				<thead>
					<tr>
						<th>Checklist</th>
						<th>Rol</th>
						<th>Criterios</th>
						<th>Estado</th>
						<th class="acciones"></th>
					</tr>
				</thead>
				<tbody>
					{#each data.plantillas as plantilla (plantilla.id)}
						<tr>
							<td class="principal">{plantilla.nombre}</td>
							<td class="detalle">{plantilla.rol?.nombre}</td>
							<td class="detalle">
								{plantilla.items} ítems · máximo {plantilla.maximo}
								{#if !plantilla.ponderado}· sin ponderar{/if}
							</td>
							<td>
								<span class="chip {plantilla.estado}">{rotulo[plantilla.estado]}</span>
							</td>
							<td class="acciones">
								<a class="boton fantasma" href="/admin/checklists/{plantilla.id}">
									{plantilla.estado === 'en_construccion' ? 'Seguir' : 'Ver'}
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
