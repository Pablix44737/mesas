<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import Icono from '$lib/Icono.svelte';
	import { dniValido, mostrarDni, normalizarDni } from '$lib/dni';
	import {
		EXTENSIONES_DEL_LISTADO,
		leerListado,
		type FilaConError,
		type PersonaLeida
	} from '$lib/importar-padron';

	let { data, form } = $props();

	type Persona = (typeof data.padron)[number];
	type Accion = 'incorporar' | 'editar' | 'quitar' | 'importar';

	/** Lo que está abierto encima de la lista: un formulario, la importación o la confirmación de quitar. */
	let panel = $state<Accion | null>(null);
	let editandoId = $state<string | null>(null);
	let quitandoId = $state<string | null>(null);
	/** El DNI sin resolver desde el que se abrió el alta, para mostrar dónde lo usaron. */
	let desdeDni = $state<string | null>(null);
	let campos = $state({ dni: '', nombre: '', apellido: '' });
	/** Lo que no pasó la revisión antes de mandar. */
	let errores = $state<Record<string, string>>({});
	/** Los campos tocados después del último envío: su error del servidor ya no aplica. */
	let corregidos = $state<Record<string, boolean>>({});
	let trabajando = $state(false);
	/** Qué formulario mandó la última respuesta del servidor, para mostrarla en su lugar. */
	let accion = $state<Accion | null>(null);
	let avisoCerrado = $state(false);

	const editada = $derived(data.padron.find((persona) => persona.id === editandoId) ?? null);
	const aQuitar = $derived(data.padron.find((persona) => persona.id === quitandoId) ?? null);
	const origen = $derived(
		panel === 'incorporar' && desdeDni ? data.pendientes.find((p) => p.dni === desdeDni) : undefined
	);

	const respuestaDe = (de: Accion) => (form?.mensaje && accion === de ? form : null);
	const errorDe = (campo: string) => {
		if (errores[campo]) return errores[campo];
		const respuesta = panel === 'incorporar' || panel === 'editar' ? respuestaDe(panel) : null;
		return respuesta?.campo === campo && !corregidos[campo] ? respuesta.mensaje : null;
	};
	const errorDelPanel = $derived(panel ? (respuestaDe(panel)?.campo ? null : respuestaDe(panel)?.mensaje) : null);
	const aviso = $derived(
		avisoCerrado || panel
			? null
			: form?.exito
				? { exito: true, texto: form.exito }
				: form?.mensaje && !form.campo
					? { exito: false, texto: form.mensaje }
					: null
	);

	const cifra = (n: number) => n.toLocaleString('es-AR');
	const roles = (n: number) => (n === 1 ? '1 rol' : `${cifra(n)} roles`);

	/* --- buscar --- */

	let busqueda = $state('');
	/** La lista se muestra de a tandas: con 2000 personas, todas juntas no ayudan. */
	let limite = $state(100);

	/** Sin mayúsculas ni tildes: en el padrón hay Núñez, Peña, Ramírez. */
	const aplanar = (texto: string) =>
		texto
			.toLowerCase()
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '');

	const termino = $derived(busqueda.trim());
	const encontradas = $derived.by(() => {
		const buscado = aplanar(termino);
		if (!buscado) return data.padron;

		// Cada palabra tiene que aparecer en alguna parte, en cualquier orden: así
		// «miriam acuña» encuentra a «Acuña, Miriam Elizabeth». Los dígitos van
		// contra el DNI, tolerando los puntos.
		const palabras = buscado.split(/[\s,]+/).filter(Boolean);
		return data.padron.filter((persona) => {
			const comoSeLlama = aplanar(`${persona.apellido} ${persona.nombre}`);
			return palabras.every((palabra) => {
				const digitos = palabra.replace(/\D/g, '');
				return comoSeLlama.includes(palabra) || (digitos !== '' && persona.dni.includes(digitos));
			});
		});
	});
	const visibles = $derived(encontradas.slice(0, limite));
	const dniBuscado = $derived(/^[\d.\s]+$/.test(termino) ? normalizarDni(termino) : '');

	/* --- abrir y cerrar --- */

	async function abrir(cual: Accion) {
		panel = cual;
		// El mensaje de la acción anterior ya se leyó: no vuelve al cerrar el panel.
		avisoCerrado = true;
		errores = {};
		corregidos = {};
		trabajando = false;
		await tick();
		document.querySelector<HTMLElement>('[data-enfocar]')?.focus();
	}

	function incorporar(dni = '', desde: string | null = null) {
		campos = { dni, nombre: '', apellido: '' };
		desdeDni = desde;
		abrir('incorporar');
	}

	function editar(persona: Persona) {
		editandoId = persona.id;
		campos = { dni: persona.dni, nombre: persona.nombre, apellido: persona.apellido };
		abrir('editar');
	}

	function quitar(persona: Persona) {
		quitandoId = persona.id;
		abrir('quitar');
	}

	function importar() {
		descartarListado();
		abrir('importar');
	}

	function cerrar() {
		if (trabajando) return;
		panel = null;
	}

	function escribir(campo: 'dni' | 'nombre' | 'apellido') {
		return (evento: Event & { currentTarget: HTMLInputElement }) => {
			campos[campo] = evento.currentTarget.value;
			delete errores[campo];
			corregidos[campo] = true;
		};
	}

	/* --- incorporar y editar --- */

	const dniNuevo = $derived(normalizarDni(campos.dni));
	const cambiaElDni = $derived(
		panel === 'editar' && editada !== null && dniValido(dniNuevo) && dniNuevo !== editada.dni
	);
	const esperando = $derived(cambiaElDni ? data.pendientes.find((p) => p.dni === dniNuevo) : undefined);

	/** Lo que se puede revisar sin preguntarle al servidor, todo junto. */
	function revisar() {
		const faltan: Record<string, string> = {};
		if (!dniValido(dniNuevo)) faltan.dni = 'Ingresá un DNI de 6 a 9 números.';
		else {
			const otra = data.padron.find((p) => p.dni === dniNuevo && p.id !== editandoId);
			if (otra) {
				faltan.dni =
					panel === 'editar'
						? `El DNI ${mostrarDni(dniNuevo)} ya es de otra persona del padrón.`
						: `El DNI ${mostrarDni(dniNuevo)} ya está en el padrón.`;
			}
		}
		if (campos.nombre.trim().length < 2) faltan.nombre = 'Ingresá el nombre.';
		if (campos.apellido.trim().length < 2) faltan.apellido = 'Ingresá el apellido.';
		return faltan;
	}

	/** Todos los envíos: quedan abiertos si el servidor rechaza, se cierran si sale bien. */
	const enviar =
		(de: Accion, validar = false): SubmitFunction =>
		({ cancel }) => {
			if (validar) {
				errores = revisar();
				const primero = Object.keys(errores)[0];
				if (primero) {
					cancel();
					document.getElementById(`campo-${primero}`)?.focus();
					return;
				}
			}
			accion = de;
			trabajando = true;
			avisoCerrado = false;
			return async ({ result, update }) => {
				await update({ reset: false });
				trabajando = false;
				corregidos = {};
				if (result.type === 'success') {
					panel = null;
					busqueda = '';
					descartarListado();
					window.scrollTo({ top: 0 });
				}
			};
		};

	/* --- importar un listado --- */

	let leyendo = $state(false);
	let archivoLeido = $state('');
	let fallaDelListado = $state<string | null>(null);
	let listado = $state<{
		archivo: string;
		personas: PersonaLeida[];
		errores: FilaConError[];
	} | null>(null);
	let todasLasNuevas = $state(false);
	let todosLosErrores = $state(false);
	let arrastrando = $state(false);

	const enElPadron = $derived(new Set(data.padron.map((persona) => persona.dni)));
	const nuevas = $derived(listado?.personas.filter((p) => !enElPadron.has(p.dni)) ?? []);
	const yaCargadas = $derived((listado?.personas.length ?? 0) - nuevas.length);

	async function leer(archivo: File | undefined) {
		if (!archivo) return;
		leyendo = true;
		archivoLeido = archivo.name;
		fallaDelListado = null;
		listado = null;
		accion = null;
		try {
			const lectura = await leerListado(archivo);
			if ('falla' in lectura) {
				fallaDelListado = lectura.falla;
			} else {
				listado = { archivo: archivo.name, ...lectura };
				todasLasNuevas = false;
				todosLosErrores = false;
			}
		} catch {
			fallaDelListado = 'No se pudo leer el archivo. Probá guardarlo de nuevo como .xlsx o .csv.';
		} finally {
			leyendo = false;
		}
	}

	function elegirListado(evento: Event & { currentTarget: HTMLInputElement }) {
		const campo = evento.currentTarget;
		leer(campo.files?.[0]).then(() => {
			// Así se puede volver a elegir el mismo archivo después de corregirlo.
			campo.value = '';
		});
	}

	function soltar(evento: DragEvent) {
		evento.preventDefault();
		arrastrando = false;
		leer(evento.dataTransfer?.files?.[0]);
	}

	function descartarListado() {
		listado = null;
		fallaDelListado = null;
		leyendo = false;
	}

	/** Lo mínimo para que alguien arme su planilla sin adivinar las columnas. */
	const planillaDeEjemplo =
		'data:text/csv;charset=utf-8,' +
		encodeURIComponent('﻿DNI;Apellido;Nombre\r\n30111222;Pérez;Juan\r\n');

	function teclas(evento: KeyboardEvent) {
		if (evento.key === 'Escape' && panel) cerrar();
	}
