<script lang="ts">
	import Icono from '$lib/Icono.svelte';

	let { data } = $props();

	const porcentaje = (n: number) => `${Math.round(n * 100)}%`;

	const elEscenario = $derived(
		data.escenarios.find((e) => e.id === data.escenarioElegido)?.nombre ?? null
	);

	const cuantos = (n: number, singular: string, plural: string) =>
		`${n} ${n === 1 ? singular : plural}`;
</script>

<svelte:head>
	<title>Estadísticas — SIMUNaM</title>
</svelte:head>

<div class="pagina-cabecera">
	<div class="titulo">
		<h1>Estadísticas</h1>
		<p class="bajada">Qué cuesta más, sobre todo lo que se evaluó</p>
	</div>
</div>

{#if data.escenarios.length === 0}
	<div class="tarjeta">
		<div class="vacio">
			Todavía no hay ninguna evaluación enviada. Cuando las mesas empiecen a enviar sus
			checklists, acá va a verse qué criterios cuestan más.
		</div>
	</div>
{:else}
	<!-- El filtro es un formulario GET: cada escenario queda en su propia dirección,
	     se puede compartir, y la pantalla funciona con JavaScript apagado. -->
	<form class="tarjeta filtro-estadisticas" method="GET">
		<div class="campo">
			<label for="escenario">Escenario</label>
			<select id="escenario" name="escenario" onchange={(e) => e.currentTarget.form?.submit()}>
				<option value="" selected={!data.escenarioElegido}>Todos los escenarios</option>
				{#each data.escenarios as escenario (escenario.id)}
					<option value={escenario.id} selected={data.escenarioElegido === escenario.id}>
						{escenario.nombre}
					</option>
				{/each}
			</select>
		</div>
		<noscript>
			<button class="boton secundario" type="submit">Ver</button>
		</noscript>
	</form>

	<div class="cifras">
		<div class="cifra">
			<span class="numero">{data.alcance.ciclos}</span>
			<span class="rotulo-chico">{data.alcance.ciclos === 1 ? 'Ciclo' : 'Ciclos'}</span>
		</div>
		<div class="cifra">
			<span class="numero">{data.alcance.evaluaciones}</span>
			<span class="rotulo-chico">
				{data.alcance.evaluaciones === 1 ? 'Evaluación enviada' : 'Evaluaciones enviadas'}
			</span>
		</div>
		<div class="cifra">
			<span class="numero">{data.alcance.respondidas}</span>
			<span class="rotulo-chico">Criterios respondidos</span>
		</div>
		<div class="cifra">
			<span class="numero">
				{data.alcance.cumplimiento === null ? '—' : porcentaje(data.alcance.cumplimiento)}
			</span>
			<span class="rotulo-chico">Se cumplieron</span>
		</div>
	</div>

	<div class="tarjeta">
		<div class="tarjeta-cabecera">
			<h2>Lo que más falla</h2>
			<span class="detalle">
				{elEscenario ?? 'Todos los escenarios'}
			</span>
		</div>

		{#if data.puntosCriticos.length === 0}
			<div class="vacio">
				Ningún criterio se respondió al menos {data.minimo} veces todavía. Con menos que eso, un
				solo fallo ya daría una tasa alta y el ranking mostraría ruido.
			</div>
		{:else}
			<div class="tabla-envoltorio">
				<table class="tabla criticos">
					<thead>
						<tr>
							<th>Criterio</th>
							<th class="numerica"><abbr title="Veces que no se cumplió">Falló</abbr></th>
							<th>Con qué frecuencia</th>
							<th class="numerica">
								<abbr title="Peso del criterio por cada vez que falló">Puntos</abbr>
							</th>
						</tr>
					</thead>
					<tbody>
						{#each data.puntosCriticos as punto (punto.itemId)}
							<tr>
								<td class="principal">
									<span class="criterio-texto">{punto.criterio}</span>
									<span class="detalle">
										{punto.rol}{#if !data.escenarioElegido && punto.enEscenarios > 1}
											· {cuantos(punto.enEscenarios, 'escenario', 'escenarios')}
										{/if}
									</span>
								</td>
								<td class="numerica">
									<span class="de-cuantas">{punto.fallos} de {punto.respondido}</span>
								</td>
								<td class="barra-celda">
									<!-- El ancho es la tasa misma y no su proporción contra la fila más
									     alta: normalizar haría que el peor criterio llene la barra
									     siempre, aunque falle 3 de 10, y eso dice otra cosa. -->
									<span class="barra-fallo" aria-hidden="true">
										<span style="width: {punto.tasa * 100}%"></span>
									</span>
									<span class="barra-cifra">{porcentaje(punto.tasa)}</span>
								</td>
								<td class="numerica">{punto.puntos}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<div class="tarjeta-pie">
				<p class="detalle">
					Ordenado por cuán seguido falla, no por puntos: el peso de un criterio se puede
					corregir después, y eso cambiaría el orden hacia atrás.
					{#if data.sinSuficiente > 0}
						Quedan afuera {cuantos(data.sinSuficiente, 'criterio', 'criterios')} con menos de {data.minimo}
						respuestas.
					{/if}
				</p>
			</div>
		{/if}
	</div>

	<div class="tarjeta">
		<div class="tarjeta-cabecera">
			<h2>Cuánto se practicó cada escenario</h2>
			<span class="detalle">{data.practicas.length}</span>
		</div>
		<div class="tabla-envoltorio">
			<table class="tabla">
				<thead>
					<tr>
						<th>Escenario</th>
						<th class="numerica">Ciclos</th>
						<th class="numerica">Evaluaciones</th>
					</tr>
				</thead>
				<tbody>
					{#each data.practicas as practica (practica.nombre)}
						<tr>
							<td class="principal">{practica.nombre}</td>
							<td class="numerica">{practica.ciclos}</td>
							<td class="numerica">
								{#if practica.evaluaciones === 0}
									<span class="chip alerta">Sin evaluar</span>
								{:else}
									{practica.evaluaciones}
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>

	<div class="aviso info">
		<Icono nombre="info" />
		<span>
			Todo esto cuenta sólo las evaluaciones <strong>enviadas</strong>. Un checklist a medio
			marcar no se mide: sus criterios sin tocar no son fallos.
		</span>
	</div>
{/if}
