<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import Icono from '$lib/Icono.svelte';

	let { data, form } = $props();

	type Accion = 'editar' | 'archivar' | 'eliminarCurso' | 'entregarCopia';

	const curso = $derived(data.curso);
	/** Qué formulario mandó la última respuesta del servidor, para mostrarla en su lugar. */
	let accion = $state<Accion | null>(null);
	let trabajando = $state<Accion | null>(null);
	let avisoCerrado = $state(false);

	const cuantos = (n: number, singular: string, plural: string) =>
		`${n} ${n === 1 ? singular : plural}`;
	const fecha = (valor: string) =>
		new Date(valor).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
	const hora = (valor: string) =>
		new Date(valor).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

	const destinatario = $derived(data.destinatarios.find((d) => d.codigo === curso.destinado_a));
	const ciclos = $derived(data.mesas.reduce((total, mesa) => total + mesa.ciclos.length, 0));
	const evaluaciones = $derived(data.mesas.reduce((total, mesa) => total + mesa.evaluaciones, 0));
	const enCurso = $derived(data.mesas.filter((mesa) => mesa.enCurso));
	const abiertos = $derived(enCurso.reduce((total, mesa) => total + (mesa.enCurso?.abiertos ?? 0), 0));

	const estadoDe = (mesa: (typeof data.mesas)[number]) =>
		mesa.enCurso
			? `Ciclo ${mesa.enCurso.numero} en curso`
			: mesa.ciclos.length === 0
				? 'Sin ciclos'
				: cuantos(mesa.ciclos.length, 'ciclo cerrado', 'ciclos cerrados');
	/** Una marca por ciclo, y lugar para los que faltan hasta seis. */
	const marcas = (mesa: (typeof data.mesas)[number]) =>
		Array.from({ length: Math.max(6, mesa.ciclos.length) }, (_, i) => mesa.ciclos[i] ?? null);

	/** El resultado de lo último, cuando no se muestra ya junto a lo que lo produjo. */
	const aviso = $derived.by(() => {
		if (avisoCerrado || editando || eliminando || entregando) return null;
		if (form?.exito) return { exito: true, texto: form.exito };
		if (form?.mensaje && accion !== 'editar' && accion !== 'eliminarCurso') {
			return { exito: false, texto: form.mensaje };
		}
		if (data.aviso && !accion) return { exito: true, texto: data.aviso };
		return null;
	});

	/* --- editar el nombre y el destinatario --- */

	/** Sin JavaScript un rechazo vuelve con la página entera: el panel se reabre con lo elegido. */
	let editando = $state(untrack(() => Boolean(form?.editando)));
	let nombre = $state(untrack(() => (form?.editando ? (form.nombre ?? '') : '')));
	let destinadoA = $state(untrack(() => (form?.editando ? (form.destinadoA ?? '') : '')));
	let errores = $state<Record<string, string>>({});
	let corregidos = $state<Record<string, boolean>>({});
	const bloqueado = $derived(data.rolesYaOcupados > 0);

	const errorDe = (campo: string) =>
		errores[campo] ??
		(form?.editando && form.campo === campo && !corregidos[campo] ? form.mensaje : null);
	const errorDelPanel = $derived(
		form?.editando && !form.campo && !corregidos.general ? form.mensaje : null
	);

	async function editar() {
		editando = true;
		nombre = curso.nombre;
		destinadoA = curso.destinado_a;
		errores = {};
		corregidos = { nombre: true, destinadoA: true, general: true };
		await tick();
		document.getElementById('nombre-curso')?.focus();
	}

	/* --- eliminar el curso --- */

	let eliminando = $state(untrack(() => Boolean(form?.eliminandoCurso)));
	let confirmacion = $state('');
	let confirmacionCorregida = $state(false);
	const errorDeConfirmacion = $derived(
		form?.eliminandoCurso && !confirmacionCorregida ? form.mensaje : null
	);

	async function pedirEliminar() {
		eliminando = true;
		confirmacion = '';
		confirmacionCorregida = true;
		await tick();
		document.getElementById('confirmar-curso')?.focus();
	}

	/* --- entregarle una copia a otra institución --- */

	let entregando = $state(untrack(() => Boolean(form?.entregando)));
	let institucionId = $state(untrack(() => form?.institucionId ?? ''));
	let confirmacionCopia = $state('');
	let conPadron = $state(true);
	let copiaCorregida = $state(false);
	const errorDeLaCopia = $derived(form?.entregando && !copiaCorregida ? form.mensaje : null);

	const institucionElegida = $derived(
		data.otrasInstituciones.find((i) => i.id === institucionId)?.nombre ?? null
	);

	async function pedirEntregar() {
		entregando = true;
		institucionId = data.otrasInstituciones.length === 1 ? data.otrasInstituciones[0].id : '';
		confirmacionCopia = '';
		conPadron = true;
		copiaCorregida = true;
		await tick();
		document.getElementById('copia-institucion')?.focus();
	}

	function cerrar() {
		if (trabajando) return;
		editando = false;
		eliminando = false;
		entregando = false;
	}

	const enviar =
		(de: Accion, antes?: () => boolean): SubmitFunction =>
		({ cancel }) => {
			if (antes && !antes()) {
				cancel();
				return;
			}
			accion = de;
			trabajando = de;
			avisoCerrado = false;
			corregidos = {};
			confirmacionCorregida = false;
			return async ({ result, update }) => {
				await update({ reset: false });
				trabajando = null;
				if (result.type === 'success') {
					editando = false;
					// La entrega termina con un mensaje, no con una redirección: si el
					// diálogo no se cierra, el aviso queda tapado detrás y parece que no
					// pasó nada. Eliminar no lo necesita porque se va de la pantalla.
					entregando = false;
					window.scrollTo({ top: 0 });
				}
			};
		};

	const revisarEdicion = () => {
		const faltan: Record<string, string> = {};
		if (nombre.trim().length < 4) faltan.nombre = 'El nombre no puede quedar vacío.';
		errores = faltan;
		if (faltan.nombre) document.getElementById('nombre-curso')?.focus();
		return !faltan.nombre;
	};
