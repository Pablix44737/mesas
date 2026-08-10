<script lang="ts">
	import { enhance } from '$app/forms';
	import Icono from '$lib/Icono.svelte';
	import BarraSuperior from '$lib/BarraSuperior.svelte';
	import { mostrarTamano } from '$lib/planificacion';

	let { data, form } = $props();

	let habilitando = $state(false);
	let confirmandoAvance = $state(false);
	let mostrarQr = $state(true);

	const siguiente = $derived((data.corridas[0]?.numero ?? 0) + 1);

	const hora = (fecha: string) =>
		new Date(fecha).toLocaleTimeString('es-AR', {
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		});
</script>

<svelte:head>
	<title>Mesa {data.mesa.numero} — MESAS</title>
</svelte:head>

<div class="app">
	<BarraSuperior
		volverA="/mesas"
		titulo="Mesa {data.mesa.numero}"
		sub={data.escenario?.nombre ?? ''}
	>
		{#snippet derecha()}
			{#if data.corridaEnCurso}
				<span class="chip exito">Corrida {data.corridaEnCurso.numero}</span>
			{/if}
		{/snippet}
	</BarraSuperior>

	<div class="envoltorio">
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
				<h2>Código QR de la mesa</h2>
				<button class="enlace" type="button" onclick={() => (mostrarQr = !mostrarQr)}>
					{mostrarQr ? 'Ocultar' : 'Mostrar'}
				</button>
			</div>

			{#if mostrarQr}
				<div class="qr-panel">
					<img
						class="qr"
						src="/m/{data.mesa.numero}/qr"
						alt="Código QR para entrar a la mesa {data.mesa.numero}"
						width="240"
						height="240"
					/>
					<p class="detalle" style="margin: 0">
						Los participantes lo escanean para identificarse y declarar su rol.
					</p>
					<p class="qr-url">{data.origen}/m/{data.mesa.numero}</p>
					<a
						class="boton secundario"
						href="/m/{data.mesa.numero}/qr"
						target="_blank"
						rel="noopener"
					>
						<Icono nombre="qr" />
						Abrirlo solo, para proyectar o imprimir
					</a>
				</div>
			{/if}
		</div>

		<div class="tarjeta">
			<div class="tarjeta-cabecera">
				<h2>Corridas</h2>
				<Icono nombre="corrida" />
			</div>

			{#if data.corridaEnCurso}
				<p>
					La <strong>corrida {data.corridaEnCurso.numero}</strong> está habilitada desde las
					{hora(data.corridaEnCurso.creada_en)}. Los participantes pueden identificarse y declarar
					su rol, y lo que se evalúe queda referido a esta corrida.
				</p>
			{:else}
				<p>
					Esta mesa todavía no tiene ninguna corrida habilitada. Hasta que habilites la primera,
					los participantes no pueden identificarse.
				</p>
			{/if}

			{#if confirmandoAvance}
				<p>
					Habilitar la corrida {siguiente} cierra la corrida {data.corridaEnCurso?.numero}. A
					partir de ahí, lo que se registre queda referido a la nueva.
				</p>

				{#if data.sinEnviar.length > 0}
					<div class="aviso alerta">
						<Icono nombre="alerta" />
						<div>
							<strong>
								{data.sinEnviar.length === 1
									? 'Hay un observador que todavía no envió su checklist'
									: `Hay ${data.sinEnviar.length} observadores que todavía no enviaron su checklist`}.
							</strong>
							Van a poder terminarlo igual —el sistema se los ofrece cuando vuelvan a escanear
							el QR—, pero si podés, esperalos.
							<ul class="lista" style="margin-top: 8px">
								{#each data.sinEnviar as pendiente, i (i)}
									<li class="pendiente-padron">
										<span class="quien">{pendiente.quien}</span>
										<span class="detalle">
											{pendiente.rol} · {pendiente.marcados} de {pendiente.items} ítems
										</span>
									</li>
								{/each}
							</ul>
						</div>
					</div>
				{/if}

				<div class="confirmacion">
					<form
						method="POST"
						action="?/habilitarSiguiente"
						use:enhance={() => {
							habilitando = true;
							return async ({ update }) => {
								await update({ reset: false });
								habilitando = false;
								confirmandoAvance = false;
							};
						}}
					>
						<button class="boton enviar bloque" type="submit" disabled={habilitando}>
							<Icono nombre="corrida" />
							{habilitando ? 'Habilitando…' : `Sí, habilitar la corrida ${siguiente}`}
						</button>
					</form>
					<button
						class="boton secundario bloque"
						type="button"
						onclick={() => (confirmandoAvance = false)}
						disabled={habilitando}
					>
						Seguir en la corrida {data.corridaEnCurso?.numero}
					</button>
				</div>
			{:else if data.corridaEnCurso}
				<button class="boton bloque" type="button" onclick={() => (confirmandoAvance = true)}>
					<Icono nombre="corrida" />
					Habilitar la corrida {siguiente}
				</button>
			{:else}
				<form
					method="POST"
					action="?/habilitarSiguiente"
					use:enhance={() => {
						habilitando = true;
						return async ({ update }) => {
							await update({ reset: false });
							habilitando = false;
						};
					}}
				>
					<button class="boton enviar bloque" type="submit" disabled={habilitando}>
						<Icono nombre="corrida" />
						{habilitando ? 'Habilitando…' : 'Habilitar la primera corrida'}
					</button>
				</form>
			{/if}

			{#if data.corridas.length > 0}
				<ul class="lista" style="margin-top: 16px">
					{#each data.corridas as corrida (corrida.id)}
						<li class:en-curso={corrida.habilitada}>
							<span class="rotulo">Corrida {corrida.numero}</span>
							<span class="detalle">
								{#if corrida.habilitada}
									en curso desde las {hora(corrida.creada_en)}
								{:else}
									cerrada · comenzó a las {hora(corrida.creada_en)}
								{/if}
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<div class="tarjeta">
			<div class="tarjeta-cabecera">
				<h2>Material que hereda del escenario</h2>
				<Icono nombre="escenario" />
			</div>

			<div class="material">
				<div>
					<span class="etiqueta">Planificación · para el facilitador</span>
					{#if data.escenario?.planificacion_archivo}
						<span>
							<a href="/mesas/{data.mesa.numero}/planificacion" target="_blank" rel="noopener">
								{data.escenario.planificacion_archivo}
							</a>
						</span>
						<span class="detalle">
							{mostrarTamano(data.escenario.planificacion_tamano ?? 0)}
						</span>
					{:else}
						<span class="pendiente">Sin planificación cargada</span>
						<span class="detalle">El facilitador va a ver que no está disponible.</span>
					{/if}
				</div>

				<div>
					<span class="etiqueta">Checklist de la técnica · para su observador</span>
					{#if data.checklistDeTecnica}
						<span>{data.checklistDeTecnica.nombre}</span>
						<span class="detalle">
							{data.checklistDeTecnica.items} ítems · máximo {data.checklistDeTecnica.maximo}
							{#if !data.checklistDeTecnica.ponderado}· sin ponderar{/if}
						</span>
					{:else}
						<span class="pendiente">El escenario no tiene checklist de la técnica</span>
					{/if}
				</div>

				<div>
					<span class="etiqueta">Checklist de la operación · para su observador</span>
					{#if data.checklistDeOperacion}
						<span>{data.checklistDeOperacion.nombre}</span>
						<span class="detalle">
							{data.checklistDeOperacion.items} ítems · máximo {data.checklistDeOperacion.maximo}
							{#if !data.checklistDeOperacion.ponderado}· sin ponderar{/if}
							· común a todos los escenarios
						</span>
					{:else}
						<span class="pendiente">No hay checklist del observador de la operación</span>
					{/if}
				</div>
			</div>
		</div>

	</div>
</div>
