<script lang="ts">
	import { enhance } from '$app/forms';
	import Icono from '$lib/Icono.svelte';

	let { data, form } = $props();

	let agregando = $state(false);
	let terminando = $state(false);
	let confirmandoTerminar = $state(false);
	let editando = $state<string | null>(null);
	let renombrandoEnCurso = $state(false);
	let confirmandoBaja = $state(false);
	let borrando = $state(false);
	/**
	 * Panel de renombrado abierto a mano. Mientras valga `undefined` manda lo que
	 * devolvió el servidor: así un rechazo lo reabre con lo tipeado aunque no haya
	 * JavaScript, y cancelar sigue cerrándolo.
	 */
	let abiertoAMano = $state<boolean | undefined>(undefined);
	const renombrando = $derived(abiertoAMano ?? Boolean(form?.renombrando));

	/**
	 * El orden mientras se está acomodando, antes de guardarlo.
	 *
	 * Con las flechas o arrastrando, la lista se reacomoda acá y recién después
	 * de medio segundo sin tocar nada viaja el orden completo, una sola vez. Antes
	 * cada flecha era un viaje a la base: llevar el último criterio al primer
	 * lugar costaba N-1 idas y vueltas. En `null` manda el orden del servidor.
	 */
	let ordenLocal = $state<string[] | null>(null);
	let guardandoOrden = $state(false);
	let falloDeOrden = $state<string | null>(null);
	let arrastrando = $state<string | null>(null);

	let formularioDeOrden: HTMLFormElement;
	let temporizador: ReturnType<typeof setTimeout> | null = null;

	const items = $derived(
		ordenLocal
			? ordenLocal
					.map((id) => data.items.find((i) => i.id === id))
					.filter((i) => i !== undefined)
			: data.items
	);

	function programarGuardado() {
		if (temporizador) clearTimeout(temporizador);
		// Medio segundo: alcanza para encadenar varios movimientos en un guardado
		// y no se siente como una espera.
		temporizador = setTimeout(() => formularioDeOrden?.requestSubmit(), 500);
	}

	function reacomodar(desde: number, hasta: number) {
		if (hasta < 0 || hasta >= items.length || desde === hasta) return;
		const ids = items.map((i) => i.id);
		const [movido] = ids.splice(desde, 1);
		ids.splice(hasta, 0, movido);
		ordenLocal = ids;
		falloDeOrden = null;
		programarGuardado();
	}

	/** Arrastrar con el puntero: anda igual con mouse y con el dedo. */
	function tomar(evento: PointerEvent, id: string) {
		evento.preventDefault();
		arrastrando = id;
		(evento.target as HTMLElement).setPointerCapture(evento.pointerId);
	}

	function arrastrar(evento: PointerEvent) {
		if (!arrastrando) return;
		const filas = [...document.querySelectorAll<HTMLElement>('[data-criterio]')];
		// Sobre qué fila está el puntero: se compara contra el centro de cada una,
		// así el intercambio ocurre al cruzar la mitad y no al rozar el borde.
		const destino = filas.findIndex((fila) => {
			const r = fila.getBoundingClientRect();
			return evento.clientY >= r.top && evento.clientY <= r.bottom;
		});
		if (destino < 0) return;
		const actual = items.findIndex((i) => i.id === arrastrando);
		if (actual >= 0 && actual !== destino) reacomodar(actual, destino);
	}

	function soltar() {
		arrastrando = null;
	}

	const enConstruccion = $derived(data.plantilla.estado !== 'disponible');
	const rotulo: Record<string, string> = {
		en_construccion: 'En construcción',
		disponible: 'Disponible',
		reemplazada: 'Reemplazada'
	};
</script>

<svelte:head>
	<title>{data.plantilla.nombre} — SIMUNaM</title>
</svelte:head>

<a class="miga" href="/admin/checklists">
	<Icono nombre="atras" tamano={16} />
	Todos los checklists
</a>