</script>

<svelte:head>
	<title>{curso.nombre} — SIMUNaM</title>
</svelte:head>

<svelte:window onkeydown={(evento) => evento.key === 'Escape' && cerrar()} />

<div class="admin-encabezado">
	<div class="admin-ficha">
		<a class="mesa-volver" href="/admin/cursos">
			<Icono nombre="atras" tamano={18} />
			Cursos
		</a>
		<div class="cursos-ficha">
			<div>
				<div class="cursos-ficha-titulo">
					<h1>{curso.nombre}</h1>
					{#if curso.archivado}
						<span class="checklist-estado grande"><Icono nombre="carpeta" tamano={14} />Archivado</span>
					{/if}
				</div>
				<p class="cursos-ficha-datos">
					<strong>Para {(destinatario?.nombre ?? curso.destinado_a).toLocaleLowerCase('es')}</strong>
					<span>Desde el {fecha(curso.creado_en)}</span>
					<span>Código <code>{curso.codigo}</code></span>
				</p>
				<p class="cursos-ficha-cifras">
					<span><strong>{data.mesas.length}</strong>{data.mesas.length === 1 ? 'mesa' : 'mesas'}</span>
					<span><strong>{ciclos}</strong>{ciclos === 1 ? 'ciclo' : 'ciclos'}</span>
					<span>
						<strong>{evaluaciones}</strong>{evaluaciones === 1 ? 'evaluación enviada' : 'evaluaciones enviadas'}
					</span>
				</p>
			</div>
			<div class="cursos-ficha-acciones">
				<button class="boton secundario neutro" type="button" onclick={editar}>
					<Icono nombre="editar" tamano={18} />
					Editar
				</button>
				<form method="POST" action="?/archivar" use:enhance={enviar('archivar')}>
					<input type="hidden" name="archivado" value={curso.archivado ? 'false' : 'true'} />
					<button class="boton secundario neutro" type="submit" disabled={trabajando === 'archivar'}>
						<Icono nombre="carpeta" tamano={18} />
						{curso.archivado ? 'Desarchivar' : 'Archivar'}
					</button>
				</form>
			</div>
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

	{#if enCurso.length > 0}
		<section class="mesa-tarjeta cursos-ahora" aria-labelledby="ahora-titulo">
			<div class="cursos-ahora-cabecera">
				<span class="cursos-punto" aria-hidden="true"></span>
				<h2 id="ahora-titulo">Ahora en las mesas</h2>
				<span>
					{cuantos(enCurso.length, 'mesa en curso', 'mesas en curso')}{abiertos > 0
						? ` · ${cuantos(abiertos, 'checklist abierto sin enviar', 'checklists abiertos sin enviar')}`
						: ''}
				</span>
			</div>
			<ul>
				{#each enCurso as mesa (mesa.id)}
					{#if mesa.enCurso}
						<li>
							<a href="/admin/cursos/{curso.codigo}/mesas/{mesa.numero}">
								<strong>Mesa {mesa.numero} · ciclo {mesa.enCurso.numero}</strong>
								<span>
									En curso desde las {hora(mesa.enCurso.desde)} · {cuantos(mesa.enCurso.roles, 'rol ocupado', 'roles ocupados')}
								</span>
								<span class="cursos-abiertos" class:ninguno={mesa.enCurso.abiertos === 0}>
									{mesa.enCurso.abiertos === 0
										? 'Ningún checklist abierto sin enviar'
										: cuantos(mesa.enCurso.abiertos, 'checklist abierto sin enviar', 'checklists abiertos sin enviar')}
								</span>
							</a>
						</li>
					{/if}
				{/each}
			</ul>
		</section>
	{/if}

	<section class="cursos-mesas" aria-labelledby="mesas-titulo">
		<div class="cursos-mesas-cabecera">
			<h2 id="mesas-titulo">Mesas</h2>
			<span>{data.mesas.length}</span>
			{#if evaluaciones > 0}
				<a class="boton secundario" href="/admin/cursos/{curso.codigo}/evaluaciones.csv" download>
					<Icono nombre="descargar" tamano={18} />
					Descargar las evaluaciones
				</a>
			{/if}
		</div>

		{#if data.mesas.length === 0}
			<div class="mesa-tarjeta admin-vacio">
				<span class="evaluado-vacio-icono gris"><Icono nombre="mesa" tamano={24} /></span>
				<strong>Este curso todavía no tiene mesas.</strong>
				<p>Las crea el líder de mesa desde su pantalla.</p>
			</div>
		{:else}
			<ul class="cursos-mesas-lista">
				{#each data.mesas as mesa (mesa.id)}
					<li>
						<a class="cursos-mesa" href="/admin/cursos/{curso.codigo}/mesas/{mesa.numero}">
							<span class="cursos-mesa-titulo">
								<strong>Mesa {mesa.numero}</strong>
								<span class="cursos-estado" class:en-curso={mesa.enCurso}>{estadoDe(mesa)}</span>
							</span>
							<span class="cursos-mesa-escenario">{mesa.escenario}</span>
							<span class="cursos-marcas" aria-hidden="true">
								{#each marcas(mesa) as ciclo, i (i)}
									<span class:hecho={ciclo} class:en-curso={ciclo?.enCurso}></span>
								{/each}
							</span>
							<span class="cursos-mesa-pie">
								{mesa.ciclos.length === 0
									? 'Todavía sin evaluaciones'
									: cuantos(mesa.evaluaciones, 'evaluación', 'evaluaciones')}
								<Icono nombre="adelante" tamano={18} />
							</span>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	{#if data.otrasInstituciones.length > 0}
		<section class="admin-eliminar" aria-label="Entregar una copia">
			<div>
				<strong>Entregar una copia a otra institución</strong>
				<span>
					Se lleva el curso entero —mesas, ciclos, roles y evaluaciones— con los escenarios y
					checklists que usó. Acá no cambia nada.
				</span>
			</div>
			<button class="boton secundario neutro" type="button" onclick={pedirEntregar}>
				<Icono nombre="externo" tamano={18} />
				Entregar una copia
			</button>
		</section>
	{/if}

	<section class="admin-eliminar" aria-label="Eliminar el curso">
		<div>
			<strong>Eliminar el curso</strong>
			<span>Pensado para cursos de prueba. Si la edición terminó, archivala: sus mesas se siguen consultando.</span>
		</div>
		<button class="boton secundario" type="button" onclick={pedirEliminar}>
			<Icono nombre="quitar" tamano={18} />
			Eliminar el curso
		</button>
	</section>
</div>

{#if editando}
	<div class="admin-velo" role="presentation" onclick={cerrar}></div>
	<div class="admin-panel" role="dialog" aria-modal="true" aria-labelledby="editar-titulo">
		<form
			class="admin-panel-formulario"
			method="POST"
			action="?/editar"
			novalidate
			use:enhance={enviar('editar', revisarEdicion)}
		>
			<span class="admin-asa" aria-hidden="true"></span>
			<div class="admin-panel-cabecera">
				<div>
					<h2 id="editar-titulo">Editar el curso</h2>
					<p>El código <code>{curso.codigo}</code> no cambia: está en los QR impresos.</p>
				</div>
				<button class="admin-cerrar" type="button" aria-label="Cerrar" onclick={cerrar}>
					<Icono nombre="cerrar" tamano={20} />
				</button>
			</div>

			<div class="admin-panel-cuerpo">
				{#if errorDelPanel}
					<p class="dialogo-error" role="alert"><Icono nombre="error" tamano={18} />{errorDelPanel}</p>
				{/if}
				<div class="admin-campo">
					<label for="nombre-curso">Nombre del curso</label>
					<input
						id="nombre-curso"
						name="nombre"
						type="text"
						autocomplete="off"
						bind:value={nombre}
						oninput={() => {
							delete errores.nombre;
							corregidos.nombre = true;
						}}
						aria-invalid={Boolean(errorDe('nombre'))}
					/>
					{#if errorDe('nombre')}
						<p class="campo-error"><Icono nombre="error" tamano={16} />{errorDe('nombre')}</p>
					{:else}
						<p class="ayuda">Como se lo conoce: la cohorte, el año, la carrera.</p>
					{/if}
				</div>

				<fieldset class="admin-opciones" disabled={bloqueado} class:con-error={errorDe('destinadoA')}>
					<legend>A quién está destinado</legend>
					{#each data.destinatarios as opcion (opcion.codigo)}
						<label class="admin-opcion">
							<input
								type="radio"
								name="destinadoA"
								value={opcion.codigo}
								bind:group={destinadoA}
								onchange={() => (corregidos.destinadoA = true)}
							/>
							<span>
								<strong>{opcion.nombre}</strong>
								<span>{opcion.descripcion}</span>
							</span>
						</label>
					{/each}
					{#if errorDe('destinadoA')}
						<p class="campo-error"><Icono nombre="error" tamano={16} />{errorDe('destinadoA')}</p>
					{:else if bloqueado}
						<p class="estadisticas-nota">
							<Icono nombre="candado" tamano={16} />
							<span>En este curso ya se ocuparon roles, así que su destinatario no se puede cambiar.</span>
						</p>
					{/if}
				</fieldset>
				<!-- Deshabilitado, el grupo no viaja: se manda el que tiene, que no cambia. -->
				{#if bloqueado}<input type="hidden" name="destinadoA" value={curso.destinado_a} />{/if}
			</div>

			<div class="admin-panel-pie">
				<button class="boton secundario neutro" type="button" onclick={cerrar} disabled={trabajando === 'editar'}>
					Cancelar
				</button>
				<button class="boton enviar" type="submit" disabled={trabajando === 'editar'}>
					{trabajando === 'editar' ? 'Guardando…' : 'Guardar los cambios'}
				</button>
			</div>
		</form>
	</div>
{/if}

{#if entregando}
	<div class="admin-velo" role="presentation" onclick={cerrar}></div>
	<div class="admin-dialogo" role="dialog" aria-modal="true" aria-labelledby="copia-titulo">
		<span class="admin-asa" aria-hidden="true"></span>
		<h2 id="copia-titulo">Entregar una copia de «{curso.nombre}»</h2>
		<p>
			{data.mesas.length > 0
				? `Viajan ${cuantos(data.mesas.length, 'mesa', 'mesas')}, ${cuantos(ciclos, 'ciclo', 'ciclos')} y ${cuantos(evaluaciones, 'evaluación enviada', 'evaluaciones enviadas')}, con los escenarios y checklists que usó.`
				: 'Todavía no tiene mesas: la copia va a quedar vacía.'}
		</p>

		<form method="POST" action="?/entregarCopia" novalidate use:enhance={enviar('entregarCopia')}>
			<div class="admin-campo">
				<label for="copia-institucion">¿Qué institución se la lleva?</label>
				<select
					id="copia-institucion"
					name="institucionId"
					bind:value={institucionId}
					onchange={() => (copiaCorregida = true)}
				>
					<option value="">Elegí la institución</option>
					{#each data.otrasInstituciones as institucion (institucion.id)}
						<option value={institucion.id}>{institucion.nombre}</option>
					{/each}
				</select>
			</div>

			<!-- El padrón son nombres y documentos de personas reales. Que viaje es lo
			     habitual —son los asistentes de ese curso— pero se elige, no se asume. -->
			<label class="copia-padron">
				<input type="checkbox" name="conPadron" value="si" bind:checked={conPadron} />
				<span>
					<strong>Incluir el padrón</strong>
					<span class="detalle">
						Nombre y documento de quienes participaron. Sin esto, la copia los muestra
						sólo por documento.
					</span>
				</span>
			</label>

			<div class="admin-campo cursos-confirmar">
				<label for="confirmar-copia">Para confirmar, escribí el nombre del curso</label>
				<input
					id="confirmar-copia"
					name="confirmacion"
					type="text"
					autocomplete="off"
					placeholder={curso.nombre}
					bind:value={confirmacionCopia}
					oninput={() => (copiaCorregida = true)}
					aria-invalid={Boolean(errorDeLaCopia)}
				/>
				{#if errorDeLaCopia}
					<p class="campo-error"><Icono nombre="error" tamano={16} />{errorDeLaCopia}</p>
				{/if}
			</div>

			<p class="cursos-dialogo-nota">
				Es una foto del curso tal como está hoy: si después se corrige algo acá, allá no cambia.
				{#if institucionElegida}
					La copia queda en «{institucionElegida}», que la ve con su propia clave.
				{/if}
			</p>

			<div class="cursos-dialogo-botones">
				<button class="boton secundario neutro" type="button" onclick={cerrar} disabled={trabajando !== null}>
					Cancelar
				</button>
				<button class="boton enviar" type="submit" disabled={trabajando !== null}>
					{trabajando === 'entregarCopia' ? 'Copiando…' : 'Entregar la copia'}
				</button>
			</div>
		</form>
	</div>
{/if}

{#if eliminando}
	<div class="admin-velo" role="presentation" onclick={cerrar}></div>
	<div class="admin-dialogo" role="alertdialog" aria-modal="true" aria-labelledby="eliminar-titulo">
		<span class="admin-asa" aria-hidden="true"></span>
		<h2 id="eliminar-titulo">¿Eliminar el curso «{curso.nombre}»?</h2>
		<p>
			{data.mesas.length > 0
				? `Se van con él ${data.mesas.length === 1 ? 'su mesa' : `sus ${data.mesas.length} mesas`}, ${cuantos(ciclos, 'ciclo', 'ciclos')} y ${cuantos(evaluaciones, 'evaluación enviada', 'evaluaciones enviadas')}. No se puede deshacer.`
				: 'Todavía no tiene mesas. No se puede deshacer.'}
		</p>
		{#if data.mesas.length > 0}
			<p class="cursos-se-van">
				<span><strong>{data.mesas.length}</strong>{data.mesas.length === 1 ? 'mesa' : 'mesas'}</span>
				<span><strong>{ciclos}</strong>{ciclos === 1 ? 'ciclo' : 'ciclos'}</span>
				<span><strong>{evaluaciones}</strong>{evaluaciones === 1 ? 'evaluación' : 'evaluaciones'}</span>
			</p>
		{/if}
		<p class="cursos-dialogo-nota">
			Pensado para cursos de prueba. Si la edición terminó, archivala: sus mesas se siguen consultando.
		</p>
		<form method="POST" action="?/eliminarCurso" novalidate use:enhance={enviar('eliminarCurso')}>
			<div class="admin-campo cursos-confirmar">
				<label for="confirmar-curso">Para confirmar, escribí el nombre del curso</label>
				<input
					id="confirmar-curso"
					name="confirmacion"
					type="text"
					autocomplete="off"
					placeholder={curso.nombre}
					bind:value={confirmacion}
					oninput={() => (confirmacionCorregida = true)}
					aria-invalid={Boolean(errorDeConfirmacion)}
				/>
				{#if errorDeConfirmacion}
					<p class="campo-error"><Icono nombre="error" tamano={16} />{errorDeConfirmacion}</p>
				{/if}
			</div>
			<div class="cursos-dialogo-botones">
				<button class="boton secundario neutro" type="button" onclick={cerrar} disabled={trabajando !== null}>
					Cancelar
				</button>
				<button class="boton peligro" type="submit" disabled={trabajando !== null}>
					{trabajando ? 'Eliminando…' : 'Eliminar el curso'}
				</button>
			</div>
		</form>
	</div>
{/if}
