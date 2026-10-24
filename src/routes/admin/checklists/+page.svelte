<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import Icono from '$lib/Icono.svelte';

	let { data, form } = $props();

	type Plantilla = (typeof data.plantillas)[number];

	/** Sin JavaScript un rechazo vuelve con la página entera: el panel se reabre con lo elegido. */
	let creando = $state(untrack(() => Boolean(form?.mensaje)));
	let nombre = $state(untrack(() => form?.nombre ?? ''));
	let rol = $state(untrack(() => form?.rolCodigo ?? ''));
	let ponderado = $state(untrack(() => form?.ponderado ?? false));
	/** Lo que no pasó la revisión antes de mandar. */
	let errores = $state<Record<string, string>>({});
	/** Campos tocados después del último envío: su error del servidor ya no aplica. */
	let corregidos = $state<Record<string, boolean>>({});
	let trabajando = $state(false);
	let avisoCerrado = $state(false);

	const errorDe = (campo: string) =>
		errores[campo] ?? (form?.campo === campo && !corregidos[campo] ? form.mensaje : null);
	const errorGeneral = $derived(
		form?.mensaje && !form.campo && !corregidos.general ? form.mensaje : null
	);

	const ESTADOS: Record<string, string> = {
		en_construccion: 'En construcción',
		disponible: 'Disponible',
		reemplazada: 'Reemplazado'
	};

	const comun = (plantilla: Plantilla) => plantilla.rol?.checklist === 'comun';
	const cifras = (plantilla: Plantilla) =>
		`${plantilla.items} ${plantilla.items === 1 ? 'ítem' : 'ítems'} · máximo ${plantilla.maximo.toLocaleString('es-AR')}${plantilla.ponderado ? '' : ' · sin ponderar'}`;

	/** Lo pendiente arriba; después los de cada escenario y los que usan todos. */
	const grupos = $derived.by(() => {
		const enConstruccion = data.plantillas.filter((p) => p.estado === 'en_construccion');
		const terminados = data.plantillas.filter((p) => p.estado !== 'en_construccion');
		// En uso antes que reemplazado, dentro de cada rol común.
		const comunes = terminados
			.filter(comun)
			.sort(
				(a, b) =>
					a.rol_codigo.localeCompare(b.rol_codigo) ||
					Number(a.estado !== 'disponible') - Number(b.estado !== 'disponible')
			);
		return [
			{ clave: 'construccion', titulo: 'En construcción', nota: '', plantillas: enConstruccion },
			{
				clave: 'tecnica',
				titulo: 'De la técnica',
				nota: 'Cada escenario usa el suyo.',
				plantillas: terminados.filter((p) => !comun(p))
			},
			{
				clave: 'comunes',
				titulo: 'Comunes a todos los escenarios',
				nota: 'De cada rol hay uno solo en uso.',
				plantillas: comunes
			}
		].filter((grupo) => grupo.plantillas.length > 0);
	});

	/** Para cada rol, qué se elige al elegirlo: uno por escenario, o el que reemplaza al vigente. */
	function detalleDelRol(codigo: string, checklist: string | null) {
		if (checklist !== 'comun') return 'Uno por escenario. Se asocia desde Escenarios.';
		const vigente = data.plantillas.find((p) => p.rol_codigo === codigo && p.estado === 'disponible');
		return vigente
			? `Común a todos los escenarios. Hoy se usa «${vigente.nombre}».`
			: 'Común a todos los escenarios.';
	}

	async function abrir() {
		creando = true;
		avisoCerrado = true;
		nombre = '';
		rol = '';
		ponderado = false;
		errores = {};
		corregidos = { nombre: true, rolCodigo: true, general: true };
		await tick();
		document.getElementById('nombre-checklist')?.focus();
	}

	function cerrar() {
		if (!trabajando) creando = false;
	}

	const crear: SubmitFunction = ({ cancel }) => {
		const faltan: Record<string, string> = {};
		if (nombre.trim().length < 3) faltan.nombre = 'Poné un nombre de al menos 3 caracteres.';
		if (!rol) faltan.rolCodigo = 'Indicá el rol observador al que corresponde.';
		errores = faltan;
		if (faltan.nombre || faltan.rolCodigo) {
			cancel();
			if (faltan.nombre) document.getElementById('nombre-checklist')?.focus();
			return;
		}
		corregidos = {};
		trabajando = true;
		// Si sale bien, el servidor lleva a cargar los criterios del recién creado.
		return async ({ update }) => {
			await update({ reset: false });
			trabajando = false;
		};
	};
</script>

<svelte:head>
	<title>Checklists — SIMUNaM</title>
</svelte:head>

<svelte:window onkeydown={(evento) => evento.key === 'Escape' && creando && cerrar()} />

<div class="admin-encabezado">
	<div class="admin-encabezado-dentro">
		<div class="admin-titulo">
			<div>
				<h1>Checklists</h1>
				<span class="admin-total">
					{data.plantillas.length}
					{data.plantillas.length === 1 ? 'checklist' : 'checklists'}
				</span>
			</div>
			<p>Los criterios que cada observador marca como «Hizo» o «No hizo» en cada ciclo.</p>
		</div>
		<div class="admin-acciones-encabezado">
			<button class="boton enviar" type="button" onclick={abrir}>
				<Icono nombre="mas" tamano={20} grosor={2.25} />
				Nuevo checklist
			</button>
		</div>
	</div>
