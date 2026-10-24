<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import Icono from '$lib/Icono.svelte';

	let { data, form } = $props();

	type Escenario = (typeof data.escenarios)[number];

	/** Sin JavaScript un rechazo vuelve con la página entera: el panel se reabre con lo escrito. */
	let creando = $state(untrack(() => Boolean(form?.mensaje)));
	let nombre = $state(untrack(() => form?.nombre ?? ''));
	/** Lo que no pasó la revisión antes de mandar. */
	let error = $state<string | null>(null);
	/** Tocado después del último envío: la respuesta del servidor ya no aplica. */
	let corregido = $state(false);
	let trabajando = $state(false);
	let avisoCerrado = $state(false);

	const respuesta = $derived(form?.mensaje && !corregido ? form : null);
	const errorDelNombre = $derived(error ?? (respuesta?.campo ? respuesta.mensaje : null));
	const errorGeneral = $derived(respuesta && !respuesta.campo ? respuesta.mensaje : null);

	const listo = (escenario: Escenario) =>
		Boolean(escenario.checklist_tecnica && escenario.planificacion_archivo);
	const pendientes = $derived(data.escenarios.filter((escenario) => !listo(escenario)));
	const listos = $derived(data.escenarios.filter(listo));
	const grupos = $derived(
		[
			{ clave: 'pendientes', titulo: 'A medio preparar', escenarios: pendientes },
			{ clave: 'listos', titulo: 'Listos', escenarios: listos }
		].filter((grupo) => grupo.escenarios.length > 0)
	);

	async function abrir() {
		creando = true;
		avisoCerrado = true;
		error = null;
		corregido = true;
		nombre = '';
		await tick();
		document.getElementById('nombre-escenario')?.focus();
	}

	function cerrar() {
		if (!trabajando) creando = false;
	}

	const crear: SubmitFunction = ({ cancel }) => {
		const elegido = nombre.trim();
		if (elegido.length < 3) error = 'Poné un nombre de al menos 3 caracteres.';
		else if (data.escenarios.some((escenario) => escenario.nombre === elegido)) {
			error = 'Ya hay un escenario con ese nombre.';
		}
		if (error) {
			cancel();
			document.getElementById('nombre-escenario')?.focus();
			return;
		}
		corregido = false;
		trabajando = true;
		// Si sale bien, el servidor lleva a preparar el escenario recién creado.
		return async ({ update }) => {
			await update({ reset: false });
			trabajando = false;
		};
	};
</script>

<svelte:head>
	<title>Escenarios — SIMUNaM</title>
</svelte:head>

<svelte:window onkeydown={(evento) => evento.key === 'Escape' && creando && cerrar()} />

<div class="admin-encabezado">
	<div class="admin-encabezado-dentro">
		<div class="admin-titulo">
			<div>
				<h1>Escenarios</h1>
				<span class="admin-total">
					{data.escenarios.length}
					{data.escenarios.length === 1 ? 'escenario' : 'escenarios'}
				</span>
			</div>
			<p>
				Lo que las mesas van a poder practicar. Cada uno lleva su checklist de la técnica y su
				planificación.
			</p>
		</div>
		<div class="admin-acciones-encabezado">
			<button class="boton enviar" type="button" onclick={abrir}>
				<Icono nombre="mas" tamano={20} grosor={2.25} />
				Nuevo escenario
			</button>
		</div>
	</div>
</div>

