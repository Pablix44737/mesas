<script lang="ts">
	import Icono from '$lib/Icono.svelte';
	import BarraSuperior from '$lib/BarraSuperior.svelte';
	import { mostrarDni } from '$lib/dni';

	let { data } = $props();

	const raiz = $derived(`/mesas/${data.curso.codigo}/${data.mesa.numero}`);

	const cifra = (n: number) => Math.round(n * 100) / 100;

	const hora = (valor: string | null) =>
		valor
			? new Date(valor).toLocaleTimeString('es-AR', {
					hour: '2-digit',
					minute: '2-digit',
					hour12: false
				})
			: '';
</script>

<svelte:head>
	<title>Ciclo {data.corrida.numero} · Mesa {data.mesa.numero} — SIMUNaM</title>
</svelte:head>

<div class="app">
	<BarraSuperior
		volverA={raiz}
		titulo="Ciclo {data.corrida.numero}"
		sub="Mesa {data.mesa.numero} · {data.mesa.escenario ?? ''}"
	>
		{#snippet derecha()}
			{#if data.corrida.habilitada}
				<span class="chip exito">En curso</span>
			{/if}
		{/snippet}
	</BarraSuperior>

	<div class="envoltorio">
		<!-- Las corridas de la mesa, para moverse entre ellas sin volver atrás: en un
		     debriefing se mira la que terminó, pero también la anterior. -->
		{#if data.corridas.length > 1}
			<nav class="corridas-solapas" aria-label="Ciclos de la mesa">
				{#each data.corridas as corrida (corrida.numero)}
					{#if corrida.numero === data.corrida.numero}
						<span class="solapa elegida" aria-current="page">
							Ciclo {corrida.numero}
						</span>
					{:else}
						<a class="solapa" href="{raiz}/corridas/{corrida.numero}">
							Ciclo {corrida.numero}
						</a>
					{/if}
				{/each}
			</nav>
		{/if}

		{#each data.evaluaciones as evaluacion (evaluacion.instanciaId)}
			<!-- El id es el de la participación: desde la lista de participantes se
			     enlaza a la evaluación de una persona, sin pasear su documento por la URL. -->
			<div class="tarjeta" id="p-{evaluacion.participacionId}">
				<div class="tarjeta-cabecera">
					<div class="identidad">
						<span class="etiqueta">{evaluacion.rol}</span>
						{#if evaluacion.observador}
							<span class="nombre" style="font-size: 16px">{evaluacion.observador}</span>
						{:else}
							<span class="nombre sin-resolver" style="font-size: 16px">
								DNI {mostrarDni(evaluacion.dni)}
							</span>
							<span class="detalle">sin identificar en el padrón</span>
						{/if}
					</div>
					<span class="detalle">Enviado {hora(evaluacion.enviadaEn)}</span>
				</div>

				<div class="resultado">
					<span class="valor">
						<strong>{cifra(evaluacion.resultado)}</strong> de {cifra(evaluacion.maximo)}
					</span>
					<span class="detalle">
						{evaluacion.porcentaje}% de los criterios
						{#if evaluacion.ponderado}
							· {evaluacion.itemsCumplidos} de {evaluacion.items.length} ítems
						{/if}
					</span>
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
								<span class="peso" title="Peso del ítem">{item.peso}</span>
							{/if}
						</li>
					{/each}
				</ul>
			</div>
		{:else}
			<div class="aviso alerta">
				<Icono nombre="alerta" />
				<span>
					{#if data.corrida.habilitada}
						Todavía no se envió ninguna evaluación en este ciclo. Van apareciendo acá a medida
						que los observadores las envían.
					{:else}
						En este ciclo no se envió ninguna evaluación.
					{/if}
				</span>
			</div>
		{/each}
	</div>
</div>