</div>

<div class="admin-cuerpo">
	{#if data.eliminado && !avisoCerrado}
		<div class="admin-aviso" role="status">
			<Icono nombre="tilde-circulo" />
			<p>Se eliminó el checklist «{data.eliminado}».</p>
			<button type="button" aria-label="Cerrar el mensaje" onclick={() => (avisoCerrado = true)}>
				<Icono nombre="cerrar" tamano={18} />
			</button>
		</div>
	{/if}

	{#if data.plantillas.length === 0}
		<section class="mesa-tarjeta admin-vacio">
			<span class="evaluado-vacio-icono"><Icono nombre="checklist" tamano={24} /></span>
			<strong>Todavía no hay checklists cargados.</strong>
			<p>Creá el primero: le ponés un nombre, elegís el rol observador y cargás sus criterios.</p>
			<button class="boton secundario" type="button" onclick={abrir}>
				<Icono nombre="mas" tamano={20} />
				Crear un checklist
			</button>
		</section>
	{:else}
		<section class="admin-lista" aria-label="Checklists">
			<div class="checklists-columnas" aria-hidden="true">
				<span>Checklist</span>
				<span>Rol observador</span>
				<span>Estado</span>
				<span></span>
			</div>
			{#each grupos as grupo (grupo.clave)}
				<div class="admin-grupo">
					<h2>{grupo.titulo}</h2>
					<span class:neutro={grupo.clave !== 'construccion'}>{grupo.plantillas.length}</span>
					{#if grupo.nota}<p>{grupo.nota}</p>{/if}
				</div>
				<ul>
					{#each grupo.plantillas as plantilla (plantilla.id)}
						<li>
							<a class="checklists-fila" href="/admin/checklists/{plantilla.id}">
								<span class="checklists-nombre">
									<strong>{plantilla.nombre}</strong>
									<span class="solo-ancho">{cifras(plantilla)}</span>
									<span class="solo-angosto">{plantilla.rol?.nombre} · {cifras(plantilla)}</span>
								</span>
								<span class="checklists-rol">{plantilla.rol?.nombre}</span>
								<span>
									<span class="checklist-estado {plantilla.estado}">{ESTADOS[plantilla.estado]}</span>
								</span>
								<Icono nombre="adelante" tamano={18} clase="admin-flecha" />
							</a>
						</li>
					{/each}
				</ul>
			{/each}
		</section>
	{/if}
</div>

{#if creando}
	<div class="admin-velo" role="presentation" onclick={cerrar}></div>
	<div class="admin-panel" role="dialog" aria-modal="true" aria-labelledby="nuevo-titulo">
		<form
			class="admin-panel-formulario"
			method="POST"
			action="?/crear"
			novalidate
			use:enhance={crear}
		>
			<span class="admin-asa" aria-hidden="true"></span>
			<div class="admin-panel-cabecera">
				<div>
					<h2 id="nuevo-titulo">Nuevo checklist</h2>
					<p>Después cargás sus criterios, de a uno.</p>
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
					<label for="nombre-checklist">Nombre</label>
					<input
						id="nombre-checklist"
						name="nombre"
						type="text"
						autocomplete="off"
						placeholder="Técnica: manejo inicial del politraumatizado"
						bind:value={nombre}
						oninput={() => {
							delete errores.nombre;
							corregidos.nombre = true;
						}}
						aria-invalid={Boolean(errorDe('nombre'))}
						aria-describedby={errorDe('nombre') ? 'error-nombre' : undefined}
					/>
					{#if errorDe('nombre')}
						<p class="campo-error" id="error-nombre"><Icono nombre="error" tamano={16} />{errorDe('nombre')}</p>
					{/if}
				</div>

				<fieldset class="admin-opciones" class:con-error={errorDe('rolCodigo')}>
					<legend>Rol observador al que corresponde</legend>
					{#each data.roles as opcion (opcion.codigo)}
						<label class="admin-opcion">
							<input
								type="radio"
								name="rolCodigo"
								value={opcion.codigo}
								bind:group={rol}
								onchange={() => {
									delete errores.rolCodigo;
									corregidos.rolCodigo = true;
								}}
							/>
							<span>
								<strong>{opcion.nombre}</strong>
								<span>{detalleDelRol(opcion.codigo, opcion.checklist)}</span>
							</span>
						</label>
					{/each}
					{#if errorDe('rolCodigo')}
						<p class="campo-error"><Icono nombre="error" tamano={16} />{errorDe('rolCodigo')}</p>
					{/if}
				</fieldset>

				<label class="checklist-interruptor">
					<span>
						<strong>Ponderar el checklist</strong>
						<span>Cada criterio lleva su propio peso. Sin ponderar, todos valen lo mismo.</span>
					</span>
					<input type="checkbox" role="switch" name="ponderado" bind:checked={ponderado} />
				</label>
			</div>

			<div class="admin-panel-pie">
				<button class="boton secundario neutro" type="button" onclick={cerrar} disabled={trabajando}>
					Cancelar
				</button>
				<button class="boton enviar" type="submit" disabled={trabajando}>
					{trabajando ? 'Creando…' : 'Empezar a cargarlo'}
				</button>
			</div>
		</form>
	</div>
{/if}