</script>

<svelte:head>
	<title>Padrón — SIMUNaM</title>
</svelte:head>

<svelte:window onkeydown={teclas} />

{#snippet errorDeCampo(campo: string)}
	{#if errorDe(campo)}
		<p class="campo-error" id="error-{campo}"><Icono nombre="error" tamano={16} />{errorDe(campo)}</p>
	{/if}
{/snippet}

{#snippet botonCerrar()}
	<button class="admin-cerrar" type="button" aria-label="Cerrar" onclick={cerrar}>
		<Icono nombre="cerrar" tamano={20} />
	</button>
{/snippet}

<div class="admin-encabezado">
	<div class="admin-encabezado-dentro">
		<div class="admin-titulo">
			<div>
				<h1>Padrón</h1>
				<span class="admin-total">
					{cifra(data.padron.length)}
					{data.padron.length === 1 ? 'persona' : 'personas'}
				</span>
			</div>
			<p>Las personas que pueden participar en las mesas, identificadas por su DNI.</p>
		</div>
		<div class="admin-acciones-encabezado">
			<button class="boton secundario" type="button" onclick={importar}>
				<Icono nombre="subir" tamano={20} />
				<span class="solo-ancho">Importar un listado</span>
				<span class="solo-angosto">Importar</span>
			</button>
			<button class="boton enviar" type="button" onclick={() => incorporar()}>
				<Icono nombre="mas" tamano={20} grosor={2.25} />
				Incorporar
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

	<div class="padron-rejilla" class:con-pendientes={data.pendientes.length > 0}>
		{#if data.pendientes.length > 0}
			<aside class="padron-pendientes" aria-labelledby="pendientes-titulo">
				<div class="padron-pendientes-cabecera">
					<div>
						<Icono nombre="alerta" />
						<h2 id="pendientes-titulo">DNI sin resolver</h2>
						<span>{data.pendientes.length}</span>
					</div>
					<p>
						Ocuparon un rol en alguna mesa, pero no están en el padrón. Incorporalos o, si el DNI se
						escribió mal, dalo de baja desde la mesa.
					</p>
				</div>
				{#each data.pendientes as pendiente (pendiente.dni)}
					<div class="padron-pendiente">
						<div class="padron-pendiente-fila">
							<div>
								<strong>{mostrarDni(pendiente.dni)}</strong>
								<span>Ocupó {roles(pendiente.registros.length)}</span>
							</div>
							<button
								class="boton secundario"
								type="button"
								onclick={() => incorporar(pendiente.dni, pendiente.dni)}
							>
								Incorporar
							</button>
						</div>
						<ul>
							{#each pendiente.registros as registro (registro.ruta)}
								<li>
									<a href={registro.ruta}>
										<span>
											<strong>{registro.texto}</strong>
											<span>{registro.curso}</span>
										</span>
										<Icono nombre="adelante" tamano={18} />
									</a>
								</li>
							{/each}
						</ul>
					</div>
				{/each}
			</aside>
		{/if}

		<div class="padron-principal">
			{#if data.padron.length === 0}
				<section class="mesa-tarjeta padron-vacio">
					<span class="evaluado-vacio-icono"><Icono nombre="padron" tamano={24} /></span>
					<strong>El padrón está vacío.</strong>
					<p>Importá el listado del curso desde una planilla, o incorporá a las personas de a una.</p>
					<div>
						<button class="boton secundario" type="button" onclick={importar}>
							<Icono nombre="subir" tamano={20} />
							Importar un listado
						</button>
						<button class="boton secundario neutro" type="button" onclick={() => incorporar()}>
							<Icono nombre="mas" tamano={20} />
							Incorporar a una persona
						</button>
					</div>
				</section>
			{:else}
				<section class="padron-lista" aria-label="Personas del padrón">
					<div class="padron-lista-cabecera">
						<div class="padron-buscador">
							<label class="padron-buscar">
								<Icono nombre="buscar" />
								<input
									type="text"
									placeholder="Apellido, nombre o DNI"
									aria-label="Buscar en el padrón"
									autocomplete="off"
									bind:value={busqueda}
									oninput={() => (limite = 100)}
								/>
								{#if busqueda}
									<button
										type="button"
										aria-label="Borrar la búsqueda"
										onclick={() => {
											busqueda = '';
											limite = 100;
										}}
									>
										<Icono nombre="cerrar" tamano={18} />
									</button>
								{/if}
							</label>
							<span class="padron-cuenta" class:filtrando={termino}>
								{termino
									? `${cifra(encontradas.length)} de ${cifra(data.padron.length)}`
									: `${cifra(data.padron.length)} ${data.padron.length === 1 ? 'persona' : 'personas'}`}
							</span>
						</div>
						{#if visibles.length > 0}
							<div class="padron-columnas" aria-hidden="true">
								<span>DNI</span>
								<span>Apellido y nombre</span>
								<span>Roles en mesas</span>
								<span>Acciones</span>
							</div>
						{/if}
					</div>

					{#if encontradas.length === 0}
						<div class="padron-sin-coincidencias">
							<span class="evaluado-vacio-icono gris"><Icono nombre="buscar" tamano={24} /></span>
							<strong>Nadie del padrón coincide con «{termino}».</strong>
							{#if dniValido(dniBuscado)}
								<p>Si es alguien nuevo, incorporalo con ese DNI.</p>
								<button class="boton secundario" type="button" onclick={() => incorporar(dniBuscado)}>
									<Icono nombre="mas" tamano={20} />
									Incorporar ese DNI
								</button>
							{:else}
								<p>Probá con otra parte del nombre o con el DNI.</p>
							{/if}
						</div>
					{:else}
						<ul class="padron-filas">
							{#each visibles as persona (persona.id)}
								<li>
									<button
										class="padron-fila"
										type="button"
										aria-label="Editar a {persona.apellido}, {persona.nombre}"
										onclick={() => editar(persona)}
									>
										<span class="padron-fila-dni">{mostrarDni(persona.dni)}</span>
										<span class="padron-fila-nombre">{persona.apellido}, {persona.nombre}</span>
										<span class="padron-fila-roles">
											{persona.registros ? roles(persona.registros) : '—'}
										</span>
										<span class="padron-fila-meta">
											DNI {mostrarDni(persona.dni)} · {persona.registros
												? roles(persona.registros)
												: 'sin roles'}
										</span>
										<Icono nombre="adelante" tamano={18} clase="padron-fila-flecha" />
									</button>
									<span class="padron-fila-acciones">
										<button
											class="icono-boton"
											type="button"
											title="Editar"
											aria-label="Editar a {persona.apellido}, {persona.nombre}"
											onclick={() => editar(persona)}
										>
											<Icono nombre="editar" tamano={18} />
										</button>
										<button
											class="icono-boton peligroso"
											type="button"
											title="Quitar del padrón"
											aria-label="Quitar a {persona.apellido}, {persona.nombre} del padrón"
											onclick={() => quitar(persona)}
										>
											<Icono nombre="quitar" tamano={18} />
										</button>
									</span>
								</li>
							{/each}
						</ul>

						{#if encontradas.length > visibles.length}
							<div class="padron-mas">
								<span>
									Se muestran {cifra(visibles.length)} de {cifra(encontradas.length)}. Escribí en el
									buscador para acotar.
								</span>
								<button class="boton secundario neutro" type="button" onclick={() => (limite += 100)}>
									Mostrar {cifra(Math.min(100, encontradas.length - visibles.length))} más
								</button>
							</div>
						{/if}
					{/if}
				</section>
			{/if}
		</div>
	</div>
</div>

{#if panel}
	<div class="admin-velo" role="presentation" onclick={cerrar}></div>
{/if}

{#if panel === 'incorporar' || (panel === 'editar' && editada)}
	<div class="admin-panel" role="dialog" aria-modal="true" aria-labelledby="panel-titulo">
		<form
			class="admin-panel-formulario"
			method="POST"
			action={panel === 'editar' ? '?/editar' : '?/incorporar'}
			novalidate
			use:enhance={enviar(panel === 'editar' ? 'editar' : 'incorporar', true)}
		>
			<span class="admin-asa" aria-hidden="true"></span>
			<div class="admin-panel-cabecera">
				<div>
					<h2 id="panel-titulo">
						{panel === 'editar' ? 'Editar a una persona' : 'Incorporar a una persona'}
					</h2>
					<p>
						{#if panel === 'editar' && editada}
							{editada.apellido}, {editada.nombre} · {editada.registros
								? `${roles(editada.registros)} en las mesas`
								: 'sin roles en las mesas'}
						{:else if origen}
							Completá el nombre y el apellido de quien usó este DNI.
						{:else}
							Queda identificada en las mesas por su DNI.
						{/if}
					</p>
				</div>
				{@render botonCerrar()}
			</div>

			<div class="admin-panel-cuerpo">
				{#if panel === 'editar' && editada}
					<input type="hidden" name="id" value={editada.id} />
				{/if}

				{#if origen}
					<div class="padron-origen">
						<span>
							Ocupó {origen.registros.length === 1 ? 'este rol' : 'estos roles'} con el DNI
							{mostrarDni(origen.dni)}
						</span>
						{#each origen.registros as registro (registro.ruta)}
							<p><strong>{registro.texto}</strong><span>{registro.curso}</span></p>
						{/each}
					</div>
				{/if}

				{#if errorDelPanel}
					<p class="dialogo-error" role="alert"><Icono nombre="error" tamano={18} />{errorDelPanel}</p>
				{/if}

				<div class="admin-campo">
					<label for="campo-dni">DNI</label>
					<input
						id="campo-dni"
						class="padron-dni"
						name="dni"
						type="text"
						inputmode="numeric"
						autocomplete="off"
						value={campos.dni}
						oninput={escribir('dni')}
						aria-invalid={Boolean(errorDe('dni'))}
						aria-describedby={errorDe('dni') ? 'error-dni' : 'ayuda-dni'}
						data-enfocar={campos.dni === '' ? '' : undefined}
					/>
					{#if errorDe('dni')}
						{@render errorDeCampo('dni')}
					{:else}
						<p class="ayuda" id="ayuda-dni">Podés escribirlo con puntos o sin ellos.</p>
					{/if}
				</div>

				{#if cambiaElDni && editada && editada.registros > 0}
					<p class="padron-advertencia">
						<Icono nombre="alerta" />
						<span>Lo que registró con el DNI actual va a quedar sin identificar.</span>
					</p>
				{/if}
				{#if esperando}
					<p class="padron-advertencia">
						<Icono nombre="alerta" />
						<span>
							{esperando.registros.length === 1
								? 'Se le va a asignar el registro hecho con el DNI nuevo.'
								: `Se le van a asignar los ${esperando.registros.length} registros hechos con el DNI nuevo.`}
						</span>
					</p>
				{/if}

				<div class="admin-campo">
					<label for="campo-nombre">Nombre</label>
					<input
						id="campo-nombre"
						name="nombre"
						type="text"
						autocomplete="off"
						value={campos.nombre}
						oninput={escribir('nombre')}
						aria-invalid={Boolean(errorDe('nombre'))}
						aria-describedby={errorDe('nombre') ? 'error-nombre' : undefined}
						data-enfocar={campos.dni !== '' && panel === 'incorporar' ? '' : undefined}
					/>
					{@render errorDeCampo('nombre')}
				</div>

				<div class="admin-campo">
					<label for="campo-apellido">Apellido</label>
					<input
						id="campo-apellido"
						name="apellido"
						type="text"
						autocomplete="off"
						value={campos.apellido}
						oninput={escribir('apellido')}
						aria-invalid={Boolean(errorDe('apellido'))}
						aria-describedby={errorDe('apellido') ? 'error-apellido' : undefined}
					/>
					{@render errorDeCampo('apellido')}
				</div>

				{#if panel === 'editar' && editada}
					<div class="padron-quitar-desde-edicion">
						<button type="button" onclick={() => editada && quitar(editada)}>
							<Icono nombre="quitar" tamano={18} />
							Quitar del padrón
						</button>
					</div>
				{/if}
			</div>

			<div class="admin-panel-pie">
				<button class="boton secundario neutro" type="button" onclick={cerrar} disabled={trabajando}>
					Cancelar
				</button>
				<button class="boton enviar" type="submit" disabled={trabajando}>
					{#if panel === 'editar'}
						{trabajando ? 'Guardando…' : 'Guardar los cambios'}
					{:else}
						{trabajando ? 'Incorporando…' : 'Incorporar al padrón'}
					{/if}
				</button>
			</div>
		</form>
	</div>
{/if}

{#if panel === 'importar'}
	<div
		class="admin-panel ancho"
		role="dialog"
		aria-modal="true"
		aria-labelledby="importar-titulo"
	>
		<span class="admin-asa" aria-hidden="true"></span>
		<div class="admin-panel-cabecera">
			<div>
				<h2 id="importar-titulo">Importar un listado</h2>
				<p>
					{listado
						? 'Revisá el listado antes de incorporarlo.'
						: 'Incorporá a varias personas desde una planilla.'}
				</p>
			</div>
			{@render botonCerrar()}
		</div>

		<div class="admin-panel-cuerpo">
			{#if leyendo}
				<div class="padron-leyendo">
					<span class="evaluado-vacio-icono"><Icono nombre="subir" tamano={24} /></span>
					<strong>Leyendo el archivo…</strong>
					<span>{archivoLeido}</span>
				</div>
			{:else if !listado}
				{#if fallaDelListado}
					<p class="dialogo-error" role="alert"><Icono nombre="error" tamano={18} />{fallaDelListado}</p>
				{/if}
				<div
					class="admin-soltar"
					class:arrastrando
					role="presentation"
					ondragover={(evento) => {
						evento.preventDefault();
						arrastrando = true;
					}}
					ondragleave={() => (arrastrando = false)}
					ondrop={soltar}
				>
					<span class="evaluado-vacio-icono"><Icono nombre="subir" tamano={24} /></span>
					<strong>
						<span class="solo-ancho">Elegí la planilla o arrastrala hasta acá</span>
						<span class="solo-angosto">Elegí la planilla</span>
					</strong>
					<span>Excel (.xlsx, .xls), OpenDocument (.ods) o CSV. Hasta 2000 filas.</span>
					<label class="boton enviar">
						Elegir la planilla
						<input
							class="visualmente-oculto"
							type="file"
							accept={EXTENSIONES_DEL_LISTADO.join(',')}
							onchange={elegirListado}
							data-enfocar
						/>
					</label>
				</div>
				<div class="padron-requisitos">
					<p class="rotulo-chico">Qué tiene que tener</p>
					<p>
						Una columna para el DNI, otra para el apellido y otra para el nombre, en cualquier orden.
						También sirve una sola columna «Apellido y nombre», con una coma entre los dos: «Pérez,
						Juan».
					</p>
					<a href={planillaDeEjemplo} download="padron.csv">
						<Icono nombre="descargar" tamano={18} />
						Descargar una planilla de ejemplo
					</a>
				</div>
			{:else}
				{#if respuestaDe('importar')}
					<p class="dialogo-error" role="alert">
						<Icono nombre="error" tamano={18} />{respuestaDe('importar')?.mensaje}
					</p>
				{/if}

				<div class="padron-archivo">
					<span><Icono nombre="planificacion" tamano={20} /></span>
					<div>
						<strong>{listado.archivo}</strong>
						<span>{cifra(listado.personas.length + listado.errores.length)} filas leídas</span>
					</div>
				</div>

				<div class="padron-cifras">
					<div class="nuevas">
						<strong>{cifra(nuevas.length)}</strong>
						<span>para incorporar</span>
					</div>
					<div>
						<strong>{cifra(yaCargadas)}</strong>
						<span>ya en el padrón</span>
					</div>
					<div class="errores">
						<strong>{cifra(listado.errores.length)}</strong>
						<span>con errores</span>
					</div>
				</div>

				{#if listado.errores.length > 0}
					{@const filas = todosLosErrores ? listado.errores : listado.errores.slice(0, 5)}
					<section class="padron-seccion">
						<h3>Filas que no se van a incorporar</h3>
						<p>Corregilas en la planilla y volvé a elegirla, o incorporá a esas personas de a una.</p>
						<ul class="padron-filas-error">
							{#each filas as error (error.fila)}
								<li><span>Fila {error.fila}</span>{error.motivo}</li>
							{/each}
						</ul>
						{#if listado.errores.length > 5}
							<button
								class="padron-ver-mas"
								type="button"
								aria-expanded={todosLosErrores}
								onclick={() => (todosLosErrores = !todosLosErrores)}
							>
								{todosLosErrores ? 'Ver menos' : `Ver las ${cifra(listado.errores.length)}`}
							</button>
						{/if}
					</section>
				{/if}

				<section class="padron-seccion">
					<h3>Personas nuevas</h3>
					{#if nuevas.length > 0}
						{@const filas = todasLasNuevas ? nuevas : nuevas.slice(0, 8)}
						<div class="padron-nuevas">
							<div class="padron-nuevas-fila encabezado"><span>DNI</span><span>Apellido y nombre</span></div>
							{#each filas as persona (persona.dni)}
								<div class="padron-nuevas-fila">
									<span>{mostrarDni(persona.dni)}</span>
									<strong>{persona.apellido}, {persona.nombre}</strong>
								</div>
							{/each}
						</div>
						{#if nuevas.length > 8}
							<button
								class="padron-ver-mas"
								type="button"
								aria-expanded={todasLasNuevas}
								onclick={() => (todasLasNuevas = !todasLasNuevas)}
							>
								{todasLasNuevas ? 'Ver menos' : `Ver las ${cifra(nuevas.length)}`}
							</button>
						{/if}
					{:else}
						<p class="padron-nadie-nuevo">
							{listado.personas.length > 0
								? 'Todas las personas del archivo ya están en el padrón.'
								: 'No hay personas para incorporar.'}
						</p>
					{/if}
				</section>
			{/if}
		</div>

		{#if listado}
			<form class="admin-panel-pie" method="POST" action="?/importar" use:enhance={enviar('importar')}>
				<input
					type="hidden"
					name="personas"
					value={JSON.stringify(nuevas.map(({ dni, apellido, nombre }) => ({ dni, apellido, nombre })))}
				/>
				<button class="boton secundario neutro" type="button" onclick={descartarListado} disabled={trabajando}>
					Elegir otro archivo
				</button>
				{#if nuevas.length > 0}
					<button class="boton enviar" type="submit" disabled={trabajando}>
						{trabajando
							? 'Incorporando…'
							: nuevas.length === 1
								? 'Incorporar 1 persona'
								: `Incorporar ${cifra(nuevas.length)} personas`}
					</button>
				{/if}
			</form>
		{/if}
	</div>
{/if}

{#if panel === 'quitar' && aQuitar}
	<div class="admin-dialogo" role="alertdialog" aria-modal="true" aria-labelledby="quitar-titulo">
		<span class="admin-asa" aria-hidden="true"></span>
		<h2 id="quitar-titulo">¿Quitar a {aQuitar.apellido}, {aQuitar.nombre} del padrón?</h2>
		<p>
			{aQuitar.registros
				? `${aQuitar.apellido}, ${aQuitar.nombre} ocupó ${roles(aQuitar.registros)} en las mesas. Sus evaluaciones no se borran, pero quedan sin identificar.`
				: 'No ocupó ningún rol en las mesas. Si más adelante participa, va a aparecer entre los DNI sin resolver.'}
		</p>
		{#if respuestaDe('quitar')}
			<p class="dialogo-error" role="alert">
				<Icono nombre="error" tamano={18} />{respuestaDe('quitar')?.mensaje}
			</p>
		{/if}
		<form method="POST" action="?/quitar" use:enhance={enviar('quitar')}>
			<input type="hidden" name="id" value={aQuitar.id} />
			<button class="boton secundario neutro" type="button" onclick={cerrar} disabled={trabajando} data-enfocar>
				Cancelar
			</button>
			<button class="boton peligro" type="submit" disabled={trabajando}>
				{trabajando ? 'Quitando…' : 'Sí, quitar del padrón'}
			</button>
		</form>
	</div>
{/if}
