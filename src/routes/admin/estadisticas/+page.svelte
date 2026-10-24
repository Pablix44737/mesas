<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { goto, replaceState } from '$app/navigation';
	import Icono from '$lib/Icono.svelte';

	let { data } = $props();

	type Vista = 'fallos' | 'observadores' | 'practica';
	type Lectura = 'redaccion' | 'distinto' | 'cuesta';

	const VISTAS: { id: Vista; nombre: string; corto: string; icono: string }[] = [
		{ id: 'fallos', nombre: 'Lo que más falla', corto: 'Qué falla', icono: 'resultado' },
		{ id: 'observadores', nombre: 'Observadores', corto: 'Observadores', icono: 'observador' },
		{ id: 'practica', nombre: 'Práctica por escenario', corto: 'Práctica', icono: 'reabrir' }
	];

	/** El modelo pide al menos tres prácticas de cada técnica. */
	const PRACTICAS_MINIMAS = 3;

	/**
	 * Desde cuánto un criterio «falla mucho» y desde cuánto «se lee distinto», para
	 * ubicarlo en uno de los cuatro cuadrantes. Son una guía para mirar, no un
	 * diagnóstico: el punto exacto de cada criterio sigue a la vista en el mapa.
	 */
	const FALLA_ALTA = 0.3;
	const DIFIEREN_ALTO = 0.25;
	/** El eje del fallo del mapa llega hasta acá: ningún criterio falla más del 70%. */
	const FALLA_MAXIMA = 0.7;

	const LECTURAS: Record<Lectura, string> = {
		redaccion: 'Revisar la redacción',
		distinto: 'Se lee distinto',
		cuesta: 'Cuesta de verdad'
	};

	const lecturaDe = (falla: number | null, pares: number, discrepan: number): Lectura | null => {
		if (falla === null || pares < data.concordancia.minimoPares) return null;
		if (discrepan / pares >= DIFIEREN_ALTO) return falla >= FALLA_ALTA ? 'redaccion' : 'distinto';
		return falla >= FALLA_ALTA ? 'cuesta' : null;
	};

	const leerVista = (url: URL): Vista => {
		const pedida = url.searchParams.get('vista');
		return VISTAS.some((v) => v.id === pedida) ? (pedida as Vista) : 'fallos';
	};
	let vista = $state<Vista>(untrack(() => leerVista(page.url)));

	const porcentaje = (n: number) => `${Math.round(n * 100)}%`;
	const cifra = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 1 });
	const cuantos = (n: number, singular: string, plural: string) =>
		`${cifra(n)} ${n === 1 ? singular : plural}`;

	/** La dirección de esta misma pantalla con algo cambiado: se puede compartir tal cual. */
	function enlace(cambios: {
		escenario?: string | null;
		criterio?: string | null;
		eje?: 'vuelta' | 'fecha';
		vista?: Vista;
	}) {
		const escenario = 'escenario' in cambios ? cambios.escenario : data.escenarioElegido;
		const criterio = 'criterio' in cambios ? cambios.criterio : (data.evolucion?.criterio.itemId ?? null);
		const eje = cambios.eje ?? data.evolucion?.eje ?? 'vuelta';
		const cual = cambios.vista ?? vista;
		const parametros = new URLSearchParams();
		if (escenario) parametros.set('escenario', escenario);
		if (cual !== 'fallos') parametros.set('vista', cual);
		if (criterio) {
			parametros.set('criterio', criterio);
			if (eje === 'fecha') parametros.set('eje', 'fecha');
		}
		const cola = parametros.toString();
		return cola ? `?${cola}` : page.url.pathname;
	}

	function elegirVista(evento: MouseEvent, cual: Vista) {
		evento.preventDefault();
		vista = cual;
		// Cambiar de pestaña no pide nada nuevo: sólo queda anotado en la dirección.
		replaceState(enlace({ vista: cual }), {});
	}

	/* --- qué mirar --- */

	let selector = $state<HTMLDetailsElement>();
	const practicaDe = (id: string) => data.practicas.find((p) => p.id === id);
	const totalEvaluaciones = $derived(data.practicas.reduce((t, p) => t + p.evaluaciones, 0));
	const nombreElegido = $derived(
		data.escenarios.find((e) => e.id === data.escenarioElegido)?.nombre ?? 'Todos los escenarios'
	);

	let copiado = $state(false);
	let temporizador: ReturnType<typeof setTimeout> | undefined;
	async function copiarEnlace() {
		try {
			await navigator.clipboard.writeText(location.href);
		} catch {
			return;
		}
		copiado = true;
		clearTimeout(temporizador);
		temporizador = setTimeout(() => (copiado = false), 1800);
	}

	/* --- observadores: el mapa --- */

	const puestos = $derived(new Map(data.concordancia.discrepancias.map((d, i) => [d.itemId, i + 1])));
	const puntosDelMapa = $derived(
		data.concordancia.mapa
			.map((p) => ({
				...p,
				puesto: puestos.get(p.itemId) ?? null,
				x: Math.min(1, (p.falla ?? 0) / FALLA_MAXIMA) * 100,
				y: Math.min(1, p.difieren) * 100
			}))
			// Los numerados, encima de los demás.
			.sort((a, b) => (a.puesto ? 1 : 0) - (b.puesto ? 1 : 0) || (b.puesto ?? 0) - (a.puesto ?? 0))
	);

	/* --- práctica --- */

	const escenariosCortos = $derived(
		data.practicas.filter((p) => p.ciclos < PRACTICAS_MINIMAS).length
	);
	const practicas = $derived(
		[...data.practicas].sort(
			(a, b) =>
				Number(b.ciclos < PRACTICAS_MINIMAS) - Number(a.ciclos < PRACTICAS_MINIMAS) ||
				b.ciclos - a.ciclos
		)
	);
	const escalaDePractica = $derived(Math.max(10, ...data.practicas.map((p) => p.ciclos)));

	/* --- cómo viene cambiando un criterio --- */

	const fecha = (iso: string) => {
		const [, m, d] = iso.split('-');
		return `${d}/${m}`;
	};
	const evolucion = $derived.by(() => {
		const evo = data.evolucion;
		if (!evo) return null;
		const porVuelta = evo.eje === 'vuelta';
		const n = evo.puntos.length;
		const xEn = (i: number) => (n === 1 ? 50 : 4 + (i * 92) / (n - 1));
		const puntos = evo.puntos.map((p, i) => ({
			...p,
			x: xEn(i),
			nombre: porVuelta ? `Vuelta ${p.etiqueta}` : fecha(p.etiqueta),
			corto: porVuelta ? `V${p.etiqueta}` : fecha(p.etiqueta)
		}));
		// Una línea por tramo: donde un punto no tiene datos, la línea se corta.
		const trazo = (valor: (p: (typeof puntos)[number]) => number | null) => {
			let d = '';
			let sigue = false;
			for (const p of puntos) {
				const v = valor(p);
				if (v === null) {
					sigue = false;
					continue;
				}
				d += `${sigue ? 'L' : 'M'}${p.x.toFixed(2)} ${(100 - v * 100).toFixed(2)} `;
				sigue = true;
			}
			return d.trim();
		};
		const validos = puntos.filter((p) => p.respondido > 0);
		const comparable = validos.length >= 2;

		/**
		 * Una lectura en palabras, entre el primer punto y el último con datos. El
		 * criterio se compara contra su checklist: si se movieron juntos, no es el
		 * criterio. Los márgenes son anchos a propósito, porque una sola marca mueve
		 * mucho a un criterio solo.
		 */
		let lectura: { texto: string; tono: 'bien' | 'atencion' | 'neutro' } | null = null;
		if (comparable) {
			const primero = validos[0];
			const ultimo = validos[validos.length - 1];
			const propio = Math.round((ultimo.tasa - primero.tasa) * 100);
			const conjunto = Math.round(((ultimo.conjunto ?? 0) - (primero.conjunto ?? 0)) * 100);
			if (propio <= -12 && conjunto > -6) {
				lectura = { texto: `Bajó ${-propio} puntos mientras el checklist casi no cambió: el cambio es de este criterio.`, tono: 'bien' };
			} else if (propio <= -12) {
				lectura = { texto: `Bajó ${-propio} puntos, junto con todo el checklist: se movió con el conjunto.`, tono: 'neutro' };
			} else if (propio < 12 && conjunto <= -6) {
				lectura = { texto: `El checklist mejoró ${-conjunto} puntos y este criterio no: sigue costando igual.`, tono: 'atencion' };
			} else if (propio >= 12 && conjunto < 6) {
				lectura = { texto: `Subió ${propio} puntos mientras el checklist no: conviene mirarlo.`, tono: 'atencion' };
			} else {
				lectura = { texto: 'Sin un cambio claro: se mueve dentro de lo que da una sola marca.', tono: 'neutro' };
			}
		}

		return {
			...evo,
			porVuelta,
			puntos,
			comparable,
			lectura,
			lineaPropia: trazo((p) => (p.respondido > 0 ? p.tasa : null)),
			lineaConjunto: trazo((p) => p.conjunto)
		};
	});

	function cerrarEvolucion() {
		goto(enlace({ criterio: null }), { noScroll: true });
	}

	function teclas(evento: KeyboardEvent) {
		if (evento.key !== 'Escape') return;
		if (selector?.open) selector.open = false;
		else if (data.evolucion) cerrarEvolucion();
	}
