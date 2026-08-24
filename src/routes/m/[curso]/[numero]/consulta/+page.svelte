<script lang="ts">
	import { enhance } from '$app/forms';
	import Icono from '$lib/Icono.svelte';
	import BarraSuperior from '$lib/BarraSuperior.svelte';

	let { data, form } = $props();

	let buscando = $state(false);

	const cifra = (n: number) => Math.round(n * 100) / 100;

	const fecha = (valor: string | null) =>
		valor
			? new Date(valor).toLocaleString('es-AR', {
					dateStyle: 'short',
					timeStyle: 'short',
					hour12: false
				})
			: '';
</script>

<svelte:head>
	<title>Tu corrida — Mesa {data.mesa.numero}</title>
</svelte:head>

<div class="app">
	<BarraSuperior
		volverA="/m/{data.curso}/{data.mesa.numero}"
		titulo="Mesa {data.mesa.numero}"
		sub={data.mesa.escenario ?? ''}
	/>

	<div class="envoltorio">
		<div class="pagina-cabecera">
			<div class="titulo">
				<h1>Lo registrado sobre tu corrida</h1>
				<p class="bajada">
					Si practicaste la técnica en esta mesa, identificate para ver los checklists que
					enviaron quienes te evaluaron.
				</p>
			</div>
		</div>

		<div class="tarjeta">
			<form
				method="POST"
				use:enhance={() => {
					buscando = true;
					return async ({ update }) => {
						await update({ reset: false });
						buscando = false;
					};
				}}
			>
				<div class="campo">
					<label for="dni">Tu DNI</label>
					<div class="campo-con-icono">
						<Icono nombre="dni" />
						<input
							id="dni"
							name="dni"
							type="tel"
							inputmode="numeric"
							autocomplete="off"
							enterkeyhint="search"
							placeholder="30111222"
							value={form?.dni ?? ''}
							required
						/>
					</div>
				</div>
				<button class="boton bloque" type="submit" disabled={buscando}>
					<Icono nombre="buscar" />
					{buscando ? 'Buscando…' : 'Ver mi corrida'}
				</button>
			</form>
		</div>

		{#if form?.mensaje}
			<div class="aviso alerta" role="alert">
				<Icono nombre="alerta" />
				<span>{form.mensaje}</span>
			</div>
		{/if}

		{#if form?.corridas}
			{#if form.nombre}
				<div class="aviso exito" role="status">
					<Icono nombre="tilde-circulo" />
					<span>Te identificamos como {form.nombre}.</span>
				</div>
			{/if}

			{#each form.corridas as corrida (corrida.numero)}
				<div class="pagina-cabecera" style="margin: 24px 0 12px">
					<div class="titulo">
						<h2 class="t-seccion">Corrida {corrida.numero}</h2>
						<p class="bajada">Fuiste {corrida.rol}</p>
					</div>
					{#if corrida.enCurso}
						<span class="chip alerta">En curso</span>
					{/if}
				</div>

				{#if corrida.enCurso}
					<div class="aviso alerta">
						<Icono nombre="reloj" />
						<span>
							Esta corrida todavía está en curso: puede que falten checklists por enviar.
						</span>
					</div>
				{/if}

				{#if corrida.evaluaciones.length === 0}
					<div class="vacio">Todavía no hay checklists enviados sobre esta corrida.</div>
				{:else}
					{#each corrida.evaluaciones as evaluacion (evaluacion.instanciaId)}
						<div class="tarjeta">
							<div class="tarjeta-cabecera">
								<div class="identidad">
									<span class="etiqueta">{evaluacion.rol}</span>
									{#if evaluacion.observador}
										<span class="nombre" style="font-size: 15px">
											{evaluacion.observador}
										</span>
									{/if}
								</div>
								<span class="detalle">{fecha(evaluacion.enviadaEn)}</span>
							</div>

							<div class="resultado">
								<span class="valor">
									<strong>{cifra(evaluacion.resultado)}</strong> de {cifra(evaluacion.maximo)}
								</span>
								<span class="detalle">{evaluacion.porcentaje}% de los criterios</span>
							</div>
							<div class="barra" role="presentation">
								<span style="width: {evaluacion.porcentaje}%"></span>
							</div>

							<p class="detalle" style="margin-bottom: 8px">{evaluacion.checklist}</p>

							<ul class="completado">
								{#each evaluacion.items as item (item.id)}
									<li class:cumplido={item.cumplido}>
										<span class="marca">
											<Icono
												nombre={item.cumplido ? 'tilde' : 'cerrar'}
												tamano={16}
												grosor={item.cumplido ? 3 : 2}
											/>
										</span>
										<span class="texto">{item.texto}</span>
										{#if evaluacion.ponderado}
											<span class="peso">{item.peso}</span>
										{/if}
									</li>
								{/each}
							</ul>
						</div>
					{/each}
				{/if}
			{/each}
		{/if}
	</div>
</div>
