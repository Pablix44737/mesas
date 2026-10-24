<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import Icono from '$lib/Icono.svelte';

	let { data, form } = $props();

	type Criterio = (typeof data.items)[number];
	type Accion =
		| 'renombrar'
		| 'agregar'
		| 'editar'
		| 'quitar'
		| 'restaurar'
		| 'ponderacion'
		| 'terminar'
		| 'eliminar';
	type Dialogo = 'terminar' | 'eliminar' | 'despoderar';

	/** Qué formulario mandó la última respuesta del servidor, para mostrarla en su lugar. */
	let accion = $state<Accion | null>(null);
	let trabajando = $state<Accion | null>(null);
	let dialogo = $state<Dialogo | null>(null);
	let avisoCerrado = $state(false);

	const plantilla = $derived(data.plantilla);
	const comun = $derived(plantilla.rol?.checklist === 'comun');
	const disponible = $derived(plantilla.estado === 'disponible');
	const respuestaDe = (de: Accion) => (form?.mensaje && accion === de ? form.mensaje : null);

	const numero = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });
	const criterios = (n: number) => `${n} ${n === 1 ? 'criterio' : 'criterios'}`;
	const ESTADOS: Record<string, string> = {
		en_construccion: 'En construcción',
		disponible: 'Disponible',
		reemplazada: 'Reemplazado'
	};

	/** El peso como se escribe acá: con coma o con punto, nunca negativo. */
	const leerPeso = (valor: string) => {
		const limpio = valor.trim().replace(',', '.');
		return /^\d*\.?\d+$/.test(limpio) ? Number(limpio) : NaN;
	};
	const pasoDePeso = (valor: string, delta: number) => {
		const actual = leerPeso(valor);
		return numero(Math.max(0, Math.round(((Number.isNaN(actual) ? 1 : actual) + delta) * 2) / 2));
	};
	const errorDePeso = (valor: string) =>
		plantilla.ponderado && Number.isNaN(leerPeso(valor))
			? 'El peso tiene que ser un número no negativo.'
			: null;

	/* --- renombrar --- */

	/** Sin JavaScript un rechazo vuelve con la página entera: el campo se reabre con lo escrito. */
	let renombrando = $state(untrack(() => Boolean(form?.renombrando)));
	let nombre = $state(untrack(() => (form?.renombrando ? (form.nombre ?? '') : '')));
	let errorNombre = $state<string | null>(null);
	let nombreCorregido = $state(false);
	const errorDelNombre = $derived(
		errorNombre ?? (form?.renombrando && !nombreCorregido ? form.mensaje : null)
	);

	async function renombrar() {
		renombrando = true;
		nombre = plantilla.nombre;
		errorNombre = null;
		nombreCorregido = true;
		await tick();
		document.getElementById('nombre-checklist')?.focus();
	}

	/* --- agregar criterios: se cargan de a muchos seguidos --- */

	/** Ya terminado, agregar es raro: queda plegado detrás de un botón. */
	let cargando = $state(false);
	const compositorVisible = $derived(!disponible || cargando);
	let texto = $state('');
	let peso = $state('1');
	let errorTexto = $state<string | null>(null);
	let errorPesoNuevo = $state<string | null>(null);
	let agregado = $state(false);
	let textoCorregido = $state(false);

	const errorDelTexto = $derived(
		errorTexto ?? (!textoCorregido ? respuestaDe('agregar') : null)
	);

	async function abrirCompositor() {
		cargando = true;
		agregado = false;
		await tick();
		document.getElementById('nuevo-criterio')?.focus();
	}

	// Recién creado, lo único que hay para hacer es escribir el primer criterio.
	onMount(() => {
		if (!disponible && data.items.length === 0) {
			document.getElementById('nuevo-criterio')?.focus({ preventScroll: true });
		}
	});

	/* --- editar un criterio --- */

	let editandoId = $state<string | null>(null);
	let textoEditado = $state('');
	let pesoEditado = $state('1');
	let erroresEdicion = $state<Record<string, string>>({});
	const editado = $derived(data.items.find((i) => i.id === editandoId) ?? null);

	async function editar(criterio: Criterio) {
		editandoId = criterio.id;
		textoEditado = criterio.texto;
		pesoEditado = numero(criterio.peso);
		erroresEdicion = {};
		abierto = null;
		if (accion === 'editar') accion = null;
		await tick();
		document.getElementById('texto-editado')?.focus();
	}

	/* --- quitar, y deshacerlo --- */

	/** Lo último que se quitó, para poder ponerlo de nuevo donde estaba. */
	let quitado = $state<{ texto: string; peso: number; posicion: number } | null>(null);

	/* --- ordenar --- */

	/**
	 * El orden mientras se está acomodando, antes de guardarlo.
	 *
	 * Con las flechas o arrastrando, la lista se reacomoda acá y recién después
	 * de medio segundo sin tocar nada viaja el orden completo, una sola vez. En
	 * `null` manda el orden del servidor.
	 */
	let ordenLocal = $state<string[] | null>(null);
	let guardandoOrden = $state(false);
	let falloDeOrden = $state<string | null>(null);
	let arrastrando = $state<string | null>(null);
	/** En el teléfono, el criterio con sus acciones a la vista. */
	let abierto = $state<string | null>(null);

	let formularioDeOrden: HTMLFormElement;
	let temporizador: ReturnType<typeof setTimeout> | null = null;

	const items = $derived(
		ordenLocal
			? ordenLocal
					.map((id) => data.items.find((i) => i.id === id))
					.filter((i) => i !== undefined)
			: data.items
	);
	const posicionEditada = $derived(editado ? items.indexOf(editado) + 1 : 0);

	function reacomodar(desde: number, hasta: number) {
		if (hasta < 0 || hasta >= items.length || desde === hasta) return;
		const ids = items.map((i) => i.id);
		const [movido] = ids.splice(desde, 1);
		ids.splice(hasta, 0, movido);
		ordenLocal = ids;
		falloDeOrden = null;
		guardandoOrden = true;
		if (temporizador) clearTimeout(temporizador);
		// Medio segundo: alcanza para encadenar varios movimientos en un guardado
		// y no se siente como una espera.
		temporizador = setTimeout(() => formularioDeOrden?.requestSubmit(), 500);
	}

	/** Arrastrar con el puntero: anda igual con mouse y con el dedo. */
	function tomar(evento: PointerEvent, id: string) {
		evento.preventDefault();
		arrastrando = id;
		abierto = null;
		(evento.currentTarget as HTMLElement).setPointerCapture(evento.pointerId);
	}

	function arrastrar(evento: PointerEvent) {
		if (!arrastrando) return;
		const filas = [...document.querySelectorAll<HTMLElement>('[data-criterio]')];
		// Sobre qué fila está el puntero: el intercambio ocurre al entrar en otra.
		const destino = filas.findIndex((fila) => {
			const r = fila.getBoundingClientRect();
			return evento.clientY >= r.top && evento.clientY <= r.bottom;
		});
		if (destino < 0) return;
		const actual = items.findIndex((i) => i.id === arrastrando);
		if (actual >= 0 && actual !== destino) reacomodar(actual, destino);
	}

	/**
	 * La posición se busca al tocar, no al dibujar la fila: el formulario de cada
	 * criterio se arma una vez y lo sigue mientras cambia de lugar.
	 */
	const mover =
		(id: string, hacia: -1 | 1): SubmitFunction =>
		({ cancel }) => {
			// Con JavaScript se reacomoda acá y el orden viaja entero; sin él, manda el servidor.
			cancel();
			const desde = items.findIndex((i) => i.id === id);
			reacomodar(desde, desde + hacia);
		};

	/** Antes de quitar se guarda lo necesario para «Deshacer». */
	const recordarQuitado = (id: string) => () => {
		const posicion = items.findIndex((i) => i.id === id);
		const criterio = items[posicion];
		if (criterio) quitado = { texto: criterio.texto, peso: criterio.peso, posicion };
		return true;
	};

	const guardarOrden: SubmitFunction = () => {
		return async ({ update, result }) => {
			await update({ reset: false });
			guardandoOrden = false;
			// Pase lo que pase vuelve a mandar el servidor: si salió bien ya tiene
			// el orden nuevo, y si falló hay que mostrar el que de verdad quedó.
			ordenLocal = null;
			falloDeOrden =
				result.type === 'failure'
					? (result.data?.mensaje as string | undefined) ??
						'No se pudo guardar el orden. La lista volvió a como estaba.'
					: null;
		};
	};

	/* --- qué se destaca --- */

	const escribiendo = $derived(compositorVisible && texto.trim().length > 0);
	/** Una sola acción verde: la de lo que se está haciendo. */
	const principal = $derived<Accion | null>(
		renombrando
			? 'renombrar'
			: escribiendo
				? 'agregar'
				: !disponible && items.length > 0
					? 'terminar'
					: compositorVisible
						? 'agregar'
						: null
	);

	const reemplaza = $derived(
		comun && !disponible && data.operacionVigente
			? `Al darlo por terminado va a reemplazar a «${data.operacionVigente}».`
			: null
	);
	const sePuedeEliminar = $derived(data.escenariosQueLoUsan === 0 && data.vecesQueSeUso === 0);

	/** El resultado de lo último, cuando no se muestra ya junto a lo que lo produjo. */
	const aviso = $derived.by(() => {
		if (avisoCerrado || dialogo || editado) return null;
		if (form?.exito && accion !== 'agregar') {
			return { exito: true, texto: form.exito, deshacer: accion === 'quitar' && quitado !== null };
		}
		if (!form?.mensaje || form.renombrando) return null;
		if (accion === 'agregar' || accion === 'editar') return null;
		return { exito: false, texto: form.mensaje, deshacer: false };
	});

	/* --- enviar --- */

	async function abrirDialogo(cual: Dialogo) {
		dialogo = cual;
		await tick();
		document.querySelector<HTMLElement>('[data-enfocar]')?.focus();
	}

	function cerrar() {
		if (trabajando) return;
		if (dialogo) {
			// Si falló, el error ya se leyó en el diálogo: no vuelve como aviso.
			dialogo = null;
			avisoCerrado = true;
		} else if (editandoId) editandoId = null;
		else if (renombrando) renombrando = false;
	}

	const enviar =
		(de: Accion, antes?: () => boolean, despues?: () => void): SubmitFunction =>
		({ cancel }) => {
			if (antes && !antes()) {
				cancel();
				return;
			}
			accion = de;
			trabajando = de;
			avisoCerrado = false;
			return async ({ result, update }) => {
				await update({ reset: false });
				trabajando = null;
				if (result.type !== 'success') return;
				dialogo = null;
				despues?.();
			};
		};

	const revisarNombre = () => {
		if (nombre.trim().length < 3) errorNombre = 'El nombre no puede quedar vacío.';
		if (errorNombre) document.getElementById('nombre-checklist')?.focus();
		nombreCorregido = false;
		return !errorNombre;
	};

	const revisarNuevo = () => {
		errorTexto = texto.trim().length < 3 ? 'Escribí el criterio a evaluar.' : null;
		errorPesoNuevo = errorDePeso(peso);
		agregado = false;
		textoCorregido = false;
		if (errorTexto || errorPesoNuevo) document.getElementById('nuevo-criterio')?.focus();
		return !errorTexto && !errorPesoNuevo;
	};

	async function criterioAgregado() {
		texto = '';
		peso = '1';
		agregado = true;
		await tick();
		const campo = document.getElementById('nuevo-criterio');
		campo?.focus();
		campo?.scrollIntoView({ block: 'nearest' });
	}

	const revisarEdicion = () => {
		const faltan: Record<string, string> = {};
		if (textoEditado.trim().length < 3) faltan.texto = 'El criterio no puede quedar vacío.';
		const pesoMal = errorDePeso(pesoEditado);
		if (pesoMal) faltan.peso = pesoMal;
		erroresEdicion = faltan;
		return !faltan.texto && !faltan.peso;
	};

	function teclaDelCompositor(evento: KeyboardEvent & { currentTarget: HTMLTextAreaElement }) {
		// Enter agrega y deja listo el siguiente; Shift + Enter es un salto de línea.
		if (evento.key === 'Enter' && !evento.shiftKey) {
			evento.preventDefault();
			evento.currentTarget.form?.requestSubmit();
		}
	}