</script>

<svelte:head>
	<title>Estadísticas — SIMUNaM</title>
</svelte:head>

<svelte:window onkeydown={teclas} />

{#snippet fila(item: { criterio: string; rol: string }, puesto: number, lectura: Lectura | null, donde: string | null)}
	<span class="estadisticas-puesto">{puesto}</span>
	<span class="estadisticas-criterio">
		<strong>{item.criterio}</strong>
		<span class="estadisticas-detalle">
			<span>{item.rol}</span>
			{#if donde}<span class="estadisticas-separador">{donde}</span>{/if}
			{#if lectura}
				<span class="estadisticas-lectura {lectura}">{LECTURAS[lectura]}</span>
			{/if}
		</span>
	</span>
{/snippet}

<div class="admin-encabezado">
	<div class="admin-encabezado-dentro estadisticas-encabezado">
		<div class="admin-titulo">
			<div><h1>Estadísticas</h1></div>
			<p>Qué les cuesta a los estudiantes, según los checklists que enviaron los observadores.</p>
		</div>

		{#if data.escenarios.length > 0}
			<div class="estadisticas-alcance">
				<!-- Un desplegable nativo: abre y elige aunque no haya JavaScript, y cada
				     opción es un enlace, así lo elegido queda en la dirección. -->
				<details bind:this={selector}>
					<summary>
						<span>
							<span>Qué mirar</span>
							<strong>{nombreElegido}</strong>
						</span>
						<Icono nombre="abajo" tamano={20} />
					</summary>
					<button
						class="estadisticas-velo"
						type="button"
						aria-label="Cerrar"
						onclick={() => selector && (selector.open = false)}
					></button>
					<div class="estadisticas-opciones" role="list">
						<span class="admin-asa" aria-hidden="true"></span>
						<h2>Qué mirar</h2>
						<a
							href={enlace({ escenario: null, criterio: null })}
							aria-current={!data.escenarioElegido ? 'true' : undefined}
							onclick={() => selector && (selector.open = false)}
						>
							<span>
								<strong>Todos los escenarios</strong>
								<span>
									{cuantos(totalEvaluaciones, 'evaluación', 'evaluaciones')} · {cuantos(data.escenarios.length, 'escenario', 'escenarios')}
								</span>
							</span>
							{#if !data.escenarioElegido}<Icono nombre="tilde" tamano={18} />{/if}
						</a>
						{#each data.escenarios as escenario (escenario.id)}
							{@const practica = practicaDe(escenario.id)}
							<a
								href={enlace({ escenario: escenario.id, criterio: null })}
								aria-current={data.escenarioElegido === escenario.id ? 'true' : undefined}
								onclick={() => selector && (selector.open = false)}
							>
								<span>
									<strong>{escenario.nombre}</strong>
									{#if practica}
										<span>
											{cuantos(practica.evaluaciones, 'evaluación', 'evaluaciones')} · {cuantos(practica.ciclos, 'ciclo', 'ciclos')}
										</span>
									{/if}
								</span>
								{#if data.escenarioElegido === escenario.id}<Icono nombre="tilde" tamano={18} />{/if}
							</a>
						{/each}
					</div>
				</details>
				<button
					class="estadisticas-copiar"
					class:copiado
					type="button"
					aria-label="Copiar el enlace a lo que estás mirando"
					title="Copiar el enlace"
					onclick={copiarEnlace}
				>
					<Icono nombre={copiado ? 'tilde' : 'enlace'} tamano={20} />
					{#if copiado}<span>Enlace copiado</span>{/if}
				</button>
			</div>
		{/if}
	</div>
</div>

<div class="admin-cuerpo">
	{#if data.escenarios.length === 0}
		<section class="mesa-tarjeta admin-vacio">
			<span class="evaluado-vacio-icono"><Icono nombre="resultado" tamano={24} /></span>
			<strong>Todavía no hay evaluaciones enviadas.</strong>
			<p>Cuando las mesas empiecen a enviar sus checklists, acá vas a ver qué es lo que más les cuesta a los estudiantes.</p>
		</section>
	{:else}
		<section class="mesa-tarjeta estadisticas-resumen" aria-label="Cuánto hay detrás">
			<div>
				<span class="estadisticas-rotulo">Ciclos</span>
				<strong>{cifra(data.alcance.ciclos)}</strong>
				<span>
					{data.escenarioElegido
						? 'de este escenario'
						: `en ${cuantos(data.alcance.escenarios, 'escenario', 'escenarios')}`}
				</span>
			</div>
			<div>
				<span class="estadisticas-rotulo">Evaluaciones</span>
				<strong>{cifra(data.alcance.evaluaciones)}</strong>
				<span>checklists enviados</span>
			</div>
			<div>
				<span class="estadisticas-rotulo">Respuestas</span>
				<strong>{cifra(data.alcance.respondidas)}</strong>
				<span>{cuantos(data.alcance.criterios, 'criterio distinto', 'criterios distintos')}</span>
			</div>
			<div>
				<span class="estadisticas-rotulo">Se cumplió</span>
				<strong>
					{data.alcance.cumplimiento === null ? '—' : porcentaje(data.alcance.cumplimiento)}
				</strong>
				<span class="estadisticas-cumplimiento" aria-hidden="true">
					<span style="width: {(data.alcance.cumplimiento ?? 0) * 100}%"></span>
				</span>
				<span>{cuantos(data.alcance.fallidas, 'vez «No hizo»', 'veces «No hizo»')}</span>
			</div>
		</section>
		<p class="estadisticas-nota">
			<Icono nombre="info" tamano={16} />
			<span>Solo cuentan los checklists enviados. Uno que quedó a medio marcar no suma fallos.</span>
		</p>

		<nav class="estadisticas-vistas" aria-label="Qué querés responder">
			{#each VISTAS as opcion (opcion.id)}
				<a
					href={enlace({ vista: opcion.id })}
					aria-current={vista === opcion.id ? 'page' : undefined}
					onclick={(evento) => elegirVista(evento, opcion.id)}
				>
					<Icono nombre={opcion.icono} tamano={18} />
					<span class="solo-ancho">{opcion.nombre}</span>
					<span class="solo-angosto">{opcion.corto}</span>
				</a>
			{/each}
		</nav>

		{#if vista === 'fallos'}
			<section class="mesa-tarjeta estadisticas-seccion" aria-labelledby="fallos-titulo">
				<div class="estadisticas-seccion-cabecera">
					<h2 id="fallos-titulo">¿Qué les cuesta más?</h2>
					<div class="estadisticas-claves">
						<span><Icono nombre="abajo" tamano={16} />Ordenado por cuán seguido falla</span>
						<span>
							<Icono nombre="info" tamano={16} />
							{data.sinSuficiente > 0
								? `Solo con ${data.minimo} respuestas o más: ${data.sinSuficiente === 1 ? 'quedó afuera 1 criterio' : `quedaron afuera ${data.sinSuficiente} criterios`}`
								: `Solo criterios con ${data.minimo} respuestas o más`}
						</span>
					</div>
				</div>

				{#if data.puntosCriticos.length === 0}
					<div class="estadisticas-vacio">
						<span class="evaluado-vacio-icono gris"><Icono nombre="resultado" tamano={24} /></span>
						<strong>Todavía no hay ranking.</strong>
						<p>
							Ningún criterio llegó a {data.minimo} respuestas. Con menos, un solo fallo da un porcentaje
							alto que no dice nada.
						</p>
					</div>
				{:else}
					<div class="estadisticas-columnas fallos" aria-hidden="true">
						<span></span><span>Criterio</span><span>Falló</span><span>Puntos perdidos</span><span></span>
					</div>
					<ol class="estadisticas-lista">
						{#each data.puntosCriticos as punto, i (punto.itemId)}
							{@const lectura = lecturaDe(punto.tasa, punto.pares, punto.discrepan)}
							<li>
								<a
									class="estadisticas-fila fallos"
									class:abierta={data.evolucion?.criterio.itemId === punto.itemId}
									href={enlace({ criterio: punto.itemId })}
									data-sveltekit-noscroll
								>
									{@render fila(
										punto,
										i + 1,
										lectura === 'redaccion' || lectura === 'distinto' ? lectura : null,
										// Con «todos», un criterio común se distingue de uno de una sola técnica.
										data.escenarioElegido
											? null
											: punto.enEscenarios > 1
												? `En ${punto.enEscenarios} escenarios`
												: 'En 1 escenario'
									)}
									<span class="estadisticas-medida">
										<span><strong>{porcentaje(punto.tasa)}</strong> {punto.fallos} de {punto.respondido}</span>
										<span class="estadisticas-barra" aria-hidden="true">
											<span style="width: {punto.tasa * 100}%"></span>
										</span>
									</span>
									<span class="estadisticas-puntos">
										<strong>{cifra(punto.puntos)}</strong>
										<span>{punto.puntos === 1 ? 'punto perdido' : 'puntos perdidos'}</span>
									</span>
									<Icono nombre="adelante" tamano={18} clase="admin-flecha" />
								</a>
							</li>
						{/each}
					</ol>
					<p class="estadisticas-pie">
						Los puntos perdidos son el peso del criterio por las veces que falló. No ordenan la lista:
						el peso se puede corregir después.
					</p>
				{/if}
			</section>
		{:else if vista === 'observadores'}
			<div class="estadisticas-observadores">
				<section class="mesa-tarjeta estadisticas-acuerdo" aria-labelledby="acuerdo-titulo">
					<h2 id="acuerdo-titulo">¿Los observadores marcan igual?</h2>
					{#if data.concordancia.tasa === null}
						<div class="estadisticas-vacio">
							<span class="evaluado-vacio-icono gris"><Icono nombre="observador" tamano={24} /></span>
							<strong>Todavía no hay con qué comparar.</strong>
							<p>No hubo ningún ciclo con dos observadores del mismo checklist.</p>
						</div>
					{:else}
						<div class="estadisticas-acuerdo-cifra">
							<strong>{porcentaje(data.concordancia.tasa)}</strong>
							<span>de {cuantos(data.concordancia.comparaciones, 'comparación fue distinta', 'comparaciones fueron distintas')}</span>
						</div>
						<p class="estadisticas-ayuda">
							Una comparación son dos observadores que miraron el mismo ciclo con el mismo checklist,
							criterio por criterio.
						</p>

						{#if puntosDelMapa.length > 0}
							<div class="estadisticas-mapa" role="img" aria-label="Cada criterio según cuánto falla y cuánto difieren los observadores">
								<div class="estadisticas-mapa-area" style="--corte-x: {(FALLA_ALTA / FALLA_MAXIMA) * 100}%; --corte-y: {DIFIEREN_ALTO * 100}%">
									<span class="cuadrante distinto">Se lee distinto</span>
									<span class="cuadrante redaccion">Revisar la redacción</span>
									<span class="cuadrante bien">Sin problemas</span>
									<span class="cuadrante cuesta">Cuesta de verdad</span>
									{#each puntosDelMapa as punto (punto.itemId)}
										<a
											class="estadisticas-punto"
											class:numerado={punto.puesto}
											style="left: {punto.x}%; bottom: {punto.y}%"
											href={enlace({ criterio: punto.itemId })}
											data-sveltekit-noscroll
											title="{punto.criterio} · falla {porcentaje(punto.falla ?? 0)} · difieren {porcentaje(punto.difieren)}"
											aria-label="{punto.criterio}: falla {porcentaje(punto.falla ?? 0)}, difieren {porcentaje(punto.difieren)}"
										>
											{punto.puesto ?? ''}
										</a>
									{/each}
								</div>
								<span class="estadisticas-eje y-max">100%</span>
								<span class="estadisticas-eje y-corte" style="bottom: calc(30px + (100% - 36px) * {DIFIEREN_ALTO})">{porcentaje(DIFIEREN_ALTO)}</span>
								<span class="estadisticas-eje y-cero">0%</span>
								<span class="estadisticas-eje x-cero">0%</span>
								<span class="estadisticas-eje x-corte" style="left: calc(34px + (100% - 40px) * {FALLA_ALTA / FALLA_MAXIMA})">{porcentaje(FALLA_ALTA)}</span>
								<span class="estadisticas-eje x-max">{porcentaje(FALLA_MAXIMA)}</span>
								<span class="estadisticas-titulo-eje x">Cuánto falla →</span>
								<span class="estadisticas-titulo-eje y">Cuánto difieren →</span>
							</div>
						{/if}
						<p class="estadisticas-nota">
							<Icono nombre="info" tamano={16} />
							<span>
								El desacuerdo que ves es real. En un criterio que casi siempre se cumple es fácil
								coincidir, así que la coincidencia puede verse más alta de lo que es.
							</span>
						</p>
					{/if}
				</section>

				{#if data.concordancia.tasa !== null}
					<section class="mesa-tarjeta estadisticas-seccion" aria-labelledby="difieren-titulo">
						<div class="estadisticas-seccion-cabecera">
							<h2 id="difieren-titulo">Donde más difieren</h2>
							<p>Criterios con {data.concordancia.minimoPares} comparaciones o más y alguna diferencia.</p>
						</div>
						{#if data.concordancia.discrepancias.length === 0}
							<div class="estadisticas-vacio">
								<span class="evaluado-vacio-icono"><Icono nombre="tilde" tamano={24} /></span>
								<strong>Siempre marcaron lo mismo.</strong>
								<p>
									En los criterios con al menos {data.concordancia.minimoPares} comparaciones, los observadores
									coincidieron todas las veces.
								</p>
							</div>
						{:else}
							<div class="estadisticas-columnas difieren" aria-hidden="true">
								<span></span><span>Criterio</span><span>Marcaron distinto</span><span>Falla</span>
							</div>
							<ol class="estadisticas-lista">
								{#each data.concordancia.discrepancias as item, i (item.itemId)}
									<li>
										<a
											class="estadisticas-fila difieren"
											class:abierta={data.evolucion?.criterio.itemId === item.itemId}
											href={enlace({ criterio: item.itemId })}
											data-sveltekit-noscroll
										>
											{@render fila(item, i + 1, lecturaDe(item.fallo, item.pares, item.discrepan), null)}
											<span class="estadisticas-medida discrepa">
												<span class="solo-angosto estadisticas-rotulo">Marcaron distinto</span>
												<span><strong>{porcentaje(item.tasa)}</strong> {item.discrepan} de {item.pares}</span>
												<span class="estadisticas-barra" aria-hidden="true">
													<span style="width: {item.tasa * 100}%"></span>
												</span>
											</span>
											<span class="estadisticas-puntos">
												<span class="solo-angosto estadisticas-rotulo">Falla</span>
												<strong>{item.fallo === null ? '—' : porcentaje(item.fallo)}</strong>
											</span>
										</a>
									</li>
								{/each}
							</ol>
						{/if}
					</section>
				{/if}
			</div>
		{:else}
			<section class="mesa-tarjeta estadisticas-seccion" aria-labelledby="practica-titulo">
				<div class="estadisticas-seccion-cabecera">
					<h2 id="practica-titulo">¿Se practicó lo suficiente?</h2>
					<p>Cada técnica pide al menos {PRACTICAS_MINIMAS} ciclos. La marca muestra dónde está ese mínimo.</p>
					{#if escenariosCortos > 0}
						<p class="admin-advertencia">
							<Icono nombre="alerta" />
							<span>
								{escenariosCortos === 1
									? `1 escenario no llegó a ${PRACTICAS_MINIMAS} ciclos.`
									: `${escenariosCortos} escenarios no llegaron a ${PRACTICAS_MINIMAS} ciclos.`}
							</span>
						</p>
					{/if}
				</div>
				<ul class="estadisticas-lista">
					{#each practicas as practica (practica.id)}
						{@const corto = practica.ciclos < PRACTICAS_MINIMAS}
						<li class="estadisticas-practica" class:elegido={practica.id === data.escenarioElegido}>
							<span class="estadisticas-practica-nombre">
								<strong>{practica.nombre}</strong>
								{#if corto}
									<span class="estadisticas-falta">
										{PRACTICAS_MINIMAS - practica.ciclos === 1
											? 'Le falta 1 ciclo'
											: `Le faltan ${PRACTICAS_MINIMAS - practica.ciclos} ciclos`}
									</span>
								{/if}
							</span>
							<span class="estadisticas-practica-barra" aria-hidden="true">
								<span class="barra">
									<span
										class:corto
										class:sin-evaluar={practica.evaluaciones === 0}
										style="width: {(practica.ciclos / escalaDePractica) * 100}%"
									></span>
								</span>
								<span class="minimo" style="left: calc({(PRACTICAS_MINIMAS / escalaDePractica) * 100}% - 1px)"></span>
							</span>
							<span class="estadisticas-practica-cifras">
								<strong>{cuantos(practica.ciclos, 'ciclo', 'ciclos')}</strong>
								{#if practica.evaluaciones === 0}
									<span class="checklist-estado">Sin evaluar</span>
								{:else}
									<span>{cuantos(practica.evaluaciones, 'evaluación', 'evaluaciones')}</span>
								{/if}
							</span>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	{/if}
</div>

{#if evolucion}
	<button class="admin-velo estadisticas-velo-panel" type="button" aria-label="Cerrar" onclick={cerrarEvolucion}></button>
	<div class="admin-panel estadisticas-evolucion" role="dialog" aria-modal="true" aria-labelledby="evolucion-titulo">
		<span class="admin-asa" aria-hidden="true"></span>
		<div class="admin-panel-cabecera">
			<div>
				<span class="estadisticas-rotulo">Cómo viene cambiando</span>
				<h2 id="evolucion-titulo">{evolucion.criterio.texto}</h2>
				<p>{evolucion.criterio.rol} · {evolucion.criterio.checklist}</p>
			</div>
			<button class="admin-cerrar" type="button" aria-label="Copiar el enlace a este criterio" title={copiado ? 'Enlace copiado' : 'Copiar el enlace'} onclick={copiarEnlace}>
				<Icono nombre={copiado ? 'tilde' : 'enlace'} tamano={20} />
			</button>
			<a class="admin-cerrar" href={enlace({ criterio: null })} aria-label="Cerrar" data-sveltekit-noscroll>
				<Icono nombre="cerrar" tamano={20} />
			</a>
		</div>

		<div class="admin-panel-cuerpo">
			<nav class="estadisticas-vistas" aria-label="Cómo mirarlo">
				<a
					href={enlace({ eje: 'vuelta' })}
					aria-current={evolucion.porVuelta ? 'page' : undefined}
					data-sveltekit-noscroll
					data-sveltekit-replacestate
				>
					Por vuelta de la mesa
				</a>
				<a
					href={enlace({ eje: 'fecha' })}
					aria-current={!evolucion.porVuelta ? 'page' : undefined}
					data-sveltekit-noscroll
					data-sveltekit-replacestate
				>
					Por fecha
				</a>
			</nav>
			<p class="estadisticas-pregunta">
				{evolucion.porVuelta ? '¿Mejora a medida que la mesa practica?' : '¿Cambió después de una corrección?'}
			</p>

			{#if evolucion.comparable}
				<div class="estadisticas-leyenda">
					<span><span class="linea propia"></span>Este criterio</span>
					<span><span class="linea conjunto"></span>Todo su checklist</span>
				</div>
				<div class="estadisticas-grafico">
					<span class="estadisticas-eje g-cien">100%</span>
					<span class="estadisticas-eje g-medio">50%</span>
					<span class="estadisticas-eje g-cero">0%</span>
					<div class="estadisticas-grafico-area">
						<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
							<path class="conjunto" d={evolucion.lineaConjunto} />
							<path class="propia" d={evolucion.lineaPropia} />
						</svg>
						{#each evolucion.puntos as punto (punto.etiqueta)}
							{#if punto.conjunto !== null}
								<span class="estadisticas-marca conjunto" style="left: {punto.x}%; top: {100 - punto.conjunto * 100}%"></span>
							{/if}
							{#if punto.respondido > 0}
								<span class="estadisticas-marca propia" style="left: {punto.x}%; top: {100 - punto.tasa * 100}%"></span>
								<span class="estadisticas-valor" style="left: {punto.x}%; top: calc({100 - punto.tasa * 100}% - 26px)">
									{porcentaje(punto.tasa)}
								</span>
							{:else}
								<span class="estadisticas-marca vacia" style="left: {punto.x}%"></span>
								<span class="estadisticas-valor vacio" style="left: {punto.x}%">sin datos</span>
							{/if}
						{/each}
					</div>
					{#each evolucion.puntos as punto (punto.etiqueta)}
						<span class="estadisticas-eje x-punto" style="left: calc(40px + (100% - 56px) * {punto.x / 100})">{punto.corto}</span>
					{/each}
				</div>
				{#if evolucion.lectura}
					<p class="estadisticas-interpretacion {evolucion.lectura.tono}">
						<Icono
							nombre={evolucion.lectura.tono === 'bien' ? 'tilde' : evolucion.lectura.tono === 'atencion' ? 'alerta' : 'resultado'}
							tamano={18}
						/>
						<span>{evolucion.lectura.texto}</span>
					</p>
				{/if}
			{:else}
				<div class="estadisticas-sin-comparacion">
					<span class="evaluado-vacio-icono gris"><Icono nombre="reloj" tamano={24} /></span>
					{#if !evolucion.porVuelta}
						<strong>
							{evolucion.puntos.length === 1
								? `Todo se envió el mismo día: el ${evolucion.puntos[0].nombre}.`
								: 'Este criterio se respondió un solo día.'}
						</strong>
						<p>Por fecha no hay con qué comparar. Mirá por vuelta para ver si la práctica repetida mejora.</p>
						<a class="boton secundario" href={enlace({ eje: 'vuelta' })} data-sveltekit-noscroll data-sveltekit-replacestate>Ver por vuelta</a>
					{:else}
						<strong>Se evaluó en una sola vuelta.</strong>
						<p>Por vuelta no hay con qué comparar. Probá por fecha.</p>
						<a class="boton secundario" href={enlace({ eje: 'fecha' })} data-sveltekit-noscroll data-sveltekit-replacestate>Ver por fecha</a>
					{/if}
				</div>
			{/if}

			<div class="estadisticas-tabla">
				<div class="encabezado">
					<span>{evolucion.porVuelta ? 'Vuelta' : 'Fecha'}</span><span>Falló</span><span>%</span><span>Checklist</span>
				</div>
				{#each evolucion.puntos as punto (punto.etiqueta)}
					<div>
						<span><strong class="solo-ancho">{punto.nombre}</strong><strong class="solo-angosto">{punto.corto}</strong></span>
						<span class:sin-datos={punto.respondido === 0}>
							{punto.respondido === 0 ? 'sin datos' : `${punto.fallos} de ${punto.respondido}`}
						</span>
						<span class="cifra">{punto.respondido === 0 ? '—' : porcentaje(punto.tasa)}</span>
						<span>{punto.conjunto === null ? '—' : porcentaje(punto.conjunto)}</span>
					</div>
				{/each}
			</div>

			<div class="estadisticas-notas">
				{#if evolucion.porVuelta}
					<p class="estadisticas-nota">
						<Icono nombre="info" tamano={16} />
						<span>Mide a la mesa, no a una persona: los roles rotan de una vuelta a la otra.</span>
					</p>
				{/if}
				<p class="estadisticas-nota">
					<Icono nombre="info" tamano={16} />
					<span>
						Cada punto tiene pocas respuestas y una sola marca lo mueve mucho. Compará con la línea del
						checklist: si se movieron juntos, no es el criterio.
					</span>
				</p>
			</div>
		</div>
	</div>
{/if}
