<script lang="ts">
	import Icono from '$lib/Icono.svelte';
	import { mostrarDni } from '$lib/dni';

	let { data } = $props();

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
	<title>Mesa {data.mesa.numero} · Corrida {data.corrida.numero} — MESAS</title>
</svelte:head>

<a class="miga" href="/admin/mesas/{data.mesa.numero}">
	<Icono nombre="atras" tamano={16} />
	Mesa {data.mesa.numero}
</a>

<div class="pagina-cabecera">
	<div class="titulo">
		<h1>Corrida {data.corrida.numero}</h1>
		<p class="bajada">Mesa {data.mesa.numero} · {data.mesa.escenario}</p>
	</div>
	{#if data.corrida.habilitada}
		<span class="chip exito">En curso</span>
	{/if}
</div>

{#each data.evaluaciones as evaluacion (evaluacion.instanciaId)}
	<div class="tarjeta">
		<div class="tarjeta-cabecera">
			<div class="identidad">
				<span class="etiqueta">{evaluacion.rol}</span>
				{#if evaluacion.observador}
					<span class="nombre" style="font-size: 16px">{evaluacion.observador}</span>
					<span class="detalle">DNI {mostrarDni(evaluacion.dni)}</span>
				{:else}
					<span class="nombre sin-resolver" style="font-size: 16px">
						DNI {mostrarDni(evaluacion.dni)}
					</span>
					<span class="detalle">sin identificar en el padrón</span>
				{/if}
			</div>
			<span class="detalle">{fecha(evaluacion.enviadaEn)}</span>
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
			Esta corrida todavía no tiene evaluaciones asociadas: sus observadores aún no enviaron sus
			checklists.
		</span>
	</div>
{/each}