</script>

<svelte:head>
	<title>{plantilla.nombre} — SIMUNaM</title>
</svelte:head>

<svelte:window onkeydown={(evento) => evento.key === 'Escape' && cerrar()} />

{#snippet pesoConPasos(id: string, valor: string, cambiar: (nuevo: string) => void, error: string | null)}
	<div class="checklist-peso">
		<label for={id}>Peso</label>
		<div class="checklist-pasos" class:con-error={error}>
			<button type="button" aria-label="Restar 0,5 al peso" onclick={() => cambiar(pasoDePeso(valor, -0.5))}>
				<Icono nombre="menos" tamano={18} />
			</button>
			<input
				{id}
				name="peso"
				type="text"
				inputmode="decimal"
				autocomplete="off"
				value={valor}
				oninput={(evento) => cambiar(evento.currentTarget.value)}
				aria-invalid={Boolean(error)}
			/>
			<button type="button" aria-label="Sumar 0,5 al peso" onclick={() => cambiar(pasoDePeso(valor, 0.5))}>
				<Icono nombre="mas" tamano={18} />
			</button>
		</div>
	</div>
{/snippet}

<div class="admin-encabezado">
	<div class="admin-ficha">
		<a class="mesa-volver" href="/admin/checklists">
			<Icono nombre="atras" tamano={18} />
			Todos los checklists
		</a>

		{#if renombrando}
			<form
				class="admin-renombrar"
				method="POST"
				action="?/renombrar"
				novalidate
				use:enhance={enviar('renombrar', revisarNombre, () => (renombrando = false))}
			>
				<div class="admin-campo">
					<label for="nombre-checklist">Nombre del checklist</label>
					<input
						id="nombre-checklist"
						name="nombre"
						type="text"
						autocomplete="off"
						bind:value={nombre}
						oninput={() => {
							errorNombre = null;
							nombreCorregido = true;
						}}
						aria-invalid={Boolean(errorDelNombre)}
						aria-describedby={errorDelNombre ? 'error-nombre' : undefined}
					/>
					{#if errorDelNombre}
						<p class="campo-error" id="error-nombre"><Icono nombre="error" tamano={16} />{errorDelNombre}</p>
					{:else if plantilla.estado !== 'en_construccion'}
						<p class="ayuda">El nombre nuevo se va a ver también en las evaluaciones ya enviadas.</p>
					{/if}
				</div>
				<div class="admin-renombrar-botones">
					<button class="boton enviar" type="submit" disabled={trabajando === 'renombrar'}>
						{trabajando === 'renombrar' ? 'Guardando…' : 'Guardar'}
					</button>
					<button
						class="boton secundario neutro"
						type="button"
						onclick={() => (renombrando = false)}
						disabled={trabajando === 'renombrar'}
					>
						Cancelar
					</button>
				</div>
			</form>
		{:else}
			<div class="admin-ficha-titulo">
				<h1>{plantilla.nombre}</h1>
				<button class="boton secundario neutro" type="button" aria-label="Renombrar" onclick={renombrar}>
					<Icono nombre="editar" tamano={18} />
					<span class="solo-ancho">Renombrar</span>
				</button>
			</div>
		{/if}

		<p class="admin-ficha-bajada">
			{plantilla.rol?.nombre}{comun ? ' · común a todos los escenarios' : ''}
		</p>
		<div class="admin-ficha-estados">
			<span class="checklist-estado grande {plantilla.estado}">{ESTADOS[plantilla.estado]}</span>
			<span class="admin-total">
				{criterios(data.items.length)} · máximo {numero(data.maximo)} · {plantilla.ponderado
					? 'ponderado'
					: 'sin ponderar'}
			</span>
			{#if data.escenariosQueLoUsan > 0}
				<span class="admin-total">
					{data.escenariosQueLoUsan === 1
						? 'Lo usa 1 escenario'
						: `Lo usan ${data.escenariosQueLoUsan} escenarios`}
				</span>
			{/if}
			{#if data.vecesQueSeUso > 0}
				<span class="admin-total">Ya se usó en mesas</span>
			{/if}
		</div>
	</div>
</div>

<div class="admin-cuerpo">
	{#if aviso}
		<div class="admin-aviso" class:error={!aviso.exito} role={aviso.exito ? 'status' : 'alert'}>
			<Icono nombre={aviso.exito ? 'tilde-circulo' : 'error'} />
			<p>{aviso.texto}</p>
			{#if aviso.deshacer && quitado}
				<form
					method="POST"
					action="?/restaurarItem"
					use:enhance={enviar('restaurar', undefined, () => (quitado = null))}
				>
					<input type="hidden" name="texto" value={quitado.texto} />
					<input type="hidden" name="peso" value={quitado.peso} />
					<input type="hidden" name="posicion" value={quitado.posicion} />
					<button class="admin-aviso-accion" type="submit" disabled={trabajando === 'restaurar'}>
						Deshacer
					</button>
				</form>
			{/if}
			<button type="button" aria-label="Cerrar el mensaje" onclick={() => (avisoCerrado = true)}>
				<Icono nombre="cerrar" tamano={18} />
			</button>
		</div>
	{/if}
	{#if reemplaza}
		<p class="admin-advertencia checklist-reemplaza-angosto">
			<Icono nombre="alerta" />
			<span>{reemplaza}</span>
		</p>
	{/if}

	<div class="checklist-rejilla">
		<section class="mesa-tarjeta checklist-criterios" aria-labelledby="criterios-titulo">
			<div class="checklist-criterios-cabecera">
				<div class="checklist-criterios-titulo">
					<h2 id="criterios-titulo">Criterios de evaluación</h2>
					<span>{items.length}</span>
					{#if guardandoOrden}
						<span class="checklist-guardando" role="status">
							<Icono nombre="reloj" tamano={16} />
							Guardando el orden…
						</span>
					{/if}
				</div>

				<div class="checklist-ponderacion">
					<div>
						<strong>{plantilla.ponderado ? 'Ponderado' : 'Sin ponderar'}</strong>
						<span>
							{plantilla.ponderado
								? `Cada criterio lleva su propio peso. El máximo alcanzable es ${numero(data.maximo)}.`
								: `Todos los criterios pesan lo mismo. El máximo alcanzable es ${numero(data.maximo)}.`}
						</span>
					</div>
					{#if plantilla.ponderado}
						<button class="boton secundario neutro" type="button" onclick={() => abrirDialogo('despoderar')}>
							Dejar de ponderarlo
						</button>
					{:else}
						<form method="POST" action="?/ponderacion" use:enhance={enviar('ponderacion')}>
							<input type="hidden" name="ponderado" value="true" />
							<button class="boton secundario neutro" type="submit" disabled={trabajando === 'ponderacion'}>
								{trabajando === 'ponderacion' ? 'Guardando…' : 'Ponderar el checklist'}
							</button>
						</form>
					{/if}
				</div>

				{#if items.length > 1}
					<p class="checklist-ayuda">Arrastrá un criterio, o usá las flechas, para cambiar el orden.</p>
				{/if}
				{#if falloDeOrden}
					<p class="campo-error" role="alert"><Icono nombre="error" tamano={16} />{falloDeOrden}</p>
				{/if}
			</div>

			<!-- El orden viaja entero y una sola vez, cuando se deja de mover. Sin
			     JavaScript este formulario nunca se envía: ahí mandan las flechas. -->
			<form
				bind:this={formularioDeOrden}
				method="POST"
				action="?/reordenarItems"
				class="visualmente-oculto"
				use:enhance={guardarOrden}
			>
				<input type="hidden" name="orden" value={items.map((i) => i.id).join(',')} />
			</form>

			{#if items.length > 0}
				<ol class="checklist-lista" class:ordenando={arrastrando}>
					{#each items as item, i (item.id)}
						<li
							class="checklist-criterio"
							class:tomado={arrastrando === item.id}
							class:abierto={abierto === item.id}
							data-criterio={item.id}
						>
							<div class="checklist-criterio-linea">
								<!-- El asa es lo único que arrastra: así se puede seleccionar el texto
								     del criterio sin que la fila se empiece a mover. -->
								<button
									class="checklist-asa"
									type="button"
									aria-label="Mover el criterio {i + 1}"
									title="Arrastrá para moverlo"
									onpointerdown={(evento) => tomar(evento, item.id)}
									onpointermove={arrastrar}
									onpointerup={() => (arrastrando = null)}
									onpointercancel={() => (arrastrando = null)}
								>
									<Icono nombre="asa" tamano={18} />
								</button>
								<!-- La posición se cuenta acá y no se lee de `orden`: al quitar criterios
								     el orden guardado deja huecos, y mostrarlos confundiría. -->
								<span class="checklist-numero">{i + 1}</span>
								<div class="checklist-texto">
									<p>{item.texto}</p>
									{#if plantilla.ponderado}
										<span class="checklist-peso-pastilla">Peso {numero(item.peso)}</span>
									{/if}
								</div>
								<div class="checklist-acciones">
									<form method="POST" action="?/moverItem" use:enhance={mover(item.id, -1)}>
										<input type="hidden" name="itemId" value={item.id} />
										<input type="hidden" name="hacia" value="arriba" />
										<button class="icono-boton" type="submit" disabled={i === 0} aria-label="Subir el criterio {i + 1}" title="Subir">
											<Icono nombre="arriba" tamano={18} />
										</button>
									</form>
									<form method="POST" action="?/moverItem" use:enhance={mover(item.id, 1)}>
										<input type="hidden" name="itemId" value={item.id} />
										<input type="hidden" name="hacia" value="abajo" />
										<button
											class="icono-boton"
											type="submit"
											disabled={i === items.length - 1}
											aria-label="Bajar el criterio {i + 1}"
											title="Bajar"
										>
											<Icono nombre="abajo" tamano={18} />
										</button>
									</form>
									<button class="icono-boton" type="button" aria-label="Editar el criterio {i + 1}" title="Editar" onclick={() => editar(item)}>
										<Icono nombre="editar" tamano={18} />
									</button>
									<button
										class="icono-boton peligroso"
										type="submit"
										form="quitar-{item.id}"
										aria-label="Quitar el criterio {i + 1}"
										title="Quitar"
									>
										<Icono nombre="quitar" tamano={18} />
									</button>
								</div>
								<button
									class="checklist-mas"
									type="button"
									aria-label="Acciones del criterio {i + 1}"
									aria-expanded={abierto === item.id}
									onclick={() => (abierto = abierto === item.id ? null : item.id)}
								>
									<Icono nombre="puntos" tamano={20} grosor={3} />
								</button>
							</div>

							{#if abierto === item.id}
								<div class="checklist-menu">
									<form method="POST" action="?/moverItem" use:enhance={mover(item.id, -1)}>
										<input type="hidden" name="itemId" value={item.id} />
										<input type="hidden" name="hacia" value="arriba" />
										<button type="submit" disabled={i === 0}><Icono nombre="arriba" tamano={18} />Subir</button>
									</form>
									<form method="POST" action="?/moverItem" use:enhance={mover(item.id, 1)}>
										<input type="hidden" name="itemId" value={item.id} />
										<input type="hidden" name="hacia" value="abajo" />
										<button type="submit" disabled={i === items.length - 1}>
											<Icono nombre="abajo" tamano={18} />Bajar
										</button>
									</form>
									<button type="button" onclick={() => editar(item)}><Icono nombre="editar" tamano={18} />Editar</button>
									<button class="peligroso" type="submit" form="quitar-{item.id}">
										<Icono nombre="quitar" tamano={18} />Quitar
									</button>
								</div>
							{/if}

							<!-- Quitar se manda desde la fila, desde el menú del teléfono o desde
							     el panel de edición: los tres apuntan a este formulario. -->
							<form
								id="quitar-{item.id}"
								method="POST"
								action="?/quitarItem"
								hidden
								use:enhance={enviar('quitar', recordarQuitado(item.id), () => {
									editandoId = null;
									abierto = null;
								})}
							>
								<input type="hidden" name="itemId" value={item.id} />
							</form>
						</li>
					{/each}
				</ol>
			{:else}
				<div class="checklist-sin-criterios">
					<span class="evaluado-vacio-icono"><Icono nombre="checklist" tamano={24} /></span>
					<strong>Todavía no cargaste ningún criterio.</strong>
					<p>Escribí el primero acá abajo. Cargalos en el orden en que se van a observar.</p>
				</div>
			{/if}

			{#if compositorVisible}
				<form
					class="checklist-compositor"
					method="POST"
					action="?/agregarItem"
					novalidate
					use:enhance={enviar('agregar', revisarNuevo, criterioAgregado)}
				>
					<div class="admin-campo">
						<label for="nuevo-criterio">
							{items.length === 0 ? 'Primer criterio' : `Criterio ${items.length + 1}`}: qué se observa
						</label>
						<textarea
							id="nuevo-criterio"
							name="texto"
							rows="3"
							placeholder="Realiza la evaluación primaria según ABCDE"
							bind:value={texto}
							oninput={() => {
								errorTexto = null;
								textoCorregido = true;
								agregado = false;
							}}
							onkeydown={teclaDelCompositor}
							aria-invalid={Boolean(errorDelTexto)}
							aria-describedby="ayuda-criterio"
						></textarea>
						{#if errorDelTexto}
							<p class="campo-error" id="ayuda-criterio"><Icono nombre="error" tamano={16} />{errorDelTexto}</p>
						{:else if agregado}
							<p class="checklist-agregado" id="ayuda-criterio" role="status">
								<Icono nombre="tilde-circulo" tamano={16} />Criterio agregado. Escribí el siguiente.
							</p>
						{:else}
							<p class="ayuda" id="ayuda-criterio">
								<span class="solo-ancho">Enter lo agrega al final de la lista. Shift + Enter hace un salto de línea.</span>
								<span class="solo-angosto">Se agrega al final de la lista.</span>
							</p>
						{/if}
					</div>
					<div class="checklist-compositor-botones">
						{#if plantilla.ponderado}
							{@render pesoConPasos(
								'peso-nuevo',
								peso,
								(nuevo) => {
									peso = nuevo;
									errorPesoNuevo = null;
								},
								errorPesoNuevo
							)}
						{/if}
						<button
							class="boton {principal === 'agregar' ? 'enviar' : 'secundario'}"
							type="submit"
							disabled={trabajando === 'agregar'}
						>
							<Icono nombre="mas" tamano={20} />
							{trabajando === 'agregar' ? 'Agregando…' : 'Agregar el criterio'}
						</button>
						{#if disponible}
							<button
								class="boton secundario neutro"
								type="button"
								onclick={() => {
									cargando = false;
									texto = '';
									errorTexto = null;
								}}
							>
								Cancelar
							</button>
						{/if}
					</div>
					{#if errorPesoNuevo}
						<p class="campo-error"><Icono nombre="error" tamano={16} />{errorPesoNuevo}</p>
					{/if}
				</form>
			{:else}
				<div class="checklist-plegado">
					<button class="admin-enlace" type="button" onclick={abrirCompositor}>
						<Icono nombre="mas" tamano={20} />
						Agregar un criterio
					</button>
				</div>
			{/if}
		</section>

		<aside class="checklist-costado">
			{#if !disponible}
				<section class="mesa-tarjeta checklist-terminar" aria-labelledby="terminar-titulo">
					<div>
						<h2 id="terminar-titulo">
							{plantilla.estado === 'reemplazada' ? 'Reemplazado' : 'Dar por terminado'}
						</h2>
						<p>
							{plantilla.estado === 'reemplazada'
								? 'Ya no lo usan los escenarios. Si lo das por terminado de nuevo, vuelve a usarse en todos.'
								: comun
									? 'Cuando termines de cargar los criterios. Después lo van a usar todos los escenarios.'
									: 'Cuando termines de cargar los criterios. Después se va a poder asociar a un escenario.'}
						</p>
					</div>
					<div class="checklist-cifras">
						<div><strong>{items.length}</strong><span>{items.length === 1 ? 'criterio' : 'criterios'}</span></div>
						<div><strong>{numero(data.maximo)}</strong><span>máximo alcanzable</span></div>
					</div>
					{#if reemplaza}
						<p class="admin-advertencia"><Icono nombre="alerta" /><span>{reemplaza}</span></p>
					{/if}
					<button
						class="boton {principal === 'terminar' ? 'enviar' : 'secundario'}"
						type="button"
						disabled={items.length === 0}
						onclick={() => abrirDialogo('terminar')}
					>
						Dar por terminado el checklist
					</button>
					{#if items.length === 0}
						<p class="checklist-ayuda">Agregá al menos un criterio para poder terminarlo.</p>
					{/if}
				</section>
			{:else}
				<section class="mesa-tarjeta checklist-terminar" aria-labelledby="en-uso-titulo">
					<div>
						<h2 id="en-uso-titulo">En uso</h2>
						<p>
							{comun
								? 'Lo usan todos los escenarios, en cada ciclo.'
								: 'Se puede asociar a un escenario desde la sección Escenarios.'}
						</p>
					</div>
					{#if !comun}
						<a class="admin-enlace" href="/admin/escenarios">
							Ir a Escenarios
							<Icono nombre="adelante" tamano={18} />
						</a>
					{/if}
				</section>
			{/if}
		</aside>
	</div>

	<section class="admin-eliminar" aria-label="Eliminar el checklist">
		{#if sePuedeEliminar}
			<div>
				<strong>Eliminar el checklist</strong>
				<span>Ningún escenario lo usa y nunca se usó en una mesa. No se puede deshacer.</span>
			</div>
			<button class="boton secundario" type="button" onclick={() => abrirDialogo('eliminar')}>
				<Icono nombre="quitar" tamano={18} />
				Eliminar el checklist
			</button>
		{:else}
			<Icono nombre="candado" tamano={18} />
			<p>
				Este checklist no se puede eliminar porque {data.vecesQueSeUso > 0
					? 'ya se usó en una mesa'
					: data.escenariosQueLoUsan === 1
						? 'hay un escenario que lo usa'
						: `hay ${data.escenariosQueLoUsan} escenarios que lo usan`}.
			</p>
		{/if}
	</section>
</div>

<!-- En el teléfono, terminar queda siempre a mano mientras se cargan criterios. -->
{#if !disponible}
	<div class="checklist-barra">
		<div>
			<strong>{criterios(items.length)}</strong>
			<span>máximo {numero(data.maximo)}</span>
		</div>
		<button
			class="boton {principal === 'terminar' ? 'enviar' : 'secundario'}"
			type="button"
			disabled={items.length === 0}
			onclick={() => abrirDialogo('terminar')}
		>
			Dar por terminado
		</button>
	</div>
{/if}

{#if editado}
	<div class="admin-velo" role="presentation" onclick={cerrar}></div>
	<div class="admin-panel" role="dialog" aria-modal="true" aria-labelledby="editar-titulo">
		<form
			class="admin-panel-formulario"
			method="POST"
			action="?/editarItem"
			novalidate
			use:enhance={enviar('editar', revisarEdicion, () => (editandoId = null))}
		>
			<input type="hidden" name="itemId" value={editado.id} />
			<span class="admin-asa" aria-hidden="true"></span>
			<div class="admin-panel-cabecera">
				<div>
					<h2 id="editar-titulo">Editar el criterio {posicionEditada}</h2>
					<p>{plantilla.nombre}</p>
				</div>
				<button class="admin-cerrar" type="button" aria-label="Cerrar" onclick={cerrar}>
					<Icono nombre="cerrar" tamano={20} />
				</button>
			</div>

			<div class="admin-panel-cuerpo">
				{#if respuestaDe('editar')}
					<p class="dialogo-error" role="alert"><Icono nombre="error" tamano={18} />{respuestaDe('editar')}</p>
				{/if}
				<div class="admin-campo">
					<label for="texto-editado">Qué se observa</label>
					<textarea
						id="texto-editado"
						name="texto"
						rows="6"
						bind:value={textoEditado}
						oninput={() => delete erroresEdicion.texto}
						aria-invalid={Boolean(erroresEdicion.texto)}
					></textarea>
					{#if erroresEdicion.texto}
						<p class="campo-error"><Icono nombre="error" tamano={16} />{erroresEdicion.texto}</p>
					{:else}
						<p class="ayuda">{textoEditado.length} caracteres</p>
					{/if}
				</div>
				{#if plantilla.ponderado}
					<div>
						{@render pesoConPasos(
							'peso-editado',
							pesoEditado,
							(nuevo) => {
								pesoEditado = nuevo;
								delete erroresEdicion.peso;
							},
							erroresEdicion.peso ?? null
						)}
						{#if erroresEdicion.peso}
							<p class="campo-error"><Icono nombre="error" tamano={16} />{erroresEdicion.peso}</p>
						{/if}
					</div>
				{/if}
				{#if textoEditado.trim() !== editado.texto}
					<div class="checklist-antes">
						<div>
							<span>Antes decía</span>
							<button type="button" onclick={() => ((textoEditado = editado?.texto ?? ''), (erroresEdicion = {}))}>
								Volver a este texto
							</button>
						</div>
						<p>{editado.texto}</p>
					</div>
				{/if}
				<div class="checklist-quitar-desde-edicion">
					<button class="admin-quitar" type="submit" form="quitar-{editado.id}">
						<Icono nombre="quitar" tamano={18} />
						Quitar el criterio
					</button>
				</div>
			</div>

			<div class="admin-panel-pie">
				<button class="boton secundario neutro" type="button" onclick={cerrar} disabled={trabajando === 'editar'}>
					Cancelar
				</button>
				<button class="boton enviar" type="submit" disabled={trabajando === 'editar'}>
					{trabajando === 'editar' ? 'Guardando…' : 'Guardar'}
				</button>
			</div>
		</form>
	</div>
{/if}

{#if dialogo}
	<div class="admin-velo" role="presentation" onclick={cerrar}></div>
	<div class="admin-dialogo" role="alertdialog" aria-modal="true" aria-labelledby="dialogo-titulo">
		<span class="admin-asa" aria-hidden="true"></span>
		{#if dialogo === 'terminar'}
			<h2 id="dialogo-titulo">¿Dar por terminado el checklist?</h2>
			<p>
				Lo vas a dar por terminado con {criterios(items.length)} y un máximo de {numero(data.maximo)}.
			</p>
			{#if reemplaza}
				<p class="admin-advertencia checklist-en-dialogo"><Icono nombre="alerta" /><span>{reemplaza}</span></p>
			{/if}
		{:else if dialogo === 'eliminar'}
			<h2 id="dialogo-titulo">¿Eliminar el checklist «{plantilla.nombre}»?</h2>
			<p>
				No se puede deshacer.{items.length === 1
					? ' Se va con él su criterio.'
					: items.length > 1
						? ` Se van con él sus ${items.length} criterios.`
						: ''}
			</p>
		{:else}
			<h2 id="dialogo-titulo">¿Dejar de ponderarlo?</h2>
			<p>
				Si dejás de ponderarlo, todos los pesos vuelven a 1. El máximo alcanzable pasa a ser {items.length}.
			</p>
		{/if}
		{#if respuestaDe(dialogo === 'despoderar' ? 'ponderacion' : dialogo)}
			<p class="dialogo-error" role="alert">
				<Icono nombre="error" tamano={18} />{respuestaDe(dialogo === 'despoderar' ? 'ponderacion' : dialogo)}
			</p>
		{/if}
		<form
			method="POST"
			action={dialogo === 'terminar' ? '?/terminar' : dialogo === 'eliminar' ? '?/eliminar' : '?/ponderacion'}
			use:enhance={enviar(dialogo === 'despoderar' ? 'ponderacion' : dialogo, undefined, () =>
				window.scrollTo({ top: 0 })
			)}
		>
			{#if dialogo === 'despoderar'}
				<input type="hidden" name="ponderado" value="false" />
			{/if}
			<button class="boton secundario neutro" type="button" onclick={cerrar} disabled={trabajando !== null} data-enfocar>
				{dialogo === 'terminar' ? 'Seguir cargándolo' : 'Cancelar'}
			</button>
			<button class="boton {dialogo === 'terminar' ? 'enviar' : 'peligro'}" type="submit" disabled={trabajando !== null}>
				{#if dialogo === 'terminar'}
					{trabajando ? 'Terminando…' : 'Sí, darlo por terminado'}
				{:else if dialogo === 'eliminar'}
					{trabajando ? 'Eliminando…' : 'Sí, eliminarlo'}
				{:else}
					{trabajando ? 'Guardando…' : 'Sí, dejar de ponderarlo'}
				{/if}
			</button>
		</form>
	</div>
{/if}
