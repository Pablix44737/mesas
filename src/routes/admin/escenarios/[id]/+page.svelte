<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import Icono from '$lib/Icono.svelte';
	import {
		EXTENSIONES_ACEPTADAS,
		TAMANO_MAXIMO,
		mostrarTamano,
		tipoAceptado
	} from '$lib/planificacion';

	let { data, form } = $props();

	type Accion = 'renombrar' | 'checklist' | 'adjuntar' | 'quitarPlanificacion' | 'eliminar';
	type Dialogo = 'quitarPlanificacion' | 'eliminar';

	/** Qué formulario mandó la última respuesta del servidor, para mostrarla en su lugar. */
	let accion = $state<Accion | null>(null);
	let trabajando = $state<Accion | null>(null);
	let dialogo = $state<Dialogo | null>(null);
	let avisoCerrado = $state(false);

	const escenario = $derived(data.escenario);
	const respuestaDe = (de: Accion) => (form?.mensaje && accion === de ? form.mensaje : null);

	/* --- renombrar --- */

	/** Sin JavaScript un rechazo vuelve con la página entera: el campo se reabre con lo escrito. */
	let renombrando = $state(untrack(() => Boolean(form?.renombrando)));
	let nombre = $state(untrack(() => (form?.renombrando ? (form.nombre ?? '') : '')));
	let errorNombre = $state<string | null>(null);
	let nombreCorregido = $state(false);

	const errorDelNombre = $derived(
		errorNombre ?? (form?.renombrando && !nombreCorregido ? form.mensaje : null)
	);

	async function renombrar() {
		renombrando = true;
		nombre = escenario.nombre;
		errorNombre = null;
		nombreCorregido = true;
		await tick();
		document.getElementById('nombre-escenario')?.focus();
	}

	/* --- checklist de la técnica --- */

	let cambiandoChecklist = $state(false);
	const actual = $derived(escenario.checklist_tecnica_id ?? '');
	let elegido = $state(untrack(() => data.escenario.checklist_tecnica_id ?? ''));
	const asociado = $derived(data.plantillasDeTecnica.find((p) => p.id === actual) ?? null);
	const eligiendo = $derived(
		data.plantillasDeTecnica.length > 0 && (cambiandoChecklist || !asociado)
	);
	const otroChecklist = $derived(eligiendo && elegido !== actual);
	const detalleDe = (plantilla: { items: number; ponderado: boolean }) =>
		`${plantilla.items} ${plantilla.items === 1 ? 'ítem' : 'ítems'}${plantilla.ponderado ? ' · ponderado' : ''}`;

	/* --- planificación --- */

	let archivo = $state<File | null>(null);
	let errorArchivo = $state<string | null>(null);
	let arrastrando = $state(false);

	const revisarArchivo = (elegido: File) =>
		!tipoAceptado(elegido.type, elegido.name)
			? 'La planificación tiene que ser un PDF o un documento Word.'
			: elegido.size > TAMANO_MAXIMO
				? 'El archivo supera los 20 MB.'
				: null;

	function elegirArchivo(elegido: File | undefined) {
		arrastrando = false;
		if (!elegido) return;
		archivo = elegido;
		errorArchivo = revisarArchivo(elegido);
		if (accion === 'adjuntar') accion = null;
	}

	const errorDelArchivo = $derived(errorArchivo ?? respuestaDe('adjuntar'));
	const subidaEn = $derived(
		escenario.planificacion_subida_en
			? new Date(escenario.planificacion_subida_en)
					.toLocaleString('es-AR', {
						dateStyle: 'short',
						timeStyle: 'short',
						hour12: false
					})
					.replace(',', '')
			: null
	);

	/* --- qué falta y qué se destaca --- */

	const conChecklist = $derived(actual !== '');
	const falta = $derived(
		!conChecklist && !escenario.planificacion_archivo
			? 'Faltan el checklist y la planificación'
			: !conChecklist
				? 'Falta el checklist de la técnica'
				: !escenario.planificacion_archivo
					? 'Falta la planificación'
					: null
	);
	/** Una sola acción verde: la de lo que se está haciendo. */
	const principal = $derived<Accion | null>(
		renombrando
			? 'renombrar'
			: otroChecklist
				? 'checklist'
				: archivo && !errorArchivo
					? 'adjuntar'
					: null
	);

	/** El resultado de lo último, cuando no se muestra ya junto a lo que lo produjo. */
	const aviso = $derived.by(() => {
		if (avisoCerrado || dialogo) return null;
		if (form?.exito) return { exito: true, texto: form.exito };
		if (!form?.mensaje || form.renombrando) return null;
		if (accion === 'adjuntar' || (accion === 'checklist' && eligiendo)) return null;
		return { exito: false, texto: form.mensaje };
	});

	/* --- enviar --- */

	async function abrirDialogo(cual: Dialogo) {
		dialogo = cual;
		if (accion === cual) accion = null;
		await tick();
		document.querySelector<HTMLElement>('[data-enfocar]')?.focus();
	}

	function cerrar() {
		if (trabajando) return;
		if (dialogo) {
			// Si falló, el error ya se leyó en el diálogo: no vuelve como aviso.
			dialogo = null;
			avisoCerrado = true;
		}
		else if (renombrando) renombrando = false;
	}

	const enviar =
		(de: Accion, antes?: (datos: FormData) => boolean): SubmitFunction =>
		({ formData, cancel }) => {
			if (antes && !antes(formData)) {
				cancel();
				return;
			}
			accion = de;
			trabajando = de;
			avisoCerrado = false;
			if (de === 'renombrar') nombreCorregido = false;
			return async ({ result, update }) => {
				await update({ reset: false });
				trabajando = null;
				if (result.type !== 'success') return;
				if (de === 'renombrar') renombrando = false;
				if (de === 'checklist') {
					cambiandoChecklist = false;
					elegido = data.escenario.checklist_tecnica_id ?? '';
				}
				if (de === 'adjuntar') archivo = null;
				dialogo = null;
				window.scrollTo({ top: 0 });
			};
		};

	const revisarNombre = () => {
		if (nombre.trim().length < 3) errorNombre = 'El nombre no puede quedar vacío.';
		if (errorNombre) document.getElementById('nombre-escenario')?.focus();
		return !errorNombre;
	};

	const prepararArchivo = (datos: FormData) => {
		if (!archivo) errorArchivo = 'Elegí un archivo para adjuntar.';
		if (errorArchivo) return false;
		// Elegido o soltado: el que se ve es el que se manda.
		datos.set('planificacion', archivo as File);
		return true;
	};
