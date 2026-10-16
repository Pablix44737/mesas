<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import Icono from '$lib/Icono.svelte';

	let { data, form } = $props();

	let creando = $state(false);
	let hojaAbierta = $state(false);
	let cursoElegido = $state('');
	let numero = $state<number | null>(null);
	let escenarioElegido = $state('');
	/** Los campos que se tocaron después del último envío: su error ya no aplica. */
	let corregidos = $state<Record<string, boolean>>({});
	/** Los cursos plegados. Se recuerdan en este dispositivo. */
	let plegados = $state<Record<string, boolean>>({});

	const variosCursos = $derived(data.carpetas.length > 1);
	const aviso = $derived(
		data.cursos.length === 0
			? 'Todavía no hay ningún curso en marcha. El administrador tiene que crear uno antes de que puedas crear una mesa.'
			: data.escenarios.length === 0
				? 'Todavía no hay escenarios preparados. El administrador tiene que dejar al menos uno disponible antes de que puedas crear una mesa.'
				: null
	);

	const numerosDe = (cursoId: string) =>
		data.carpetas.find((carpeta) => carpeta.id === cursoId)?.mesas.map((mesa) => mesa.numero) ?? [];
	const siguienteLibre = (cursoId: string) => {
		const numeros = numerosDe(cursoId);
		return cursoId ? (numeros.length > 0 ? Math.max(...numeros) + 1 : 1) : null;
	};
	const yaExisten = $derived(numerosDe(cursoElegido));

	const errorDe = (campo: string) =>
		form?.mensaje && form.campo === campo && !corregidos[campo] ? form.mensaje : null;
	const errorGeneral = $derived(form?.mensaje && !form.campo ? form.mensaje : null);

	function abrirHoja(cursoId?: string) {
		cursoElegido = cursoId ?? (data.cursos.length === 1 ? data.cursos[0].id : '');
		numero = siguienteLibre(cursoElegido);
		escenarioElegido = '';
		corregidos = { numero: true, cursoId: true, escenarioId: true };
		hojaAbierta = true;
	}

	function cerrarHoja() {
		if (!creando) hojaAbierta = false;
	}

	function alternar(cursoId: string) {
		plegados[cursoId] = !plegados[cursoId];
		try {
			localStorage.setItem('mesas-plegadas', JSON.stringify(plegados));
		} catch {
			// Sin almacenamiento, el plegado dura lo que dura la página.
		}
	}

	const ciclos = (n: number) => (n === 1 ? '1 ciclo' : `${n} ciclos`);
	const enfocar = (nodo: HTMLElement) => nodo.focus();

	onMount(() => {
		try {
			plegados = JSON.parse(localStorage.getItem('mesas-plegadas') ?? '{}');
		} catch {
			plegados = {};
		}
	});
</script>

<svelte:head>
	<title>Mis mesas — SIMUNaM</title>
</svelte:head>

<svelte:window onkeydown={(e) => e.key === 'Escape' && hojaAbierta && cerrarHoja()} />

