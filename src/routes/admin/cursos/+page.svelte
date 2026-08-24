<script lang="ts">
	import { enhance } from '$app/forms';
	import Icono from '$lib/Icono.svelte';

	let { data, form } = $props();

	let creando = $state(false);
	let abriendoAlta = $state(false);

	const enMarcha = $derived(data.cursos.filter((c) => !c.archivado));
	const archivados = $derived(data.cursos.filter((c) => c.archivado));

	const fecha = (valor: string) =>
		new Date(valor).toLocaleDateString('es-AR', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
</script>

<svelte:head>
	<title>Cursos — SIMUNaM</title>
</svelte:head>

<div class="pagina-cabecera">
	<div class="titulo">
		<h1>Cursos</h1>
		<p class="bajada">Cada edición con sus mesas, separada de las demás</p>
	</div>
	{#if !abriendoAlta}
		<button class="boton" type="button" onclick={() => (abriendoAlta = true)}>
			<Icono nombre="mas" tamano={16} />
			Nuevo curso
		</button>
	{/if}
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

{#if abriendoAlta}
	<div class="tarjeta">
		<div class="tarjeta-cabecera">
			<h2>Nuevo curso</h2>
			<Icono nombre="mas" />
		</div>
		<form
			method="POST"
			action="?/crear"
			use:enhance={() => {
				creando = true;
				return async ({ update, result }) => {
					await update();
					creando = false;
					if (result.type === 'success') abriendoAlta = false;
				};
			}}
		>
			<div class="campo">
				<label for="nombre">Nombre del curso</label>
				<p class="ayuda">Como se lo conoce: la cohorte, el año, la carrera.</p>
				<!-- svelte-ignore a11y_autofocus -->
				<input
					id="nombre"
					name="nombre"
					type="text"
					autocomplete="off"
					placeholder="Diplomatura Superior Universitaria en Simulación"
					value={form?.nombre ?? ''}
					aria-invalid={Boolean(form?.mensaje)}
					autofocus
					required
				/>
			</div>
			<div class="confirmacion">
				<button class="boton" type="submit" disabled={creando}>
					{creando ? 'Creando…' : 'Crear el curso'}
				</button>
				<button
					class="boton secundario"
					type="button"
					onclick={() => (abriendoAlta = false)}
					disabled={creando}
				>
					Cancelar
				</button>
			</div>
		</form>
	</div>
{/if}

{#snippet tarjetaDeCurso(curso: (typeof data.cursos)[number])}
	<div class="curso" class:archivado={curso.archivado}>
		<a class="curso-cuerpo" href="/admin/cursos/{curso.codigo}">
			<span class="curso-marca"><Icono nombre="escenario" tamano={22} /></span>
			<span class="curso-nombre">{curso.nombre}</span>
			<span class="detalle">Desde el {fecha(curso.creado_en)}</span>

			<span class="curso-cifras">
				<span><strong>{curso.mesas}</strong> {curso.mesas === 1 ? 'mesa' : 'mesas'}</span>
				<span><strong>{curso.corridas}</strong> {curso.corridas === 1 ? 'corrida' : 'corridas'}</span>
				<span>
					<strong>{curso.evaluaciones}</strong>
					{curso.evaluaciones === 1 ? 'evaluación' : 'evaluaciones'}
				</span>
			</span>
		</a>

		<div class="curso-pie">
			<span class="etiqueta">{curso.codigo}</span>
			<form
				method="POST"
				action="?/archivar"
				style="margin-left: auto"
				use:enhance={() => async ({ update }) => await update({ reset: false })}
			>
				<input type="hidden" name="id" value={curso.id} />
				<input type="hidden" name="archivado" value={curso.archivado ? 'false' : 'true'} />
				<button class="enlace" type="submit">
					{curso.archivado ? 'Desarchivar' : 'Archivar'}
				</button>
			</form>
		</div>
	</div>
{/snippet}

{#if data.cursos.length === 0}
	<div class="vacio">Todavía no hay cursos. Creá el primero para poder darle mesas.</div>
{:else}
	{#if enMarcha.length > 0}
		<div class="cursos">
			{#each enMarcha as curso (curso.id)}
				{@render tarjetaDeCurso(curso)}
			{/each}
		</div>
	{/if}

	{#if archivados.length > 0}
		<h2 class="etiqueta" style="margin: 32px 0 8px">Archivados · {archivados.length}</h2>
		<div class="cursos">
			{#each archivados as curso (curso.id)}
				{@render tarjetaDeCurso(curso)}
			{/each}
		</div>
	{/if}
{/if}
