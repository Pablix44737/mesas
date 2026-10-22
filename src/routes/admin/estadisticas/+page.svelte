<script lang="ts">
	import Icono from '$lib/Icono.svelte';

	let { data } = $props();

	const porcentaje = (n: number) => `${Math.round(n * 100)}%`;

	const elEscenario = $derived(
		data.escenarios.find((e) => e.id === data.escenarioElegido)?.nombre ?? null
	);

	const cuantos = (n: number, singular: string, plural: string) =>
		`${n} ${n === 1 ? singular : plural}`;

	/** La dirección de este mismo tablero con un criterio abierto, o sin él. */
	function conCriterio(itemId: string | null, eje?: 'vuelta' | 'fecha') {
		const parametros = new URLSearchParams();
		if (data.escenarioElegido) parametros.set('escenario', data.escenarioElegido);
		if (itemId) parametros.set('criterio', itemId);
		const cual = eje ?? data.evolucion?.eje;
		if (itemId && cual === 'fecha') parametros.set('eje', 'fecha');
		const cola = parametros.toString();
		return cola ? `?${cola}#evolucion` : '?#evolucion';
	}

	const fechaCorta = (iso: string) => {
		const [a, m, d] = iso.split('-').map(Number);
		return new Date(a, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
	};

	const etiquetaDe = (punto: { etiqueta: string }) =>
		data.evolucion?.eje === 'fecha' ? fechaCorta(punto.etiqueta) : `Vuelta ${punto.etiqueta}`;
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
							<tr class:abierta={data.evolucion?.criterio.itemId === punto.itemId}>
								<td class="principal">
									<!-- El criterio abre su propia evolución. Es un enlace y no un botón:
									     queda en la dirección, se puede compartir, y anda sin JavaScript. -->
									<a class="criterio-enlace" href={conCriterio(punto.itemId)}>
										<span class="criterio-texto">{punto.criterio}</span>
									</a>
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

	{#if data.evolucion}
		{@const evo = data.evolucion}
		{@const masAlto = Math.max(...evo.puntos.map((p) => Math.max(p.tasa, p.conjunto ?? 0)), 0.01)}
		<div class="tarjeta evolucion" id="evolucion">
			<div class="tarjeta-cabecera">
				<h2>Cómo viene cambiando</h2>
				<a class="enlace-accion" href={conCriterio(null)}>Cerrar</a>
			</div>

			<div class="evolucion-quien">
				<p class="criterio-texto">{evo.criterio.texto}</p>
				<p class="detalle">{evo.criterio.rol} · {evo.criterio.checklist}</p>
			</div>

			<!-- Dos ejes distintos, no dos formas de ver lo mismo: la vuelta pregunta
			     si la práctica repetida mejora, la fecha si una corrección sirvió. -->
			<div class="pestanas" role="group" aria-label="Contra qué eje">
				<a href={conCriterio(evo.criterio.itemId, 'vuelta')} aria-current={evo.eje === 'vuelta' ? 'page' : undefined}>
					Por vuelta de la mesa
				</a>
				<a href={conCriterio(evo.criterio.itemId, 'fecha')} aria-current={evo.eje === 'fecha' ? 'page' : undefined}>
					Por fecha
				</a>
			</div>

			{#if evo.puntos.length <= 1}
				<div class="vacio">
					{evo.eje === 'fecha'
						? 'Todas las evaluaciones de este checklist se enviaron el mismo día, así que todavía no hay nada que comparar contra el calendario.'
						: 'Este checklist se evaluó en una sola vuelta.'}
				</div>
			{:else}
				<ul class="serie">
					{#each evo.puntos as punto (punto.etiqueta)}
						<li class:vacia={punto.respondido === 0}>
							<span class="serie-eje">{etiquetaDe(punto)}</span>
							<span class="serie-barra" aria-hidden="true">
								<span class="serie-propia" style="width: {(punto.tasa / masAlto) * 100}%"></span>
								{#if punto.conjunto !== null}
									<span class="serie-conjunto" style="left: {(punto.conjunto / masAlto) * 100}%"></span>
								{/if}
							</span>
							<span class="serie-cifra">
								{#if punto.respondido === 0}
									<span class="detalle">sin datos</span>
								{:else}
									{Math.round(punto.tasa * 100)}%
									<span class="de-cuantas">{punto.fallos} de {punto.respondido}</span>
								{/if}
							</span>
						</li>
					{/each}
				</ul>

				<div class="tarjeta-pie">
					<p class="detalle">
						La marca gris es cómo le fue a todo el checklist en ese mismo punto. Hace falta
						porque un criterio solo se mide con pocas respuestas en cada punto, y ahí una sola
						marca mueve el número varios puntos: lo que distingue un cambio real de un rebote
						es si se movió contra el conjunto o con él.
						{#if evo.eje === 'vuelta'}
							Y la vuelta mide la mesa, no a una persona: los roles rotan, así que quien opera
							en la tercera no es quien operó en la primera.
						{/if}
					</p>
				</div>
			{/if}
		</div>
	{/if}

	<div class="tarjeta">
		<div class="tarjeta-cabecera">
			<h2>Dónde los observadores no coinciden</h2>
			{#if data.concordancia.tasa !== null}
				<span class="detalle">
					{porcentaje(data.concordancia.tasa)} de {data.concordancia.comparaciones} comparaciones
				</span>
			{/if}
		</div>

		{#if data.concordancia.comparaciones === 0}
			<div class="vacio">
				Todavía no hubo ningún ciclo con dos observadores del mismo checklist, así que no hay nada
				que comparar.
			</div>
		{:else if data.concordancia.discrepancias.length === 0}
			<div class="vacio">
				En los criterios con al menos {data.concordancia.minimoPares} comparaciones, los observadores
				marcaron siempre lo mismo.
			</div>
		{:else}
			<p class="nota-panel">
				Cuando dos personas observaron el mismo ciclo con el mismo checklist, ¿marcaron igual?
				Donde no, el criterio se está leyendo de dos maneras: es el instrumento el que hay que
				revisar, no la práctica.
			</p>

			<div class="tabla-envoltorio">
				<table class="tabla criticos">
					<thead>
						<tr>
							<th>Criterio</th>
							<th class="numerica"><abbr title="Pares que marcaron distinto">Distinto</abbr></th>
							<th>Con qué frecuencia</th>
							<th class="numerica"><abbr title="Tasa de fallo del mismo criterio">Falla</abbr></th>
						</tr>
					</thead>
					<tbody>
						{#each data.concordancia.discrepancias as fila (fila.itemId)}
							<tr class:abierta={data.evolucion?.criterio.itemId === fila.itemId}>
								<td class="principal">
									<a class="criterio-enlace" href={conCriterio(fila.itemId)}>
										<span class="criterio-texto">{fila.criterio}</span>
									</a>
									<span class="detalle">{fila.rol}</span>
								</td>
								<td class="numerica">
									<span class="de-cuantas">{fila.discrepan} de {fila.pares}</span>
								</td>
								<td class="barra-celda">
									<span class="barra-fallo discrepa" aria-hidden="true">
										<span style="width: {fila.tasa * 100}%"></span>
									</span>
									<span class="barra-cifra">{porcentaje(fila.tasa)}</span>
								</td>
								<td class="numerica">
									{fila.fallo === null ? '—' : porcentaje(fila.fallo)}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<div class="tarjeta-pie">
				<p class="detalle">
					La última columna es cuánto falla ese mismo criterio. Los dos números altos juntos
					suelen querer decir que está mal redactado; sólo el de fallo, que es algo que de
					verdad cuesta. Entran los criterios con al menos {data.concordancia.minimoPares} comparaciones,
					y la coincidencia no se corrige por azar: en un criterio que casi siempre se cumple,
					coincidir es fácil. Eso infla la coincidencia, nunca la discrepancia — lo que aparece
					acá arriba es real.
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
