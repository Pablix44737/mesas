<script lang="ts">
	import { enhance } from '$app/forms';
	import Icono from '$lib/Icono.svelte';

	let { data, form } = $props();

	let renombrandoEnCurso = $state(false);
	/**
	 * Panel de renombrado abierto a mano. Mientras valga `undefined` manda lo que
	 * devolvió el servidor: así un rechazo lo reabre con lo tipeado aunque no haya
	 * JavaScript, y cancelar sigue cerrándolo.
	 */
	let abiertoAMano = $state<boolean | undefined>(undefined);
	const renombrando = $derived(abiertoAMano ?? Boolean(form?.renombrando));

	/**
	 * Mesa que se está por eliminar. Mismo centinela: mientras valga `undefined`
	 * manda el servidor, así un rechazo reabre el panel sin JavaScript.
	 */
	let bajaAMano = $state<string | null | undefined>(undefined);
	let confirmacion = $state('');
	let eliminando = $state(false);

	const porEliminar = $derived(bajaAMano === undefined ? (form?.eliminando ?? null) : bajaAMano);

	function abrir(id: string) {
		bajaAMano = id;
		confirmacion = '';
	}

	function cerrar() {
		bajaAMano = null;
		confirmacion = '';
	}
</script>

<svelte:head>
	<title>{data.curso.nombre} — SIMUNaM</title>
</svelte:head>

<a class="miga" href="/admin/cursos">
	<Icono nombre="atras" tamano={16} />
	Todos los cursos
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
			<label class="etiqueta" for="nombre-curso">Nombre del curso</label>
			<div class="fila">
				<!-- svelte-ignore a11y_autofocus -->
				<input
					id="nombre-curso"
					name="nombre"
					type="text"
					autocomplete="off"
					value={form?.renombrando ? (form.nombre ?? '') : data.curso.nombre}
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
		</form>
	{:else}
		<div class="titulo">
			<h1>{data.curso.nombre}</h1>
			<p class="bajada">Las mesas de esta edición</p>
		</div>
		<span class="fila">
			<button class="boton fantasma" type="button" onclick={() => (abiertoAMano = true)}>
				<Icono nombre="editar" tamano={16} />
				Renombrar
			</button>
			{#if data.curso.archivado}
				<span class="chip neutro">Archivado</span>
			{/if}
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

<div class="tarjeta">
	<div class="tarjeta-cabecera">
		<h2>Mesas del curso</h2>
		<span class="detalle">{data.mesas.length}</span>
	</div>

	{#if data.mesas.length === 0}
		<div class="vacio">
			Este curso todavía no tiene mesas. Las crea el líder de mesa desde su pantalla.
		</div>
	{:else}
		<div class="tabla-envoltorio">
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
					{#each data.mesas as mesa (mesa.id)}
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
								<span class="acciones-fila">
									<a
										class="boton fantasma"
										href="/admin/cursos/{data.curso.codigo}/mesas/{mesa.numero}"
									>
										Consultar
										<Icono nombre="adelante" tamano={16} />
									</a>
									{#if porEliminar === mesa.id}
										<button class="icono-boton" type="button" title="Cancelar" onclick={cerrar}>
											<Icono nombre="cerrar" tamano={18} />
											<span class="visualmente-oculto">Cancelar</span>
										</button>
									{:else}
										<button
											class="icono-boton peligroso"
											type="button"
											title="Eliminar la mesa"
											onclick={() => abrir(mesa.id)}
										>
											<Icono nombre="quitar" tamano={18} />
											<span class="visualmente-oculto">Eliminar la mesa</span>
										</button>
									{/if}
								</span>
							</td>
						</tr>

						{#if porEliminar === mesa.id}
							<tr>
								<td colspan="5" style="padding-top: 0">
									<div class="aviso error desplegable" style="margin: 0">
										<Icono nombre="alerta" />
										<div>
											<strong>
												Eliminar la mesa {mesa.numero} borra también
												{mesa.corridas === 1 ? 'su corrida' : `sus ${mesa.corridas} corridas`},
												quiénes ocuparon cada rol
												{#if mesa.evaluaciones > 0}
													y {mesa.evaluaciones === 1
														? 'la evaluación que se envió'
														: `las ${mesa.evaluaciones} evaluaciones que se enviaron`}
												{/if}.
											</strong>
											No se puede deshacer. El padrón y el material del escenario no se tocan:
											lo que se pierde es lo que pasó en esta mesa.

											<form
												method="POST"
												action="?/eliminar"
												style="margin-top: 12px"
												use:enhance={() => {
													eliminando = true;
													return async ({ update }) => {
														await update();
														eliminando = false;
														// Si salió bien no hay fila que reabrir; si no, queda abierta.
														bajaAMano = form?.eliminando ?? null;
														confirmacion = '';
													};
												}}
											>
												<input type="hidden" name="id" value={mesa.id} />
	
												<div class="campo" style="max-width: 18rem">
													<label for="confirmacion-{mesa.id}">
														Escribí «{mesa.numero}» para confirmar
													</label>
													<input
														id="confirmacion-{mesa.id}"
														name="confirmacion"
														type="text"
														inputmode="numeric"
														autocomplete="off"
														bind:value={confirmacion}
														required
													/>
												</div>

												<div class="confirmacion">
													<button
														class="boton peligro"
														type="submit"
														disabled={eliminando || confirmacion.trim() !== String(mesa.numero)}
													>
														<Icono nombre="quitar" />
														{eliminando ? 'Eliminando…' : `Sí, eliminar la mesa ${mesa.numero}`}
													</button>
													<button
														class="boton secundario"
														type="button"
														onclick={cerrar}
														disabled={eliminando}
													>
														Cancelar
													</button>
												</div>
											</form>
										</div>
									</div>
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
