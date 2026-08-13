<script lang="ts">
	import Icono from '$lib/Icono.svelte';
	import { mostrarDni } from '$lib/dni';
	import { iconoDeRol } from '$lib/roles';

	let { data } = $props();

	const sinResolver = $derived(
		data.corridas.flatMap((c) => c.participaciones).filter((p) => !p.nombre).length
	);

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
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		<div class="tarjeta-pie">
			{#if corrida.evaluaciones > 0}
				<a class="boton fantasma" href="/admin/mesas/{data.mesa.numero}/corridas/{corrida.numero}">
					{corrida.evaluaciones === 1
						? 'Ver su evaluación'
						: `Ver sus ${corrida.evaluaciones} evaluaciones`}
					<Icono nombre="adelante" tamano={16} />
				</a>
			{:else}
				<span class="detalle">Sin evaluaciones asociadas.</span>
			{/if}
		</div>
	</div>
{:else}
	<div class="vacio">
		Esta mesa todavía no tiene corridas. El líder de mesa tiene que habilitar la primera.
	</div>
{/each}