<div class="mesas-pagina">
	<header class="mesa-cabecera">
		<div class="mesa-cabecera-dentro">
			<div class="mesa-navegacion">
				<a class="mesa-volver" href="/">
					<Icono nombre="atras" />
					Inicio
				</a>
				<button class="boton secundario mesas-crear" type="button" onclick={() => abrirHoja()}>
					<Icono nombre="mas" tamano={18} grosor={2.25} />
					Crear una mesa
				</button>
			</div>
			<div class="mesa-titulo-fila">
				<div class="mesa-titulo">
					<h1>Mis mesas</h1>
					<p class="mesa-escenario">Líder de mesa</p>
				</div>
			</div>
		</div>
	</header>

	<main class="mesas-cuerpo">
		{#each data.carpetas as carpeta (carpeta.id)}
			{@const abierta = !variosCursos || !plegados[carpeta.id]}
			{@const enCurso = carpeta.mesas.filter((mesa) => mesa.corridaEnCurso).length}
			<section class="mesas-curso">
				<button
					class="mesas-curso-cabecera"
					type="button"
					aria-expanded={abierta}
					disabled={!variosCursos}
					onclick={() => alternar(carpeta.id)}
				>
					<span class="mesas-curso-titulo">
						<h2>{carpeta.nombre}</h2>
						<span class="detalle">
							{carpeta.mesas.length === 1 ? '1 mesa' : `${carpeta.mesas.length} mesas`}
							{#if enCurso > 0}
								<span class="mesas-en-curso">{enCurso} en curso</span>
							{/if}
						</span>
					</span>
					{#if variosCursos}
						<Icono nombre={abierta ? 'arriba' : 'abajo'} />
					{/if}
				</button>

				{#if abierta}
					{#if carpeta.mesas.length === 0}
						<div class="mesas-curso-vacio">
							<strong>Este curso todavía no tiene mesas.</strong>
							{#if !aviso}
								<button class="boton secundario mesas-crear" type="button" onclick={() => abrirHoja(carpeta.id)}>
									Crear la primera mesa
								</button>
							{/if}
						</div>
					{:else}
						<ul class="mesas-grilla">
							{#each carpeta.mesas as mesa (mesa.id)}
								<li>
									<a class="mesa-ficha" href="/mesas/{mesa.curso?.codigo}/{mesa.numero}">
										<span class="mesa-numero" class:en-curso={mesa.corridaEnCurso}>
											<span>Mesa</span>
											<strong>{mesa.numero}</strong>
										</span>
										<span class="mesa-ficha-texto">
											<span class="nombre">{mesa.escenario?.nombre}</span>
											{#if mesa.corridaEnCurso}
												<span class="estado-mesa chica en-curso">
													<span class="punto" aria-hidden="true"></span>
													Ciclo {mesa.corridaEnCurso} en curso
												</span>
											{:else if mesa.corridas > 0}
												<span class="estado-mesa chica cerrado">
													<Icono nombre="candado" tamano={12} grosor={2.5} />
													Cerrada · {ciclos(mesa.corridas)}
												</span>
											{:else}
												<span class="estado-mesa chica sin-ciclos">
													<span class="punto" aria-hidden="true"></span>
													Sin ciclos habilitados
												</span>
											{/if}
										</span>
										<Icono nombre="adelante" tamano={18} />
									</a>
								</li>
							{/each}
						</ul>
					{/if}
				{/if}
			</section>
		{:else}
			<section class="mesa-tarjeta evaluado-vacio">
				<span class="evaluado-vacio-icono"><Icono nombre="mesa" tamano={24} /></span>
				<strong>Todavía no hay mesas creadas.</strong>
			</section>
		{/each}
	</main>
</div>

{#if hojaAbierta}
	<!-- Hoja que sube desde abajo en el teléfono; diálogo centrado en pantallas anchas. -->
	<div class="mesa-velo" role="presentation" onclick={(e) => e.target === e.currentTarget && cerrarHoja()}>
		<div
			class="mesa-dialogo"
			role="dialog"
			aria-modal="true"
			aria-labelledby="crear-titulo"
			tabindex="-1"
			use:enfocar
		>
			<span class="asa" aria-hidden="true"></span>
			<div class="dialogo-cabecera">
				<h2 id="crear-titulo">Crear una mesa</h2>
				<button class="icono-boton" type="button" aria-label="Cerrar" onclick={cerrarHoja}>
					<Icono nombre="cerrar" />
				</button>
			</div>

			{#if aviso}
				<div class="dialogo-aviso">
					<Icono nombre="alerta" />
					<span>{aviso}</span>
				</div>
				<div class="dialogo-botones">
					<button class="boton secundario" type="button" onclick={cerrarHoja}>Entendido</button>
				</div>
			{:else}
				<form
					method="POST"
					action="?/crear"
					use:enhance={() => {
						creando = true;
						return async ({ update }) => {
							await update({ reset: false });
							creando = false;
							corregidos = {};
						};
					}}
				>
					{#if errorGeneral}
						<p class="dialogo-error" role="alert">
							<Icono nombre="error" tamano={18} />
							{errorGeneral}
						</p>
					{/if}

					<div class="crear-campos">
						<div>
							<label for="cursoId">Curso</label>
							<select
								id="cursoId"
								name="cursoId"
								bind:value={cursoElegido}
								onchange={() => {
									numero = siguienteLibre(cursoElegido);
									corregidos.cursoId = true;
									corregidos.numero = true;
								}}
								aria-invalid={Boolean(errorDe('cursoId'))}
								required
							>
								<option value="" disabled>Elegí el curso</option>
								{#each data.cursos as curso (curso.id)}
									<option value={curso.id}>{curso.nombre}</option>
								{/each}
							</select>
							{#if errorDe('cursoId')}
								<p class="campo-error"><Icono nombre="error" tamano={16} />{errorDe('cursoId')}</p>
							{/if}
						</div>

						<div>
							<label for="numero">Número de mesa</label>
							<input
								id="numero"
								class="crear-numero"
								name="numero"
								type="number"
								inputmode="numeric"
								min="1"
								step="1"
								placeholder="Ej.: 6"
								bind:value={numero}
								oninput={() => (corregidos.numero = true)}
								aria-invalid={Boolean(errorDe('numero'))}
								required
							/>
							{#if errorDe('numero')}
								<p class="campo-error"><Icono nombre="error" tamano={16} />{errorDe('numero')}</p>
							{:else if yaExisten.length > 0}
								<p class="ayuda">Ya existen: {yaExisten.join(', ')}</p>
							{/if}
						</div>

						<div>
							<label for="escenarioId">Escenario</label>
							<select
								id="escenarioId"
								name="escenarioId"
								bind:value={escenarioElegido}
								onchange={() => (corregidos.escenarioId = true)}
								aria-invalid={Boolean(errorDe('escenarioId'))}
								required
							>
								<option value="" disabled>Elegí el escenario</option>
								{#each data.escenarios as escenario (escenario.id)}
									<option value={escenario.id}>{escenario.nombre}</option>
								{/each}
							</select>
							{#if errorDe('escenarioId')}
								<p class="campo-error"><Icono nombre="error" tamano={16} />{errorDe('escenarioId')}</p>
							{/if}
						</div>
					</div>

					<div class="dialogo-botones">
						<button class="boton secundario" type="button" onclick={cerrarHoja} disabled={creando}>
							Cancelar
						</button>
						<button class="boton enviar crear-confirmar" type="submit" disabled={creando}>
							{creando ? 'Creando…' : 'Crear la mesa'}
							{#if !creando}<Icono nombre="avanzar" tamano={20} grosor={2.25} />{/if}
						</button>
					</div>
				</form>
			{/if}
		</div>
	</div>
{/if}
