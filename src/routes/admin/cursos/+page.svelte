<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import Icono from '$lib/Icono.svelte';

	let { data, form } = $props();

	type Curso = (typeof data.cursos)[number];

	/** Sin JavaScript un rechazo vuelve con la página entera: el panel se reabre con lo elegido. */
	let creando = $state(untrack(() => Boolean(form?.mensaje && form.nombre !== '')));
	let nombre = $state(untrack(() => form?.nombre ?? ''));
	let destinadoA = $state(untrack(() => form?.destinadoA ?? ''));
	/** Lo que no pasó la revisión antes de mandar. */
	let errores = $state<Record<string, string>>({});
	/** Campos tocados después del último envío: su error del servidor ya no aplica. */
	let corregidos = $state<Record<string, boolean>>({});
	let trabajando = $state(false);
	let avisoCerrado = $state(false);

	const errorDe = (campo: string) =>
		errores[campo] ??
		(creando && form?.campo === campo && !corregidos[campo] ? form.mensaje : null);
	const errorGeneral = $derived(
		creando && form?.mensaje && !form.campo && !corregidos.general ? form.mensaje : null
	);

	/** El resultado de lo último que se hizo en esta pantalla, o lo que dejó la anterior. */
	const aviso = $derived.by(() => {
		if (avisoCerrado || creando) return null;
		if (form?.exito) return { exito: true, texto: form.exito };
		if (form?.mensaje && !form.campo) return { exito: false, texto: form.mensaje };
		if (data.aviso) return { exito: true, texto: data.aviso };
		return null;
	});

	const enMarcha = $derived(data.cursos.filter((c) => !c.archivado));
	const archivados = $derived(data.cursos.filter((c) => c.archivado));

	const cuantos = (n: number, singular: string, plural: string) =>
		`${n} ${n === 1 ? singular : plural}`;
	const fecha = (valor: string) =>
		new Date(valor).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
	const para = (curso: Curso) => `Para ${curso.destinatario.toLocaleLowerCase('es')}`;

	async function abrir() {
		creando = true;
		avisoCerrado = true;
		nombre = '';
		destinadoA = '';
		errores = {};
		corregidos = { nombre: true, destinadoA: true, general: true };
		await tick();
		document.getElementById('nombre-curso')?.focus();
	}

	function cerrar() {
		if (!trabajando) creando = false;
	}

	const crear: SubmitFunction = ({ cancel }) => {
		const faltan: Record<string, string> = {};
		if (nombre.trim().length < 4) faltan.nombre = 'Escribí el nombre del curso.';
		else if (data.cursos.some((c) => c.nombre === nombre.trim())) {
			faltan.nombre = `Ya hay un curso que se llama «${nombre.trim()}».`;
		}
		if (!destinadoA) faltan.destinadoA = 'Elegí a quién está destinado el curso.';
		errores = faltan;
		if (faltan.nombre || faltan.destinadoA) {
			cancel();
			if (faltan.nombre) document.getElementById('nombre-curso')?.focus();
			return;
		}
		corregidos = {};
		trabajando = true;
		// Si sale bien, el servidor lleva a la pantalla del curso recién creado.
		return async ({ update }) => {
			await update({ reset: false });
			trabajando = false;
		};
	};
</script>

<svelte:head>
	<title>Cursos — SIMUNaM</title>
</svelte:head>

<svelte:window onkeydown={(evento) => evento.key === 'Escape' && creando && cerrar()} />

<div class="admin-encabezado">
	<div class="admin-encabezado-dentro">
		<div class="admin-titulo">
			<div>
				<h1>Cursos</h1>
				<span class="admin-total">{cuantos(data.cursos.length, 'curso', 'cursos')}</span>
			</div>
			<p>Cada edición del evento, con sus mesas, sus ciclos y sus evaluaciones.</p>
		</div>
		<div class="admin-acciones-encabezado">
			<button class="boton enviar" type="button" onclick={abrir}>
				<Icono nombre="mas" tamano={20} grosor={2.25} />
				Nuevo curso
			</button>
		</div>
	</div>
</div>

