<script lang="ts">
	import { enhance } from '$app/forms';
	import Icono from '$lib/Icono.svelte';
	import { mostrarDni } from '$lib/dni';
	import { iconoDeRol } from '$lib/roles';

	let { data, form } = $props();

	/** Corrida que se está por eliminar, mientras se confirma. */
	let eliminando = $state<string | null>(null);
	/** Registro de participación que se está por dar de baja, mientras se confirma. */
	let dandoDeBaja = $state<string | null>(null);
	let enCurso = $state(false);

	const sinResolver = $derived(
		data.corridas.flatMap((c) => c.participaciones).filter((p) => !p.nombre).length
	);

	/**
	 * Qué se lleva puesto eliminar la corrida. Se arma acá y no en el marcado
	 * porque las condiciones pegadas a un literal se comen el espacio entre medio.
	 */
	const seVanConElla = (roles: number, sinEnviar: number) => {
		const ocupados = roles === 1 ? 'el rol que alguien ocupó' : `los ${roles} roles ocupados`;
		const abiertos =
			sinEnviar === 0
				? ''
				: sinEnviar === 1
					? ' y un checklist abierto sin enviar'
					: ` y ${sinEnviar} checklists abiertos sin enviar`;
		return `Se van con ella ${ocupados}${abiertos}.`;
	};

	const hora = (fecha: string) =>
		new Date(fecha).toLocaleTimeString('es-AR', {
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		});
</script>

<svelte:head>
	<title>Mesa {data.mesa.numero} — SIMUNaM</title>
</svelte:head>

<a class="miga" href="/admin/mesas">
	<Icono nombre="atras" tamano={16} />
	Todas las mesas
</a>

<div class="pagina-cabecera">
	<div class="titulo">
		<h1>Mesa {data.mesa.numero}</h1>
		<p class="bajada">{data.escenario?.nombre}</p>
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