<div class="pagina-cabecera">
	{#if renombrando}
		<form
			class="renombrar"
			method="POST"
			action="?/renombrar"
			use:enhance={() => {
				renombrandoEnCurso = true;
				return async ({ update }) => {
					await update({ reset: false });
					renombrandoEnCurso = false;
					// Si salió bien el panel se cierra; si no, queda abierto.
					abiertoAMano = Boolean(form?.renombrando);
				};
			}}
		>
			<label class="etiqueta" for="nombre-checklist">Nombre del checklist</label>
			<div class="fila">
				<!-- svelte-ignore a11y_autofocus -->
				<input
					id="nombre-checklist"
					name="nombre"
					type="text"
					autocomplete="off"
					value={form?.renombrando ? (form.nombre ?? '') : data.plantilla.nombre}
					aria-invalid={Boolean(form?.mensaje)}
					autofocus
					required
				/>
				<button class="boton" type="submit" disabled={renombrandoEnCurso}>
					{renombrandoEnCurso ? 'Guardando…' : 'Guardar'}
				</button>
				<button
					class="boton secundario"
					type="button"
					onclick={() => (abiertoAMano = false)}
					disabled={renombrandoEnCurso}
				>
					Cancelar
				</button>
			</div>
			{#if !enConstruccion}
				<p class="ayuda" style="margin: 8px 0 0">
					Este checklist ya está en uso: el nombre nuevo se va a ver también en las evaluaciones
					enviadas con él. Es el mismo instrumento, con el título corregido.
				</p>
			{/if}
		</form>
	{:else}
		<div class="titulo">
			<h1>{data.plantilla.nombre}</h1>
			<p class="bajada">{data.plantilla.rol?.nombre}</p>
		</div>
		<span class="fila">
			<button class="boton fantasma" type="button" onclick={() => (abiertoAMano = true)}>
				<Icono nombre="editar" tamano={16} />
				Renombrar
			</button>
			<span class="chip {data.plantilla.estado}">{rotulo[data.plantilla.estado]}</span>
		</span>
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

<div class="rejilla dos">
	<div class="tarjeta" style="margin: 0">
		<div class="tarjeta-cabecera">
			<h2>Ponderación</h2>
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

{#if data.items.length > 1}
	<p class="ayuda" style="margin-bottom: 12px">
		Arrastrá un criterio del asa, o usá las flechas, para cambiar el orden en que los
		observadores los van a ver. El orden se guarda solo.
	</p>
{/if}

{#if falloDeOrden}
	<div class="aviso error" role="alert">
		<Icono nombre="error" />
		<span>{falloDeOrden}</span>
	</div>
{/if}

<!-- El orden viaja entero y una sola vez, cuando se deja de mover. Sin
     JavaScript este formulario nunca se envía: ahí mandan las flechas. -->
<form
	bind:this={formularioDeOrden}
	method="POST"
	action="?/reordenarItems"
	class="visualmente-oculto"
	use:enhance={() => {
		guardandoOrden = true;
		return async ({ update, result }) => {
			await update({ reset: false });
			guardandoOrden = false;
			// Pase lo que pase vuelve a mandar el servidor: si salió bien ya tiene
			// el orden nuevo, y si falló hay que mostrar el que de verdad quedó.
			ordenLocal = null;
			falloDeOrden =
				result.type === 'failure'
					? 'No se pudo guardar el orden. La lista volvió a como estaba.'
					: null;
		};
	}}
>
	<input type="hidden" name="orden" value={items.map((i) => i.id).join(',')} />
</form>

<div class="items">
	{#each items as item, i (item.id)}
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
			<div class="criterio" class:tomado={arrastrando === item.id} data-criterio={item.id}>
				<!-- El asa es lo único que arrastra: así se puede seleccionar el texto
				     del criterio sin que la fila se empiece a mover. -->
				<button
					class="asa"
					type="button"
					title="Arrastrar para reordenar"
					onpointerdown={(e) => tomar(e, item.id)}
					onpointermove={arrastrar}
					onpointerup={soltar}
					onpointercancel={soltar}
				>
					<Icono nombre="asa" tamano={18} />
					<span class="visualmente-oculto">Arrastrar para reordenar</span>
				</button>
				<!-- La posición se cuenta acá y no se lee de `orden`: al quitar criterios
				     el orden guardado deja huecos, y mostrarlos confundiría. -->
				<span class="orden">{i + 1}</span>
				<span class="texto">{item.texto}</span>
				{#if data.plantilla.ponderado}
					<span class="peso" title="Peso del criterio">{item.peso}</span>
				{/if}
				<span class="acciones">
					<form
						method="POST"
						action="?/moverItem"
						use:enhance={({ cancel }) => {
							cancel();
							reacomodar(i, i - 1);
						}}
					>
						<input type="hidden" name="itemId" value={item.id} />
						<input type="hidden" name="hacia" value="arriba" />
						<button class="icono-boton" type="submit" disabled={i === 0} title="Subir">
							<Icono nombre="arriba" tamano={18} />
							<span class="visualmente-oculto">Subir</span>
						</button>
					</form>
					<form
						method="POST"
						action="?/moverItem"
						use:enhance={({ cancel }) => {
							cancel();
							reacomodar(i, i + 1);
						}}
					>
						<input type="hidden" name="itemId" value={item.id} />
						<input type="hidden" name="hacia" value="abajo" />
						<button
							class="icono-boton"
							type="submit"
							disabled={i === data.items.length - 1}
							title="Bajar"
						>
							<Icono nombre="abajo" tamano={18} />
							<span class="visualmente-oculto">Bajar</span>
						</button>
					</form>
					<button
						class="icono-boton"
						type="button"
						onclick={() => (editando = item.id)}
						title="Editar"
					>
						<Icono nombre="editar" tamano={18} />
						<span class="visualmente-oculto">Editar</span>
					</button>
					<form
						method="POST"
						action="?/quitarItem"
						use:enhance={() => async ({ update }) => await update({ reset: false })}
					>
						<input type="hidden" name="itemId" value={item.id} />
						<button class="icono-boton peligroso" type="submit" title="Quitar">
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
	<!-- Sin tarjeta alrededor: el aviso ya trae su marco y el botón es un botón.
	     Envolverlos sumaba un recuadro que no agrupaba nada que no se entendiera. -->
	<div class="cerrar-checklist">
		{#if data.operacionVigente}
			<div class="aviso alerta">
				<Icono nombre="alerta" />
				<span>
					Al darlo por terminado va a reemplazar a <strong>{data.operacionVigente}</strong>, que
					es el checklist de {data.plantilla.rol?.nombre.toLowerCase()} vigente en todas las
					mesas. Las evaluaciones ya enviadas conservan el suyo.
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

{#if data.escenariosQueLoUsan === 0 && data.vecesQueSeUso === 0}
	<div class="dar-de-baja">
		{#if confirmandoBaja}
			<div class="aviso error">
				<Icono nombre="alerta" />
				<div>
					<strong>Eliminar el checklist «{data.plantilla.nombre}» no se puede deshacer.</strong>
					Se van con él sus {data.items.length} criterios. Nadie lo completó todavía, así que no se pierde ninguna evaluación.
					<form
						method="POST"
						action="?/eliminar"
						style="margin-top: 12px"
						use:enhance={() => {
							borrando = true;
							return async ({ update }) => {
								await update({ reset: false });
								borrando = false;
							};
						}}
					>
						<div class="confirmacion">
							<button class="boton peligro" type="submit" disabled={borrando}>
								<Icono nombre="quitar" />
								{borrando ? 'Eliminando…' : 'Sí, eliminarlo'}
							</button>
							<button
								class="boton secundario"
								type="button"
								onclick={() => (confirmandoBaja = false)}
								disabled={borrando}
							>
								Cancelar
							</button>
						</div>
					</form>
				</div>
			</div>
		{:else}
			<button class="boton peligro" type="button" onclick={() => (confirmandoBaja = true)}>
				<Icono nombre="quitar" tamano={16} />
				Eliminar el checklist
			</button>
		{/if}
	</div>
{:else}
	<p class="ayuda dar-de-baja">Este checklist no se puede eliminar: {data.vecesQueSeUso > 0 ? 'alguien ya lo completó en una mesa y se perdería ese trabajo' : (data.escenariosQueLoUsan === 1 ? 'hay un escenario que lo usa' : `hay ${data.escenariosQueLoUsan} escenarios que lo usan`)}.</p>
{/if}
