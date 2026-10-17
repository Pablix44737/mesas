<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import Icono from '$lib/Icono.svelte';
	import { dniValido, normalizarDni } from '$lib/dni';

	let { data, form } = $props();

	let buscando = $state(false);
	let dni = $state(untrack(() => form?.dni ?? ''));
	/** El DNI que no pasó la validación antes de mandarlo. */
	let dniInvalido = $state(false);
	/** Se escribió otro DNI después de buscar: el error anterior ya no aplica. */
	let corregido = $state(false);

	const errorDelDni = $derived(
		dniInvalido
			? 'Ingresá tu DNI, sin puntos.'
			: form?.campo === 'dni' && !corregido
				? form.mensaje
				: null
	);
	const errorGeneral = $derived(form?.mensaje && form.campo !== 'dni' && !corregido ? form.mensaje : null);

	/** La evaluación elegida en el resumen: queda marcada en las dos partes. */
	const elegida = $derived(page.url.hash.startsWith('#p-') ? page.url.hash.slice(3) : null);

	/** Lo que muestra cada tarjeta: sus «No hizo», o la lista entera. */
	let completas = $state<Record<string, boolean>>({});
	/** Los ciclos con la comparación abierta. */
	let comparando = $state<Record<number, boolean>>({});

	const ciclos = $derived(
		(form?.corridas ?? []).map((corrida) => {
			const evaluaciones = corrida.evaluaciones.map((evaluacion) => ({
				...evaluacion,
				// Numerados por posición: el orden guardado puede tener saltos.
				items: evaluacion.items.map((item, i) => ({ ...item, numero: i + 1 })),
				noHizo: evaluacion.items.filter((item) => !item.cumplido).length
			}));

			// Quienes evaluaron con la misma lista se pueden poner lado a lado: suelen
			// ser los observadores de la técnica y el facilitador.
			const porLista = new Map<string, typeof evaluaciones>();
			for (const evaluacion of evaluaciones) {
				porLista.set(evaluacion.checklist, [...(porLista.get(evaluacion.checklist) ?? []), evaluacion]);
			}
			const comparables = [...porLista.values()].filter((grupo) => grupo.length > 1);

			return { ...corrida, evaluaciones, comparables };
		})
	);

	const cifra = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });

	const fecha = (valor: string | null) =>
		valor
			? new Date(valor).toLocaleString('es-AR', {
					dateStyle: 'short',
					timeStyle: 'short',
					hour12: false
				})
			: '';

	/** «Valentina D.»: lo que entra en la cabecera de una columna angosta. */
	const corto = (nombre: string | null) => {
		if (!nombre) return 'Sin nombre';
		const [primero, ...resto] = nombre.split(' ');
		const ultimo = resto.at(-1);
		return ultimo ? `${primero} ${ultimo[0]}.` : primero;
	};

	function escribirDni(evento: Event & { currentTarget: HTMLInputElement }) {
		dni = normalizarDni(evento.currentTarget.value);
		evento.currentTarget.value = dni;
		dniInvalido = false;
		corregido = true;
	}
</script>

<svelte:head>
	<title>Tu ciclo — Mesa {data.mesa.numero}</title>
</svelte:head>