</script>

<svelte:head>
	<title>{escenario.nombre} — SIMUNaM</title>
</svelte:head>

<svelte:window onkeydown={(evento) => evento.key === 'Escape' && cerrar()} />

<div class="admin-encabezado">
	<div class="admin-ficha">
		<a class="mesa-volver" href="/admin/escenarios">
			<Icono nombre="atras" tamano={18} />
			Todos los escenarios
		</a>

		{#if renombrando}
			<form
				class="admin-renombrar"
				method="POST"
				action="?/renombrar"
				novalidate
				use:enhance={enviar('renombrar', revisarNombre)}
			>
				<div class="admin-campo">
					<label for="nombre-escenario">Nombre del escenario</label>
					<input
						id="nombre-escenario"
						name="nombre"
						type="text"
						autocomplete="off"
						bind:value={nombre}
						oninput={() => {
							errorNombre = null;
							nombreCorregido = true;
						}}
						aria-invalid={Boolean(errorDelNombre)}
						aria-describedby={errorDelNombre ? 'error-nombre' : undefined}
					/>
					{#if errorDelNombre}
						<p class="campo-error" id="error-nombre">
							<Icono nombre="error" tamano={16} />{errorDelNombre}
						</p>
					{:else if data.mesasQueLoPractican > 0}
						<p class="ayuda">
							{data.mesasQueLoPractican === 1
								? 'La mesa que lo practica va a mostrar el nombre nuevo.'
								: `Las ${data.mesasQueLoPractican} mesas que lo practican van a mostrar el nombre nuevo.`}
						</p>
					{/if}
				</div>
				<div class="admin-renombrar-botones">
					<button class="boton enviar" type="submit" disabled={trabajando === 'renombrar'}>
						{trabajando === 'renombrar' ? 'Guardando…' : 'Guardar'}
					</button>
					<button
						class="boton secundario neutro"
						type="button"
						onclick={() => (renombrando = false)}
						disabled={trabajando === 'renombrar'}
					>
						Cancelar
					</button>
				</div>
			</form>
		{:else}
			<div class="admin-ficha-titulo">
				<h1>{escenario.nombre}</h1>
				<button class="boton secundario neutro" type="button" aria-label="Renombrar" onclick={renombrar}>
					<Icono nombre="editar" tamano={18} />
					<span class="solo-ancho">Renombrar</span>
				</button>
			</div>
		{/if}

		<p class="admin-ficha-bajada">Checklist de la técnica y planificación</p>
		<div class="admin-ficha-estados">
			{#if falta}
				<span class="admin-pastilla falta"><Icono nombre="exclamacion" tamano={14} grosor={2.5} />{falta}</span>
			{:else}
				<span class="admin-pastilla listo"><Icono nombre="tilde" tamano={14} grosor={2.5} />Listo para las mesas</span>
			{/if}
			{#if data.mesasQueLoPractican > 0}
				<span class="admin-total">
					{data.mesasQueLoPractican === 1
						? 'Lo practica 1 mesa'
						: `Lo practican ${data.mesasQueLoPractican} mesas`}
				</span>
			{/if}
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

	<div class="escenario-rejilla">
		<section class="mesa-tarjeta escenario-parte" aria-labelledby="checklist-titulo">
			<div class="escenario-parte-cabecera">
				<div>
					<h2 id="checklist-titulo">Checklist de la técnica</h2>
					<p>Lo completa el Observador de la técnica en cada ciclo.</p>
				</div>
				<span class="admin-pastilla" class:listo={conChecklist} class:falta={!conChecklist}>
					<Icono nombre={conChecklist ? 'tilde' : 'exclamacion'} tamano={14} grosor={2.5} />
					{conChecklist ? 'Listo' : 'Falta'}
				</span>
			</div>

			{#if data.plantillasDeTecnica.length === 0}
				<p class="admin-advertencia">
					<Icono nombre="alerta" />
					<span>
						Todavía no hay checklists de la técnica terminados. Creá uno para poder asociarlo.
						<a href="/admin/checklists">Ir a Checklists</a>
					</span>
				</p>
			{:else if !eligiendo && asociado}
				<div class="escenario-elegido">
					<span class="escenario-elegido-icono"><Icono nombre="checklist" /></span>
					<div>
						<strong>{asociado.nombre}</strong>
						<span>{detalleDe(asociado)}</span>
					</div>
				</div>
				<div class="escenario-botones">
					<button
						class="boton secundario"
						type="button"
						onclick={() => {
							cambiandoChecklist = true;
							elegido = actual;
						}}
					>
						Cambiar
					</button>
					<a class="admin-enlace" href="/admin/checklists/{asociado.id}">
						Ver el checklist
						<Icono nombre="adelante" tamano={18} />
					</a>
				</div>
			{:else}
				<form
					method="POST"
					action="?/asociarChecklist"
					use:enhance={enviar('checklist')}
				>
					<fieldset class="admin-opciones">
						<legend>Elegí el checklist</legend>
						{#each data.plantillasDeTecnica as plantilla (plantilla.id)}
							<label class="admin-opcion">
								<input type="radio" name="plantillaId" value={plantilla.id} bind:group={elegido} />
								<span>
									<strong>{plantilla.nombre}</strong>
									<span>{detalleDe(plantilla)}</span>
								</span>
							</label>
						{/each}
						<label class="admin-opcion">
							<input type="radio" name="plantillaId" value="" bind:group={elegido} />
							<span>
								<strong>Sin checklist de la técnica</strong>
								<span>El Observador de la técnica no va a tener qué completar.</span>
							</span>
						</label>
					</fieldset>
					{#if respuestaDe('checklist')}
						<p class="campo-error"><Icono nombre="error" tamano={16} />{respuestaDe('checklist')}</p>
					{/if}
					<div class="escenario-botones">
						<button
							class="boton {principal === 'checklist' ? 'enviar' : 'secundario'}"
							type="submit"
							disabled={trabajando === 'checklist'}
						>
							{trabajando === 'checklist' ? 'Guardando…' : 'Guardar el checklist'}
						</button>
						{#if asociado}
							<button
								class="boton secundario neutro"
								type="button"
								onclick={() => (cambiandoChecklist = false)}
								disabled={trabajando === 'checklist'}
							>
								Cancelar
							</button>
						{/if}
					</div>
				</form>
			{/if}
		</section>

		<section class="mesa-tarjeta escenario-parte" aria-labelledby="planificacion-titulo">
			<div class="escenario-parte-cabecera">
				<div>
					<h2 id="planificacion-titulo">Planificación</h2>
					<p>La ve el facilitador de la mesa.</p>
				</div>
				<span
					class="admin-pastilla"
					class:listo={escenario.planificacion_archivo}
					class:falta={!escenario.planificacion_archivo}
				>
					<Icono
						nombre={escenario.planificacion_archivo ? 'tilde' : 'exclamacion'}
						tamano={14}
						grosor={2.5}
					/>
					{escenario.planificacion_archivo ? 'Listo' : 'Falta'}
				</span>
			</div>

			{#if escenario.planificacion_archivo}
				<div>
					<div class="escenario-elegido">
						<span class="escenario-elegido-icono"><Icono nombre="planificacion" /></span>
						<div>
							<a href="/admin/escenarios/{escenario.id}/planificacion" target="_blank" rel="noopener">
								{escenario.planificacion_archivo}
								<Icono nombre="externo" tamano={16} />
							</a>
							<span>
								{mostrarTamano(escenario.planificacion_tamano ?? 0)} · adjuntada el {subidaEn}
							</span>
						</div>
					</div>
					<button
						class="admin-quitar"
						type="button"
						onclick={() => abrirDialogo('quitarPlanificacion')}
					>
						<Icono nombre="quitar" tamano={18} />
						Quitar la planificación
					</button>
				</div>
			{:else}
				<p class="admin-advertencia">
					<Icono nombre="alerta" />
					<span>Este escenario todavía no tiene planificación adjunta.</span>
				</p>
			{/if}

			<form
				class="escenario-adjuntar"
				method="POST"
				action="?/adjuntarPlanificacion"
				enctype="multipart/form-data"
				novalidate
				use:enhance={enviar('adjuntar', prepararArchivo)}
			>
				<div class="escenario-adjuntar-rotulo">
					<strong>
						{escenario.planificacion_archivo ? 'Reemplazar por otro archivo' : 'Adjuntar un archivo'}
					</strong>
					<span>
						PDF o documento Word, hasta 20 MB.{escenario.planificacion_archivo
							? ' El nuevo reemplaza al anterior.'
							: ''}
					</span>
				</div>

				<!-- Sin JavaScript se manda tal cual; con él, el que se ve elegido. -->
				<label
					class="admin-soltar escenario-soltar"
					class:arrastrando
					class:con-error={errorDelArchivo && !archivo}
					hidden={Boolean(archivo)}
					ondragover={(evento) => {
						evento.preventDefault();
						arrastrando = true;
					}}
					ondragleave={() => (arrastrando = false)}
					ondrop={(evento) => {
						evento.preventDefault();
						elegirArchivo(evento.dataTransfer?.files[0]);
					}}
				>
					<input
						class="visualmente-oculto"
						name="planificacion"
						type="file"
						accept={EXTENSIONES_ACEPTADAS.join(',')}
						onchange={(evento) => {
							elegirArchivo(evento.currentTarget.files?.[0]);
							evento.currentTarget.value = '';
						}}
					/>
					<span class="evaluado-vacio-icono"><Icono nombre="subir" tamano={22} /></span>
					<strong>
						<span class="solo-ancho">Arrastrá el archivo o <u>elegilo</u></span>
						<span class="solo-angosto">Elegí el archivo</span>
					</strong>
				</label>

				{#if archivo}
					<div class="escenario-archivo" class:con-error={errorDelArchivo}>
						<span class="escenario-elegido-icono"><Icono nombre="planificacion" /></span>
						<div>
							<strong>{archivo.name}</strong>
							<span>{mostrarTamano(archivo.size)}</span>
						</div>
						<button
							class="admin-cerrar"
							type="button"
							aria-label="Elegir otro archivo"
							title="Elegir otro archivo"
							onclick={() => {
								archivo = null;
								errorArchivo = null;
							}}
							disabled={trabajando === 'adjuntar'}
						>
							<Icono nombre="cerrar" tamano={20} />
						</button>
					</div>
				{/if}

				{#if errorDelArchivo}
					<p class="campo-error" role="alert"><Icono nombre="error" tamano={16} />{errorDelArchivo}</p>
				{/if}

				<button
					class="boton {principal === 'adjuntar' ? 'enviar' : 'secundario'}"
					type="submit"
					disabled={trabajando === 'adjuntar'}
				>
					<Icono nombre="subir" tamano={20} />
					{trabajando === 'adjuntar' ? 'Subiendo…' : 'Adjuntar la planificación'}
				</button>
			</form>
		</section>
	</div>

	<section class="admin-eliminar" aria-label="Eliminar el escenario">
		{#if data.mesasQueLoPractican === 0}
			<div>
				<strong>Eliminar el escenario</strong>
				<span>Ninguna mesa lo practica. No se puede deshacer.</span>
			</div>
			<button class="boton secundario" type="button" onclick={() => abrirDialogo('eliminar')}>
				<Icono nombre="quitar" tamano={18} />
				Eliminar el escenario
			</button>
		{:else}
			<Icono nombre="candado" tamano={18} />
			<p>
				Este escenario no se puede eliminar porque {data.mesasQueLoPractican === 1
					? 'hay una mesa que lo practica'
					: `hay ${data.mesasQueLoPractican} mesas que lo practican`}. Eliminá primero esas mesas.
			</p>
		{/if}
	</section>
</div>

{#if dialogo}
	<div class="admin-velo" role="presentation" onclick={cerrar}></div>
	<div class="admin-dialogo" role="alertdialog" aria-modal="true" aria-labelledby="dialogo-titulo">
		<span class="admin-asa" aria-hidden="true"></span>
		{#if dialogo === 'eliminar'}
			<h2 id="dialogo-titulo">¿Eliminar el escenario «{escenario.nombre}»?</h2>
			<p>No se puede deshacer. Se va con él su planificación adjunta.</p>
		{:else}
			<h2 id="dialogo-titulo">¿Quitar la planificación?</h2>
			<p>El facilitador de la mesa va a dejar de verla. Después podés adjuntar otra.</p>
		{/if}
		{#if respuestaDe(dialogo)}
			<p class="dialogo-error" role="alert">
				<Icono nombre="error" tamano={18} />{respuestaDe(dialogo)}
			</p>
		{/if}
		<form
			method="POST"
			action={dialogo === 'eliminar' ? '?/eliminar' : '?/quitarPlanificacion'}
			use:enhance={enviar(dialogo)}
		>
			<button
				class="boton secundario neutro"
				type="button"
				onclick={cerrar}
				disabled={trabajando !== null}
				data-enfocar
			>
				Cancelar
			</button>
			<button class="boton peligro" type="submit" disabled={trabajando !== null}>
				{#if dialogo === 'eliminar'}
					{trabajando ? 'Eliminando…' : 'Sí, eliminarlo'}
				{:else}
					{trabajando ? 'Quitando…' : 'Sí, quitar la planificación'}
				{/if}
			</button>
		</form>
	</div>
{/if}
