<script lang="ts">
	import { enhance } from '$app/forms';
	import Icono from '$lib/Icono.svelte';

	let { data, form } = $props();

	let agregando = $state(false);
	let terminando = $state(false);
	let confirmandoTerminar = $state(false);
	let editando = $state<string | null>(null);

	const enConstruccion = $derived(data.plantilla.estado !== 'disponible');
	const rotulo: Record<string, string> = {
		en_construccion: 'En construcción',
		disponible: 'Disponible',
		reemplazada: 'Reemplazada'
	};
</script>

<svelte:head>
	<title>{data.plantilla.nombre} — MESAS</title>
</svelte:head>

<a class="miga" href="/admin/checklists">
	<Icono nombre="atras" tamano={16} />
	Todos los checklists
</a>

<div class="pagina-cabecera">
	<div class="titulo">
		<h1>{data.plantilla.nombre}</h1>
		<p class="bajada">{data.plantilla.rol?.nombre}</p>
	</div>
	<span class="chip {data.plantilla.estado}">{rotulo[data.plantilla.estado]}</span>
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
			<h2>Ponderación</h2>
			<Icono nombre="resultado" />
		</div>
		<form
			method="POST"
			action="?/ponderacion"
			use:enhance={() => async ({ update }) => await update({ reset: false })}
		>
			<input type="hidden" name="ponderado" value={data.plantilla.ponderado ? 'false' : 'true'} />
			<p class="detalle">
				{#if data.plantilla.ponderado}
					Cada criterio lleva su propio peso. El máximo alcanzable es
					<strong>{data.maximo}</strong>.
				{:else}
					Todos los criterios pesan lo mismo. El máximo alcanzable es
					<strong>{data.maximo}</strong>.
				{/if}
			</p>
			<button class="boton secundario bloque" type="submit">
				{data.plantilla.ponderado ? 'Dejar de ponderarlo' : 'Ponderar el checklist'}
			</button>
			{#if data.plantilla.ponderado}
				<p class="ayuda" style="margin: 8px 0 0">
					Si dejás de ponderarlo, todos los pesos vuelven a 1.
				</p>
			{/if}
		</form>
	</div>

	<div class="tarjeta" style="margin: 0">
		<div class="tarjeta-cabecera">
			<h2>Agregar un criterio</h2>
			<Icono nombre="mas" />
		</div>
		<form
			method="POST"
			action="?/agregarItem"
			use:enhance={() => {
				agregando = true;
				return async ({ update }) => {
					await update();
					agregando = false;
				};
			}}
		>
			<div class="campo">
				<label for="texto">Qué se observa</label>
				<input
					id="texto"
					name="texto"
					type="text"
					autocomplete="off"
					placeholder="Realiza la evaluación primaria según ABCDE"
					required
				/>
			</div>
			{#if data.plantilla.ponderado}
				<div class="campo">
					<label for="peso">Peso</label>
					<input id="peso" name="peso" type="number" min="0" step="0.5" value="1" required />
				</div>
			{/if}
			<button class="boton bloque" type="submit" disabled={agregando}>
				{agregando ? 'Agregando…' : 'Agregar el criterio'}
			</button>
		</form>
	</div>
</div>

<h2 class="etiqueta" style="margin: 24px 0 8px">
	Criterios de evaluación · {data.items.length}
</h2>

{#if data.items.length === 0}
	<div class="aviso alerta">
		<Icono nombre="alerta" />
		<span>
			Todavía no cargaste ningún criterio. Un checklist sin criterios no se puede dar por terminado.
		</span>
	</div>
{/if}

<div class="items">
	{#each data.items as item (item.id)}
		{#if editando === item.id}
			<div class="tarjeta" style="margin: 0">
				<form
					method="POST"
					action="?/editarItem"
					use:enhance={() => async ({ update }) => {
						await update({ reset: false });
						editando = null;
					}}
				>
					<input type="hidden" name="itemId" value={item.id} />
					<div class="campo">
						<label for="texto-{item.id}">Criterio</label>
						<input id="texto-{item.id}" name="texto" type="text" value={item.texto} required />
					</div>
					{#if data.plantilla.ponderado}
						<div class="campo">
							<label for="peso-{item.id}">Peso</label>
							<input
								id="peso-{item.id}"
								name="peso"
								type="number"
								min="0"
								step="0.5"
								value={item.peso}
								required
							/>
						</div>
					{/if}
					<div class="confirmacion">
						<button class="boton" type="submit">Guardar</button>
						<button class="boton secundario" type="button" onclick={() => (editando = null)}>
							Cancelar
						</button>
					</div>
				</form>
			</div>
		{:else}
			<div class="criterio">
				<span class="orden">{item.orden}</span>
				<span class="texto">{item.texto}</span>
				{#if data.plantilla.ponderado}
					<span class="peso" title="Peso del criterio">{item.peso}</span>
				{/if}
				<span class="acciones">
					<button class="icono-boton" type="button" onclick={() => (editando = item.id)}>
						<Icono nombre="editar" tamano={18} />
						<span class="visualmente-oculto">Editar</span>
					</button>
					<form
						method="POST"
						action="?/quitarItem"
						use:enhance={() => async ({ update }) => await update({ reset: false })}
					>
						<input type="hidden" name="itemId" value={item.id} />
						<button class="icono-boton" type="submit">
							<Icono nombre="quitar" tamano={18} />
							<span class="visualmente-oculto">Quitar</span>
						</button>
					</form>
				</span>
			</div>
		{/if}
	{/each}
</div>

{#if enConstruccion}
	<div class="tarjeta">
		<div class="tarjeta-cabecera">
			<h2>Dar por terminado</h2>
			<Icono nombre="tilde-circulo" />
		</div>

		{#if data.operacionVigente}
			<div class="aviso alerta">
				<Icono nombre="alerta" />
				<span>
					Al darlo por terminado va a reemplazar a <strong>{data.operacionVigente}</strong>, que
					es el checklist de la operación vigente en todas las mesas. Las evaluaciones ya
					enviadas conservan el suyo.
				</span>
			</div>
		{/if}

		{#if confirmandoTerminar}
			<p>
				Va a quedar disponible para asociarse a un escenario y presentarse en las mesas, con sus
				<strong>{data.items.length}</strong> criterios y un máximo de
				<strong>{data.maximo}</strong>.
			</p>
			<div class="confirmacion">
				<form
					method="POST"
					action="?/terminar"
					use:enhance={() => {
						terminando = true;
						return async ({ update }) => {
							await update({ reset: false });
							terminando = false;
							confirmandoTerminar = false;
						};
					}}
				>
					<button class="boton enviar bloque" type="submit" disabled={terminando}>
						<Icono nombre="tilde" />
						{terminando ? 'Terminando…' : 'Sí, darlo por terminado'}
					</button>
				</form>
				<button
					class="boton secundario bloque"
					type="button"
					onclick={() => (confirmandoTerminar = false)}
					disabled={terminando}
				>
					Seguir cargándolo
				</button>
			</div>
		{:else}
			<button
				class="boton enviar bloque"
				type="button"
				onclick={() => (confirmandoTerminar = true)}
				disabled={data.items.length === 0}
			>
				<Icono nombre="tilde" />
				Dar por terminado el checklist
			</button>
		{/if}
	</div>
{:else}
	<div class="aviso exito" role="status">
		<Icono nombre="tilde-circulo" />
		<span>
			Este checklist está disponible: se puede asociar a un escenario y se presenta en las mesas.
		</span>
	</div>
{/if}

<style>
	.visualmente-oculto {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