<div class="admin-cuerpo">
	{#if data.eliminado && !avisoCerrado}
		<div class="admin-aviso" role="status">
			<Icono nombre="tilde-circulo" />
			<p>Se eliminó el escenario «{data.eliminado}».</p>
			<button type="button" aria-label="Cerrar el mensaje" onclick={() => (avisoCerrado = true)}>
				<Icono nombre="cerrar" tamano={18} />
			</button>
		</div>
	{/if}

	<div class="escenarios-rejilla">
		<div class="escenarios-principal">
			{#if data.escenarios.length === 0}
				<section class="mesa-tarjeta escenarios-vacio">
					<span class="evaluado-vacio-icono"><Icono nombre="escenario" tamano={24} /></span>
					<strong>Todavía no hay escenarios preparados.</strong>
					<p>Dá de alta el primero. Después le asociás el checklist de la técnica y le adjuntás la planificación.</p>
					<button class="boton secundario" type="button" onclick={abrir}>
						<Icono nombre="mas" tamano={20} />
						Dar de alta un escenario
					</button>
				</section>
			{:else}
				<section class="escenarios-lista" aria-label="Escenarios">
					<div class="escenarios-columnas" aria-hidden="true">
						<span></span>
						<span>Escenario</span>
						<span>Checklist de la técnica</span>
						<span>Planificación</span>
						<span></span>
					</div>
					{#each grupos as grupo (grupo.clave)}
						<div class="escenarios-grupo">
							<h2>{grupo.titulo}</h2>
							<span class:listos={grupo.clave === 'listos'}>{grupo.escenarios.length}</span>
						</div>
						<ul>
							{#each grupo.escenarios as escenario (escenario.id)}
								<li>
									<a class="escenarios-fila" href="/admin/escenarios/{escenario.id}">
										<span class="escenarios-estado" class:listo={listo(escenario)}>
											<Icono
												nombre={listo(escenario) ? 'tilde' : 'exclamacion'}
												tamano={14}
												grosor={2.5}
											/>
										</span>
										<span class="escenarios-nombre">{escenario.nombre}</span>
										<span class="escenarios-dato de-checklist">
											{#if escenario.checklist_tecnica}
												<Icono nombre="checklist" tamano={16} />
												<span>{escenario.checklist_tecnica.nombre}</span>
											{:else}
												<span class="escenarios-falta">Sin asociar</span>
											{/if}
										</span>
										<span class="escenarios-dato de-planificacion">
											{#if escenario.planificacion_archivo}
												<Icono nombre="planificacion" tamano={16} />
												<span class="escenarios-archivo">{escenario.planificacion_archivo}</span>
											{:else}
												<span class="escenarios-falta">Sin adjuntar</span>
											{/if}
										</span>
										<Icono nombre="adelante" tamano={18} clase="escenarios-flecha" />
									</a>
								</li>
							{/each}
						</ul>
					{/each}
				</section>
			{/if}
		</div>

		<aside class="mesa-tarjeta escenarios-comunes" aria-labelledby="comunes-titulo">
			<div>
				<h2 id="comunes-titulo">Checklists comunes</h2>
				<p>Se usan en todos los escenarios, en cada ciclo. No hace falta elegirlos.</p>
			</div>
			{#if data.checklistsComunes.length > 0}
				<ul>
					{#each data.checklistsComunes as comun (comun.id)}
						<li>
							<Icono nombre="checklist" tamano={18} />
							<span>
								<span class="escenarios-comunes-rol">{comun.rol}</span>
								<strong>{comun.nombre}</strong>
							</span>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="admin-advertencia">
					<Icono nombre="alerta" />
					<span>Todavía no hay checklists comunes cargados.</span>
				</p>
			{/if}
			<a class="admin-enlace" href="/admin/checklists">
				Ir a Checklists
				<Icono nombre="adelante" tamano={18} />
			</a>
		</aside>
	</div>
</div>

{#if creando}
	<div class="admin-velo" role="presentation" onclick={cerrar}></div>
	<div class="admin-panel" role="dialog" aria-modal="true" aria-labelledby="nuevo-titulo">
		<form
			class="admin-panel-formulario"
			method="POST"
			action="?/crear"
			novalidate
			use:enhance={crear}
		>
			<span class="admin-asa" aria-hidden="true"></span>
			<div class="admin-panel-cabecera">
				<div>
					<h2 id="nuevo-titulo">Nuevo escenario</h2>
					<p>Después le asociás el checklist de la técnica y le adjuntás la planificación.</p>
				</div>
				<button class="admin-cerrar" type="button" aria-label="Cerrar" onclick={cerrar}>
					<Icono nombre="cerrar" tamano={20} />
				</button>
			</div>

			<div class="admin-panel-cuerpo">
				{#if errorGeneral}
					<p class="dialogo-error" role="alert"><Icono nombre="error" tamano={18} />{errorGeneral}</p>
				{/if}
				<div class="admin-campo">
					<label for="nombre-escenario">Nombre del escenario</label>
					<input
						id="nombre-escenario"
						name="nombre"
						type="text"
						autocomplete="off"
						placeholder="Manejo inicial del paciente politraumatizado"
						bind:value={nombre}
						oninput={() => {
							error = null;
							corregido = true;
						}}
						aria-invalid={Boolean(errorDelNombre)}
						aria-describedby={errorDelNombre ? 'error-nombre' : 'ayuda-nombre'}
					/>
					{#if errorDelNombre}
						<p class="campo-error" id="error-nombre">
							<Icono nombre="error" tamano={16} />{errorDelNombre}
						</p>
					{:else}
						<p class="ayuda" id="ayuda-nombre">
							Es el nombre que van a ver las mesas. Podés cambiarlo después.
						</p>
					{/if}
				</div>
			</div>

			<div class="admin-panel-pie">
				<button class="boton secundario neutro" type="button" onclick={cerrar} disabled={trabajando}>
					Cancelar
				</button>
				<button class="boton enviar" type="submit" disabled={trabajando}>
					{trabajando ? 'Creando…' : 'Dar de alta el escenario'}
				</button>
			</div>
		</form>
	</div>
{/if}
