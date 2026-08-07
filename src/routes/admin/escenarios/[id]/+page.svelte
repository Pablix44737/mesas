<script lang="ts">
	import { enhance } from '$app/forms';
	import Icono from '$lib/Icono.svelte';
	import { EXTENSIONES_ACEPTADAS, mostrarTamano } from '$lib/planificacion';

	let { data, form } = $props();

	let subiendo = $state(false);
	let guardando = $state(false);
	let confirmandoQuitar = $state(false);

	const subidaEn = $derived(
		data.escenario.planificacion_subida_en
			? new Date(data.escenario.planificacion_subida_en).toLocaleString('es-AR', {
					dateStyle: 'short',
					timeStyle: 'short',
					hour12: false
				})
			: null
	);
</script>

<svelte:head>
	<title>{data.escenario.nombre} — MESAS</title>
</svelte:head>

<a class="miga" href="/admin/escenarios">
	<Icono nombre="atras" tamano={16} />
	Todos los escenarios
</a>

<div class="pagina-cabecera">
	<div class="titulo">
		<h1>{data.escenario.nombre}</h1>
		<p class="bajada">Material que recibirán las mesas que practiquen este escenario</p>
	</div>
</div>

{#if form?.mensaje}
	<div class="aviso error" role="alert">
		<Icono nombre="error" />
		<span>{form.mensaje}</span>
	</div>
{/if}
{#if form?.exito}
	<div class="aviso exito" role="status">
		<Icono nombre="tilde-circulo" />
		<span>{form.exito}</span>
	</div>
{/if}

<div class="rejilla dos">
	<div class="tarjeta" style="margin: 0">
		<div class="tarjeta-cabecera">
			<h2>Checklist de la técnica</h2>
			<Icono nombre="checklist" />
		</div>
		<p class="ayuda">
			Se le presenta al observador de la técnica en las mesas que practiquen este escenario.
		</p>

		{#if data.plantillasDeTecnica.length === 0}
			<div class="aviso alerta" style="margin: 0">
				<Icono nombre="alerta" />
				<span>
					Todavía no hay checklists del observador de la técnica disponibles.
					<a href="/admin/checklists">Creá uno</a> y dalo por terminado para poder asociarlo.
				</span>
			</div>
		{:else}
			<form
				method="POST"
				action="?/asociarChecklist"
				use:enhance={() => {
					guardando = true;
					return async ({ update }) => {
						await update({ reset: false });
						guardando = false;
					};
				}}
			>
				<div class="campo">
					<label for="plantillaId">Checklist asociado</label>
					<select id="plantillaId" name="plantillaId">
						<option value="" selected={!data.escenario.checklist_tecnica_id}>
							— Sin checklist de la técnica —
						</option>
						{#each data.plantillasDeTecnica as plantilla (plantilla.id)}
							<option
								value={plantilla.id}
								selected={data.escenario.checklist_tecnica_id === plantilla.id}
							>
								{plantilla.nombre} ({plantilla.items} ítems{plantilla.ponderado
									? ', ponderado'
									: ''})
							</option>
						{/each}
					</select>
				</div>
				<button class="boton bloque" type="submit" disabled={guardando}>
					{guardando ? 'Guardando…' : 'Guardar el checklist'}
				</button>
			</form>
		{/if}
	</div>

	<div class="tarjeta" style="margin: 0">
		<div class="tarjeta-cabecera">
			<h2>Planificación</h2>
			<Icono nombre="planificacion" />
		</div>
		<p class="ayuda">Se le presenta al facilitador de las mesas que practiquen este escenario.</p>

		{#if data.escenario.planificacion_archivo}
			<div class="fila" style="margin-bottom: 12px">
				<span class="avatar-rol verde"><Icono nombre="planificacion" /></span>
				<div class="identidad">
					<span class="nombre" style="font-size: 15px">
						<a
							href="/admin/escenarios/{data.escenario.id}/planificacion"
							target="_blank"
							rel="noopener"
						>
							{data.escenario.planificacion_archivo}
						</a>
					</span>
					<span class="detalle">
						{mostrarTamano(data.escenario.planificacion_tamano ?? 0)} · adjuntada el {subidaEn}
					</span>
				</div>
			</div>

			{#if confirmandoQuitar}
				<div class="confirmacion">
					<form
						method="POST"
						action="?/quitarPlanificacion"
						use:enhance={() => {
							return async ({ update }) => {
								await update({ reset: false });
								confirmandoQuitar = false;
							};
						}}
					>
						<button class="boton peligro bloque" type="submit">
							<Icono nombre="quitar" />
							Sí, quitar la planificación
						</button>
					</form>
					<button
						class="boton secundario bloque"
						type="button"
						onclick={() => (confirmandoQuitar = false)}
					>
						Cancelar
					</button>
				</div>
			{:else}
				<button
					class="boton secundario bloque"
					type="button"
					onclick={() => (confirmandoQuitar = true)}
				>
					<Icono nombre="quitar" />
					Quitar la planificación
				</button>
			{/if}
		{:else}
			<div class="aviso alerta">
				<Icono nombre="alerta" />
				<span>
					Este escenario todavía no tiene planificación adjunta. El facilitador va a ver que no
					está disponible.
				</span>
			</div>
		{/if}

		<form
			method="POST"
			action="?/adjuntarPlanificacion"
			enctype="multipart/form-data"
			use:enhance={() => {
				subiendo = true;
				return async ({ update }) => {
					await update();
					subiendo = false;
				};
			}}
			style="margin-top: 16px"
		>
			<div class="campo">
				<label for="planificacion">
					{data.escenario.planificacion_archivo
						? 'Reemplazar por otro archivo'
						: 'Adjuntar un archivo'}
				</label>
				<p class="ayuda">PDF o documento Word, hasta 20 MB.</p>
				<input
					id="planificacion"
					name="planificacion"
					type="file"
					accept={EXTENSIONES_ACEPTADAS.join(',')}
					required
				/>
			</div>
			<button class="boton bloque" type="submit" disabled={subiendo}>
				<Icono nombre="subir" />
				{subiendo ? 'Subiendo…' : 'Adjuntar la planificación'}
			</button>
		</form>
	</div>
</div>