<div class="consulta-pagina">
	<header class="mesa-cabecera">
		<div class="mesa-cabecera-dentro consulta-ancho">
			<div class="mesa-navegacion">
				<a class="mesa-volver" href="/m/{data.curso}/{data.mesa.numero}">
					<Icono nombre="atras" />
					Mesa {data.mesa.numero}
				</a>
			</div>
			<div class="consulta-titulo">
				<p>Mesa {data.mesa.numero}{data.mesa.escenario ? ` · ${data.mesa.escenario}` : ''}</p>
				<h1>Lo registrado sobre tu ciclo</h1>
				<p>Identificate con tu DNI para ver cómo te evaluaron.</p>
			</div>
		</div>
	</header>

	<main class="entrar-cuerpo consulta-ancho">
		<section class="mesa-tarjeta consulta-dni">
			<form
				method="POST"
				novalidate
				use:enhance={({ cancel }) => {
					if (!dniValido(dni)) {
						dniInvalido = true;
						cancel();
						document.getElementById('dni')?.focus();
						return;
					}
					buscando = true;
					return async ({ update }) => {
						await update({ reset: false });
						buscando = false;
						corregido = false;
						completas = {};
						comparando = {};
					};
				}}
			>
				<label for="dni">Tu DNI</label>
				<div class="consulta-dni-fila">
					<input
						id="dni"
						name="dni"
						type="text"
						inputmode="numeric"
						autocomplete="off"
						enterkeyhint="search"
						placeholder="Ej.: 35111222"
						value={dni}
						oninput={escribirDni}
						aria-invalid={Boolean(errorDelDni)}
						aria-describedby={errorDelDni ? 'dni-error' : undefined}
					/>
					<button
						class="boton bloque"
						class:enviar={!form?.corridas}
						class:secundario={Boolean(form?.corridas)}
						type="submit"
						disabled={buscando}
					>
						{buscando ? 'Buscando…' : form?.corridas ? 'Buscar otro DNI' : 'Ver mi ciclo'}
					</button>
				</div>
				{#if errorDelDni}
					<p class="campo-error" id="dni-error"><Icono nombre="error" tamano={16} />{errorDelDni}</p>
				{/if}
				{#if errorGeneral}
					<p class="dialogo-error" role="alert">
						<Icono nombre="error" tamano={18} />
						<span>{errorGeneral}</span>
					</p>
				{/if}
				{#if form?.corridas && form.nombre}
					<p class="consulta-identificado">Te identificamos como <strong>{form.nombre}</strong>.</p>
				{/if}
			</form>
		</section>

		{#each ciclos as ciclo (ciclo.numero)}
			<section class="consulta-ciclo" aria-labelledby="ciclo-{ciclo.numero}">
				<div class="consulta-ciclo-cabecera">
					<h2 id="ciclo-{ciclo.numero}">Ciclo {ciclo.numero}</h2>
					<span>Fuiste {ciclo.rol}</span>
					{#if ciclo.enCurso}
						<span class="estado-mesa en-curso">
							<span class="punto" aria-hidden="true"></span>
							En curso
						</span>
					{/if}
				</div>

				{#if ciclo.enCurso}
					<p class="cotejo-barra-aviso">
						<Icono nombre="reloj" tamano={18} />
						<span>Puede que todavía falten checklists por enviar.</span>
					</p>
				{/if}

				{#if ciclo.evaluaciones.length === 0}
					<p class="consulta-vacio">Todavía no hay checklists enviados sobre este ciclo.</p>
				{:else}
					<!-- El vistazo: una fila por checklist, que lleva a su tarjeta. -->
					<div class="mesa-tarjeta evaluado-resumen consulta-resumen">
						<ul>
							{#each ciclo.evaluaciones as evaluacion (evaluacion.instanciaId)}
								<li>
									<a
										href="#p-{evaluacion.participacionId}"
										class:elegida={elegida === evaluacion.participacionId}
									>
										<span class="resumen-fila">
											<span class="resumen-quien">
												<span class="nombre">{evaluacion.rol}</span>
												<span class="detalle">
													{evaluacion.observador ?? 'Sin identificar en el padrón'}
												</span>
											</span>
											{#if evaluacion.noHizo > 0}
												<span class="cuenta-no-hizo" title="Ítems que no hiciste">
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
						{#each ciclo.comparables as grupo, i (grupo[0].instanciaId)}
							{@const clave = ciclo.numero * 100 + i}
							<button
								class="consulta-comparar-boton"
								type="button"
								aria-expanded={comparando[clave] ?? false}
								onclick={() => (comparando[clave] = !comparando[clave])}
							>
								<Icono nombre={comparando[clave] ? 'arriba' : 'abajo'} tamano={18} />
								{comparando[clave]
									? 'Ocultar la comparación'
									: ciclo.comparables.length === 1
										? `Comparar las ${grupo.length} evaluaciones`
										: `Comparar las ${grupo.length} evaluaciones de ${grupo[0].checklist}`}
							</button>
						{/each}
					</div>

					{#each ciclo.comparables as grupo, i (grupo[0].instanciaId)}
						{#if comparando[ciclo.numero * 100 + i]}
							<section class="mesa-tarjeta consulta-comparar">
								<div class="consulta-comparar-cabecera">
									<h3>{grupo[0].checklist}</h3>
									<p>
										{grupo
											.map(
												(evaluacion) =>
													`${evaluacion.observador ?? 'Sin nombre'} ${cifra(evaluacion.resultado)}/${cifra(evaluacion.maximo)}`
											)
											.join(' · ')}
									</p>
								</div>
								<div class="consulta-comparar-tabla" style="--columnas: {grupo.length}" role="table">
									<div class="consulta-comparar-fila encabezado" role="row">
										<span role="columnheader">Ítem</span>
										{#each grupo as evaluacion (evaluacion.instanciaId)}
											<span role="columnheader">{corto(evaluacion.observador)}</span>
										{/each}
									</div>
									{#each grupo[0].items as item, n (item.id)}
										{@const marcas = grupo.map((evaluacion) => evaluacion.items[n]?.cumplido ?? false)}
										<div
											class="consulta-comparar-fila"
											class:difiere={marcas.some((marca) => marca !== marcas[0])}
											role="row"
										>
											<span role="cell">
												<span class="orden">{item.numero}</span>
												<span>{item.texto}</span>
											</span>
											{#each marcas as hizo, columna (columna)}
												<span role="cell">
													<span class="consulta-comparar-marca" class:hizo>
														{hizo ? '✓' : '✗'}
														<span class="visualmente-oculto">{hizo ? 'Hizo' : 'No hizo'}</span>
													</span>
												</span>
											{/each}
										</div>
									{/each}
								</div>
							</section>
						{/if}
					{/each}

					<div class="evaluado-tarjetas">
						{#each ciclo.evaluaciones as evaluacion (evaluacion.instanciaId)}
							{@const completa = completas[evaluacion.instanciaId] ?? false}
							{@const visibles = completa
								? evaluacion.items
								: evaluacion.items.filter((item) => !item.cumplido)}
							<article
								class="mesa-tarjeta evaluacion"
								class:elegida={elegida === evaluacion.participacionId}
								id="p-{evaluacion.participacionId}"
							>
								<div class="evaluacion-cabecera">
									<div class="evaluacion-encabezado">
										<div class="evaluacion-quien">
											<span class="rotulo-chico">{evaluacion.rol}</span>
											{#if evaluacion.observador}
												<span class="evaluacion-nombre">{evaluacion.observador}</span>
											{/if}
											<span class="detalle">{fecha(evaluacion.enviadaEn)}</span>
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
										Todos · {evaluacion.items.length}
									</button>
								</div>

								<ul class="evaluacion-items">
									{#if !completa && evaluacion.noHizo === 0}
										<li class="todo-hizo">
											<Icono nombre="tilde" grosor={2.5} />
											Hiciste todos los ítems
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
												<span class="peso-item">peso {cifra(item.peso)}</span>
											{/if}
										</li>
									{/each}
								</ul>
							</article>
						{/each}
					</div>
				{/if}
			</section>
		{/each}
	</main>
</div>