{#if sinResolver > 0}
	<div class="aviso alerta">
		<Icono nombre="alerta" />
		<span>
			{sinResolver === 1
				? 'Un rol de esta mesa fue ocupado por un DNI que el padrón no reconoce'
				: `${sinResolver} roles de esta mesa fueron ocupados por DNI que el padrón no reconoce`}.
			<a href="/admin/padron">Incorporá a esas personas</a> y los registros quedan resueltos.
		</span>
	</div>
{/if}

{#each data.corridas as corrida (corrida.id)}
	<div class="tarjeta">
		<div class="tarjeta-cabecera">
			<div class="identidad">
				<span class="nombre" style="font-size: 16px">Corrida {corrida.numero}</span>
				<span class="detalle">
					{#if corrida.habilitada}
						en curso desde las {hora(corrida.creada_en)}
					{:else}
						cerrada · comenzó a las {hora(corrida.creada_en)}
					{/if}
				</span>
			</div>
			{#if corrida.habilitada}
				<span class="chip exito">En curso</span>
			{/if}
		</div>

		{#if corrida.participaciones.length === 0}
			<div class="vacio">Nadie se identificó todavía en esta corrida.</div>
		{:else}
			<div class="tabla-envoltorio">
				<table class="tabla">
					<thead>
						<tr>
							<th>Rol</th>
							<th>Participante</th>
							<th>Padrón</th>
							<th>Evaluación</th>
							<th class="acciones"></th>
						</tr>
					</thead>
					<tbody>
						{#each corrida.participaciones as participacion (participacion.id)}
							<tr>
								<td>
									<span class="fila">
										<Icono nombre={iconoDeRol[participacion.rolCodigo] ?? 'operador'} tamano={18} />
										{participacion.rolNombre}
									</span>
								</td>
								<td class="principal">
									{#if participacion.nombre}
										{participacion.nombre}
									{:else}
										<span class="pendiente">DNI {mostrarDni(participacion.dni)}</span>
									{/if}
								</td>
								<td>
									{#if participacion.nombre}
										<span class="chip exito">Identificado</span>
									{:else}
										<span class="chip alerta">Sin identificar</span>
									{/if}
								</td>
								<td>
									{#if participacion.evaluo}
										<span class="chip exito">Enviada</span>
									{:else}
										<span class="detalle">—</span>
									{/if}
								</td>
								<td class="acciones">
									{#if participacion.evaluo}
										<!-- Sin botón: su checklist ya está enviado y ese registro no se toca. -->
										<span class="detalle">—</span>
									{:else if dandoDeBaja === participacion.id}
										<button
											class="enlace"
											type="button"
											onclick={() => (dandoDeBaja = null)}
											disabled={enCurso}
										>
											Cancelar
										</button>
									{:else}
										<button
											class="enlace peligroso"
											type="button"
											onclick={() => {
												eliminando = null;
												dandoDeBaja = participacion.id;
											}}
										>
											Dar de baja
										</button>
									{/if}
								</td>
							</tr>

							{#if dandoDeBaja === participacion.id}
								<tr>
									<td colspan="5" style="padding-top: 0">
										<div class="aviso alerta desplegable" style="margin: 0">
											<Icono nombre="alerta" />
											<div>
												<strong>
													{participacion.nombre ?? `El DNI ${mostrarDni(participacion.dni)}`}
													deja de estar registrado como {participacion.rolNombre} en la corrida
													{corrida.numero}.
												</strong>
												Es lo que hay que hacer cuando alguien eligió mal el rol: mientras su
												registro exista, el sistema lo lleva siempre al que ya tiene. Al darlo de
												baja puede volver a escanear el QR y elegir el rol correcto. Lo único que
												se pierde son las marcas que haya hecho con el rol equivocado.

												<form
													method="POST"
													action="?/eliminarParticipacion"
													style="margin-top: 12px"
													use:enhance={() => {
														enCurso = true;
														return async ({ update }) => {
															await update({ reset: false });
															enCurso = false;
															dandoDeBaja = null;
														};
													}}
												>
													<input
														type="hidden"
														name="participacionId"
														value={participacion.id}
													/>
													<button class="boton peligro" type="submit" disabled={enCurso}>
														<Icono nombre="quitar" />
														{enCurso ? 'Dando de baja…' : 'Sí, dar de baja este registro'}
													</button>
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

		<div class="tarjeta-pie">
			<div class="fila">
				{#if corrida.evaluaciones > 0}
					<a
						class="boton fantasma"
						href="/admin/mesas/{data.mesa.numero}/corridas/{corrida.numero}"
					>
						{corrida.evaluaciones === 1
							? 'Ver su evaluación'
							: `Ver sus ${corrida.evaluaciones} evaluaciones`}
						<Icono nombre="adelante" tamano={16} />
					</a>
				{:else}
					<span class="detalle">Sin evaluaciones asociadas.</span>
				{/if}

				{#if corrida.sePuedeEliminar}
					{#if eliminando === corrida.id}
						<button
							class="enlace"
							type="button"
							style="margin-left: auto"
							onclick={() => (eliminando = null)}
							disabled={enCurso}
						>
							Cancelar
						</button>
					{:else}
						<button
							class="enlace peligroso"
							type="button"
							style="margin-left: auto"
							onclick={() => {
								dandoDeBaja = null;
								eliminando = corrida.id;
							}}
						>
							Eliminar esta corrida
						</button>
					{/if}
				{/if}
			</div>

			{#if corrida.sePuedeEliminar && eliminando === corrida.id}
				{@const anterior = data.corridas.find((c) => c.numero === corrida.numero - 1)}
				<div class="aviso alerta" style="margin: 12px 0 0">
					<Icono nombre="alerta" />
					<div>
						<strong>
							Eliminar la corrida {corrida.numero}
							{#if anterior}
								devuelve la mesa a la corrida {anterior.numero}, que vuelve a quedar habilitada.
							{:else}
								deja la mesa sin corridas, como recién creada.
							{/if}
						</strong>
						{#if corrida.participaciones.length === 0}
							Todavía no se identificó nadie en ella, así que no se pierde nada.
						{:else}
							{seVanConElla(corrida.participaciones.length, corrida.sinEnviar)} Nadie envió nada,
							así que no se pierde ninguna evaluación.
						{/if}

						<form
							method="POST"
							action="?/eliminarCorrida"
							style="margin-top: 12px"
							use:enhance={() => {
								enCurso = true;
								return async ({ update }) => {
									await update({ reset: false });
									enCurso = false;
									eliminando = null;
								};
							}}
						>
							<input type="hidden" name="corridaId" value={corrida.id} />
							<button class="boton peligro" type="submit" disabled={enCurso}>
								<Icono nombre="quitar" />
								{enCurso ? 'Eliminando…' : `Sí, eliminar la corrida ${corrida.numero}`}
							</button>
						</form>
					</div>
				</div>
			{/if}
		</div>
	</div>
{:else}
	<div class="vacio">
		Esta mesa todavía no tiene corridas. El líder de mesa tiene que habilitar la primera.
	</div>
{/each}