<div class="admin-cuerpo">
	{#if aviso}
		<div class="admin-aviso" class:error={!aviso.exito} role={aviso.exito ? 'status' : 'alert'}>
			<Icono nombre={aviso.exito ? 'tilde-circulo' : 'error'} />
			<p>{aviso.texto}</p>
			<button type="button" aria-label="Cerrar el mensaje" onclick={() => (avisoCerrado = true)}>
				<Icono nombre="cerrar" tamano={18} />
			</button>
		</div>
	{/if}

	{#if data.cursos.length === 0}
		<section class="mesa-tarjeta admin-vacio">
			<span class="evaluado-vacio-icono"><Icono nombre="curso" tamano={24} /></span>
			<strong>Todavía no hay cursos.</strong>
			<p>Creá el primero para poder darle mesas.</p>
			<button class="boton secundario" type="button" onclick={abrir}>
				<Icono nombre="mas" tamano={20} />
				Crear un curso
			</button>
		</section>
	{:else}
		<div class="cursos-grupo">
			<h2>En marcha</h2>
			<span>{enMarcha.length}</span>
		</div>
		{#if enMarcha.length > 0}
			<ul class="cursos-tarjetas">
				{#each enMarcha as curso (curso.id)}
					<li>
						<a class="cursos-tarjeta" href="/admin/cursos/{curso.codigo}">
							<span class="cursos-tarjeta-titulo">
								{#if curso.mesasEnCurso > 0}
									<span class="cursos-en-curso">
										{curso.mesasEnCurso === 1
											? '1 mesa en curso ahora'
											: `${curso.mesasEnCurso} mesas en curso ahora`}
									</span>
								{/if}
								<strong>{curso.nombre}</strong>
								<span>{para(curso)} · desde el {fecha(curso.creado_en)}</span>
							</span>
							<span class="cursos-cifras">
								<span><strong>{curso.mesas}</strong>{curso.mesas === 1 ? 'mesa' : 'mesas'}</span>
								<span><strong>{curso.corridas}</strong>{curso.corridas === 1 ? 'ciclo' : 'ciclos'}</span>
								<span>
									<strong>{curso.evaluaciones}</strong>{curso.evaluaciones === 1 ? 'evaluación' : 'evaluaciones'}
								</span>
							</span>
							<span class="cursos-tarjeta-pie">
								<span>Código <code>{curso.codigo}</code></span>
								<span class="cursos-abrir">Abrir<Icono nombre="adelante" tamano={18} /></span>
							</span>
						</a>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="cursos-ninguno">No hay cursos en marcha. Creá uno nuevo o desarchivá uno de abajo.</p>
		{/if}

		{#if archivados.length > 0}
			<div class="cursos-grupo archivados">
				<h2>Archivados</h2>
				<span>{archivados.length}</span>
			</div>
			<ul class="mesa-tarjeta cursos-archivados">
				{#each archivados as curso (curso.id)}
					<li>
						<span class="cursos-archivado-icono"><Icono nombre="carpeta" tamano={20} /></span>
						<a href="/admin/cursos/{curso.codigo}">
							<strong>{curso.nombre}</strong>
							<span>
								Archivado · {cuantos(curso.mesas, 'mesa', 'mesas')} · {cuantos(curso.evaluaciones, 'evaluación', 'evaluaciones')} · desde el {fecha(curso.creado_en)}
							</span>
						</a>
						<form
							method="POST"
							action="?/archivar"
							use:enhance={() => {
								avisoCerrado = false;
								return async ({ update }) => await update({ reset: false });
							}}
						>
							<input type="hidden" name="id" value={curso.id} />
							<input type="hidden" name="archivado" value="false" />
							<button class="boton secundario neutro" type="submit">Desarchivar</button>
						</form>
					</li>
				{/each}
			</ul>
			<p class="cursos-nota">Archivar no borra nada: el curso sale del frente y sus mesas se siguen consultando.</p>
		{/if}
	{/if}
</div>

{#if creando}
	<div class="admin-velo" role="presentation" onclick={cerrar}></div>
	<div class="admin-panel" role="dialog" aria-modal="true" aria-labelledby="nuevo-titulo">
		<form class="admin-panel-formulario" method="POST" action="?/crear" novalidate use:enhance={crear}>
			<span class="admin-asa" aria-hidden="true"></span>
			<div class="admin-panel-cabecera">
				<div>
					<h2 id="nuevo-titulo">Nuevo curso</h2>
					<p>Una edición del evento. Las mesas las crea después el líder de cada una.</p>
				</div>
				<button class="admin-cerrar" type="button" aria-label="Cerrar" onclick={cerrar}>
					<Icono nombre="cerrar" tamano={20} />
				</button>
			</div>

			<div class="admin-panel-cuerpo">
				{#if errorGeneral}
					<p class="dialogo-error" role="alert"><Icono nombre="error" tamano={18} />{errorGeneral}</p>
				{/if}
				<div class="admin-campo">
					<label for="nombre-curso">Nombre del curso</label>
					<input
						id="nombre-curso"
						name="nombre"
						type="text"
						autocomplete="off"
						placeholder="Diplomatura Superior Universitaria en Simulación"
						bind:value={nombre}
						oninput={() => {
							delete errores.nombre;
							corregidos.nombre = true;
						}}
						aria-invalid={Boolean(errorDe('nombre'))}
						aria-describedby="ayuda-nombre"
					/>
					{#if errorDe('nombre')}
						<p class="campo-error" id="ayuda-nombre"><Icono nombre="error" tamano={16} />{errorDe('nombre')}</p>
					{:else}
						<p class="ayuda" id="ayuda-nombre">Como se lo conoce: la cohorte, el año, la carrera.</p>
					{/if}
				</div>

				<fieldset class="admin-opciones" class:con-error={errorDe('destinadoA')}>
					<legend>A quién está destinado</legend>
					{#each data.destinatarios as destinatario (destinatario.codigo)}
						<label class="admin-opcion">
							<input
								type="radio"
								name="destinadoA"
								value={destinatario.codigo}
								bind:group={destinadoA}
								onchange={() => {
									delete errores.destinadoA;
									corregidos.destinadoA = true;
								}}
							/>
							<span>
								<strong>{destinatario.nombre}</strong>
								<span>{destinatario.descripcion}</span>
							</span>
						</label>
					{/each}
					{#if errorDe('destinadoA')}
						<p class="campo-error"><Icono nombre="error" tamano={16} />{errorDe('destinadoA')}</p>
					{/if}
				</fieldset>
			</div>

			<div class="admin-panel-pie">
				<button class="boton secundario neutro" type="button" onclick={cerrar} disabled={trabajando}>
					Cancelar
				</button>
				<button class="boton enviar" type="submit" disabled={trabajando}>
					{trabajando ? 'Creando…' : 'Crear el curso'}
				</button>
			</div>
		</form>
	</div>
{/if}
