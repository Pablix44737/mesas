<script lang="ts">
	import { page } from '$app/state';
	import Icono from '$lib/Icono.svelte';
	import { mostrarDni } from '$lib/dni';

	let { data } = $props();

	const raiz = $derived(`/mesas/${data.curso.codigo}/${data.mesa.numero}`);

	/**
	 * La evaluación a la que se llegó: desde «Envió ›» en la pantalla de la mesa o
	 * tocando su fila en el resumen. Queda marcada en las dos partes.
	 */
	const elegida = $derived(page.url.hash.startsWith('#p-') ? page.url.hash.slice(3) : null);

	/** Lo que muestra cada tarjeta: sus «No hizo», o la lista entera. */
	let completas = $state<Record<string, boolean>>({});

	const evaluaciones = $derived(
		data.evaluaciones.map((evaluacion) => ({
			...evaluacion,
			// Numerados por posición: el orden guardado puede tener saltos.
			items: evaluacion.items.map((item, i) => ({ ...item, numero: i + 1 })),
			noHizo: evaluacion.items.filter((item) => !item.cumplido).length
		}))
	);

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

{#snippet quien(evaluacion: { observador: string | null; dni: string })}
	{evaluacion.observador ?? `DNI ${mostrarDni(evaluacion.dni)}`}
{/snippet}

<div class="evaluado-pagina">
	<header class="mesa-cabecera">
		<div class="mesa-cabecera-dentro">
			<div class="mesa-navegacion">
				<a class="mesa-volver" href={raiz}>
					<Icono nombre="atras" />
					Mesa {data.mesa.numero}
				</a>
			</div>

			<div class="mesa-titulo-fila">
				<div class="mesa-titulo">
					<div class="evaluado-titulo">
						<h1>Ciclo {data.corrida.numero}</h1>
						{#if data.corrida.habilitada}
							<span class="estado-mesa en-curso">
								<span class="punto" aria-hidden="true"></span>
								En curso
							</span>
						{:else}
							<span class="estado-mesa cerrado">
								<Icono nombre="candado" tamano={14} />
								Cerrado
							</span>
						{/if}
					</div>
					<p class="mesa-escenario">
						Mesa {data.mesa.numero}{data.mesa.escenario ? ` · ${data.mesa.escenario}` : ''}
					</p>
				</div>

				{#if data.corridas.length > 1}
					<nav class="selector-ciclos" aria-label="Ciclos de la mesa">
						<div>
							{#each data.corridas as corrida (corrida.numero)}
								<a
									href="{raiz}/corridas/{corrida.numero}"
									aria-label="Ciclo {corrida.numero}{corrida.habilitada ? ', en curso' : ''}"
									aria-current={corrida.numero === data.corrida.numero ? 'page' : undefined}
								>
									{corrida.numero}
									{#if corrida.habilitada}<span class="vivo" aria-hidden="true"></span>{/if}
								</a>
							{/each}
						</div>
					</nav>
				{/if}
			</div>
		</div>
	</header>

	<main class="evaluado-cuerpo">
		{#if evaluaciones.length === 0}
			<section class="mesa-tarjeta evaluado-vacio">
				<span class="evaluado-vacio-icono"><Icono nombre="checklist" tamano={24} /></span>
				{#if data.corrida.habilitada}
					<strong>Todavía no se envió ninguna evaluación en este ciclo.</strong>
					<span>Van apareciendo acá a medida que los observadores las envían.</span>
				{:else}
					<strong>En este ciclo no se envió ninguna evaluación.</strong>
				{/if}
			</section>
		{:else}
			<aside class="evaluado-resumen">
				<section class="mesa-tarjeta">
					<div class="evaluado-resumen-cabecera">
						<h2>
							{evaluaciones.length === 1 ? '1 evaluación' : `${evaluaciones.length} evaluaciones`}
						</h2>
						{#if data.corrida.habilitada}
							<p class="detalle">Pueden llegar más mientras el ciclo siga en curso.</p>
						{/if}
					</div>
					<ul>
						{#each evaluaciones as evaluacion (evaluacion.instanciaId)}
							<li>
								<a
									href="#p-{evaluacion.participacionId}"
									class:elegida={elegida === evaluacion.participacionId}
								>
									<span class="resumen-fila">
										<span class="resumen-quien">
											<span class="nombre">{@render quien(evaluacion)}</span>
											<span class="detalle">{evaluacion.rol}</span>
										</span>
										{#if evaluacion.noHizo > 0}
											<span class="cuenta-no-hizo" title="Ítems que no hizo">
												<Icono nombre="cerrar" tamano={13} grosor={3} />
												{evaluacion.noHizo}
											</span>
										{/if}
										<span class="resumen-puntaje">
											<strong>{evaluacion.porcentaje}%</strong>
											<span>{cifra(evaluacion.resultado)} de {cifra(evaluacion.maximo)}</span>
										</span>
									</span>
									<span class="barra-fina" role="presentation">
										<span style="width: {evaluacion.porcentaje}%"></span>
									</span>
								</a>
							</li>
						{/each}
					</ul>
				</section>
			</aside>

			<div class="evaluado-tarjetas">
				{#each evaluaciones as evaluacion (evaluacion.instanciaId)}
					{@const completa = completas[evaluacion.instanciaId] ?? false}
					{@const visibles = completa
						? evaluacion.items
						: evaluacion.items.filter((item) => !item.cumplido)}
					<!-- El id es el de la participación: «Envió ›» en la pantalla de la mesa
					     enlaza acá, sin pasear el documento de nadie por la URL. -->
					<article
						class="mesa-tarjeta evaluacion"
						class:elegida={elegida === evaluacion.participacionId}
						id="p-{evaluacion.participacionId}"
					>
						<div class="evaluacion-cabecera">
							<div class="evaluacion-encabezado">
								<div class="evaluacion-quien">
									<span class="rotulo-chico">
										{evaluacion.rol}{evaluacion.conduceLaMesa ? ' · Conduce la mesa' : ''}
									</span>
									<span class="evaluacion-nombre">{@render quien(evaluacion)}</span>
									{#if !evaluacion.observador}
										<span class="detalle">Sin identificar en el padrón</span>
									{/if}
									<span class="detalle">Enviado {hora(evaluacion.enviadaEn)}</span>
								</div>
								<div class="evaluacion-puntaje">
									<strong>{evaluacion.porcentaje}%</strong>
									<span>{cifra(evaluacion.resultado)} de {cifra(evaluacion.maximo)}</span>
								</div>
							</div>
							<span class="barra-fina gruesa" role="presentation">
								<span style="width: {evaluacion.porcentaje}%"></span>
							</span>
							<div class="evaluacion-lista">
								<span>
									<Icono nombre="checklist" tamano={16} />
									{evaluacion.checklist}
								</span>
								{#if evaluacion.ponderado}
									<strong>{evaluacion.itemsCumplidos} de {evaluacion.items.length} ítems</strong>
								{/if}
							</div>
						</div>

						<div class="pestanas" role="group" aria-label="Qué ítems mostrar">
							<button
								type="button"
								aria-pressed={!completa}
								onclick={() => (completas[evaluacion.instanciaId] = false)}
							>
								No hizo · {evaluacion.noHizo}
							</button>
							<button
								type="button"
								aria-pressed={completa}
								onclick={() => (completas[evaluacion.instanciaId] = true)}
							>
								Lista completa · {evaluacion.items.length}
							</button>
						</div>

						<ul class="evaluacion-items">
							{#if !completa && evaluacion.noHizo === 0}
								<li class="todo-hizo">
									<Icono nombre="tilde" grosor={2.5} />
									Hizo todos los ítems
								</li>
							{/if}
							{#each visibles as item (item.id)}
								<li class:no-hizo={!item.cumplido}>
									<span class="orden">{item.numero}</span>
									{#if item.cumplido}
										<span class="marca hizo">
											<Icono nombre="tilde" tamano={15} grosor={3} />
											<span class="visualmente-oculto">Hizo</span>
										</span>
									{:else}
										<span class="marca no-hizo">
											<Icono nombre="cerrar" tamano={14} grosor={3} />
											<span class="visualmente-oculto">No hizo</span>
										</span>
									{/if}
									<span class="texto">{item.texto}</span>
									{#if evaluacion.ponderado}
										<span class="peso-item">peso {item.peso}</span>
									{/if}
								</li>
							{/each}
						</ul>
					</article>
				{/each}
			</div>
		{/if}
	</main>
</div>
