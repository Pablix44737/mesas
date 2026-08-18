<script lang="ts">
	import { enhance } from '$app/forms';
	import Icono from '$lib/Icono.svelte';

	let { data, form } = $props();

	/**
	 * Mesa que se está por eliminar, mientras se confirma. Arranca de lo que
	 * devolvió el servidor para que un rechazo reabra el panel aunque no haya
	 * JavaScript; `undefined` significa «todavía manda el servidor».
	 */
	let abiertaAMano = $state<string | null | undefined>(undefined);
	let confirmacion = $state('');
	let eliminando = $state(false);

	const porEliminar = $derived(
		abiertaAMano === undefined ? (form?.eliminando ?? null) : abiertaAMano
	);

	function abrir(id: string) {
		abiertaAMano = id;
		confirmacion = '';
	}

	function cerrar() {
		abiertaAMano = null;
		confirmacion = '';
	}
</script>

<svelte:head>
	<title>Mesas — SIMUNaM</title>
</svelte:head>

<div class="pagina-cabecera">
	<div class="titulo">
		<h1>Mesas</h1>
		<p class="bajada">Cómo se desarrolló el trabajo de cada mesa</p>
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

<div class="tarjeta">
	<div class="tarjeta-cabecera">
		<h2>Mesas del evento</h2>
		<span class="detalle">{data.mesas.length}</span>
	</div>

	{#if data.mesas.length === 0}
		<div class="vacio">Todavía no hay mesas creadas.</div>
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
								{#if porEliminar === mesa.id}
									<button class="enlace" type="button" onclick={cerrar}>Cancelar</button>
								{:else}
									<span class="fila">
										<a class="boton fantasma" href="/admin/mesas/{mesa.numero}">
											Consultar
											<Icono nombre="adelante" tamano={16} />
										</a>
										<button
											class="enlace peligroso"
											type="button"
											onclick={() => abrir(mesa.id)}
										>
											Eliminar
										</button>
									</span>
								{/if}
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
														abiertaAMano = form?.eliminando ?? null;
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
