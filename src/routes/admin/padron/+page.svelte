<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import Icono from '$lib/Icono.svelte';
	import { mostrarDni } from '$lib/dni';
	import {
		EXTENSIONES_DEL_LISTADO,
		leerListado,
		type FilaConError,
		type PersonaLeida
	} from '$lib/importar-padron';

	let { data, form } = $props();

	let incorporando = $state(false);
	let guardando = $state(false);
	/** Id de la persona que se está por quitar, mientras se confirma. */
	let quitando = $state<string | null>(null);
	/**
	 * Fila abierta para editar, elegida a mano. Mientras valga `undefined` manda lo
	 * que devolvió el servidor: así una edición rechazada se reabre con lo tipeado
	 * aunque no haya JavaScript, y cancelar sigue cerrándola.
	 */
	let abiertaAMano = $state<string | null | undefined>(undefined);
	/** El DNI a medida que se tipea, para avisar antes de guardar qué implica cambiarlo. */
	let dniTipeado = $state<string | null>(null);

	const editando = $derived(abiertaAMano === undefined ? (form?.editando ?? null) : abiertaAMano);
	const dniEnEdicion = $derived(dniTipeado ?? (form?.editando ? (form.dni ?? '') : ''));

	/** Los valores del alta no son los de una edición, aunque compartan nombre de campo. */
	const altaConLoTipeado = $derived(form?.editando ? null : form);

	function abrirEdicion(persona: { id: string; dni: string }) {
		quitando = null;
		abiertaAMano = persona.id;
		dniTipeado = persona.dni;
	}

	function cerrarEdicion() {
		abiertaAMano = null;
		dniTipeado = null;
	}

	/** Los registros que están esperando este DNI: al guardarlo, quedan resueltos. */
	const pendienteDe = (dni: string) => data.pendientes.find((p) => p.dni === dni);

	let busqueda = $state('');

	/** Sin mayúsculas ni tildes: en el padrón hay Núñez, Peña, Ramírez. */
	const aplanar = (texto: string) =>
		texto
			.toLowerCase()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '');

	const encontradas = $derived.by(() => {
		const termino = aplanar(busqueda.trim());
		if (!termino) return data.padron;

		// Cada palabra tiene que aparecer en alguna parte, en cualquier orden: así
		// «miriam acuña» encuentra a «Acuña, Miriam Elizabeth», que en ningún orden
		// es un tramo seguido de texto. Los dígitos van contra el DNI, tolerando los
		// puntos como en el resto del sistema.
		const palabras = termino.split(/\s+/);
		return data.padron.filter((persona) => {
			const comoSeLlama = aplanar(`${persona.apellido} ${persona.nombre}`);
			return palabras.every((palabra) => {
				const digitos = palabra.replace(/\D/g, '');
				return comoSeLlama.includes(palabra) || (digitos !== '' && persona.dni.includes(digitos));
			});
		});
	});

	const buscando = $derived(busqueda.trim() !== '');

	/** La tarjeta de incorporar trabaja de a una persona o con un listado entero. */
	let conListado = $state(false);
	let leyendo = $state(false);
	let importando = $state(false);
	let fallaDelListado = $state<string | null>(null);
	let listado = $state<{
		archivo: string;
		personas: PersonaLeida[];
		errores: FilaConError[];
	} | null>(null);
	let todasLasNuevas = $state(false);
	let todosLosErrores = $state(false);

	const enElPadron = $derived(new Set(data.padron.map((persona) => persona.dni)));
	const nuevas = $derived(listado?.personas.filter((p) => !enElPadron.has(p.dni)) ?? []);
	const yaCargadas = $derived((listado?.personas.length ?? 0) - nuevas.length);

	async function elegirListado(evento: Event & { currentTarget: HTMLInputElement }) {
		const campo = evento.currentTarget;
		const archivo = campo.files?.[0];
		if (!archivo) return;

		leyendo = true;
		fallaDelListado = null;
		listado = null;
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
			// Así se puede volver a elegir el mismo archivo después de corregirlo.
			campo.value = '';
		}
	}

	function descartarListado() {
		listado = null;
		fallaDelListado = null;
	}

	/** Lo mínimo para que alguien arme su planilla sin adivinar las columnas. */
	const planillaDeEjemplo =
		'data:text/csv;charset=utf-8,' +
		encodeURIComponent('\uFEFFDNI;Apellido;Nombre\r\n30111222;Pérez;Juan\r\n');

	/** Precarga el formulario con un DNI pendiente para no tipearlo de nuevo. */
	function completarCon(dni: string) {
		// Con el listado abierto el formulario no está en la página: se espera a que vuelva.
		conListado = false;
		tick().then(() => {
			const campo = document.getElementById('dni') as HTMLInputElement | null;
			if (!campo) return;
			campo.value = dni;
			campo.dispatchEvent(new Event('input', { bubbles: true }));
			document.getElementById('nombre')?.focus();
		});
	}
</script>

{#snippet importacion()}
	{#if !listado}
		<div class="campo">
			<label for="listado">Elegí la planilla</label>
			<p class="ayuda">Excel o CSV, con columnas DNI, Apellido y Nombre.</p>
			<input
				id="listado"
				type="file"
				accept={EXTENSIONES_DEL_LISTADO.join(',')}
				disabled={leyendo}
				onchange={elegirListado}
			/>
		</div>
		{#if leyendo}
			<p class="ayuda">Leyendo el archivo…</p>
		{/if}
		{#if fallaDelListado}
			<div class="aviso error" role="alert">
				<Icono nombre="error" />
				<span>{fallaDelListado}</span>
			</div>
		{/if}
		<a class="boton fantasma" href={planillaDeEjemplo} download="padron.csv">
			<Icono nombre="descargar" tamano={16} />
			Descargar una planilla de ejemplo
		</a>
	{:else}
		<p class="archivo-elegido">
			<Icono nombre="padron" tamano={18} />
			<span>{listado.archivo}</span>
		</p>
		<div class="resumen-listado">
			<span class="chip exito">{nuevas.length} para incorporar</span>
			{#if yaCargadas > 0}
				<span class="chip neutro">{yaCargadas} ya en el padrón</span>
			{/if}
			{#if listado.errores.length > 0}
				<span class="chip alerta">{listado.errores.length} con errores</span>
			{/if}
		</div>

		{#if listado.errores.length > 0}
			{@const errores = todosLosErrores ? listado.errores : listado.errores.slice(0, 5)}
			<div class="aviso alerta">
				<Icono nombre="alerta" />
				<div>
					<strong>
						{listado.errores.length === 1
							? 'Esta fila no se va a incorporar:'
							: 'Estas filas no se van a incorporar:'}
					</strong>
					<ul class="filas-con-error">
						{#each errores as error (error.fila)}
							<li>Fila {error.fila}: {error.motivo}</li>
						{/each}
					</ul>
					{#if listado.errores.length > 5}
						<button
							class="boton fantasma"
							type="button"
							aria-expanded={todosLosErrores}
							onclick={() => (todosLosErrores = !todosLosErrores)}
						>
							<Icono nombre={todosLosErrores ? 'arriba' : 'abajo'} tamano={16} />
							{todosLosErrores ? 'Ver menos' : `Ver las ${listado.errores.length}`}
						</button>
					{/if}
				</div>
			</div>
		{/if}

		{#if nuevas.length > 0}
			{@const visibles = todasLasNuevas ? nuevas : nuevas.slice(0, 8)}
			<div class="tabla-envoltorio vista-previa">
				<table class="tabla">
					<thead>
						<tr>
							<th>DNI</th>
							<th>Apellido y nombre</th>
						</tr>
					</thead>
					<tbody>
						{#each visibles as persona (persona.dni)}
							<tr>
								<td>{mostrarDni(persona.dni)}</td>
								<td class="principal">{persona.apellido}, {persona.nombre}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			{#if nuevas.length > 8}
				<button
					class="boton fantasma"
					type="button"
					aria-expanded={todasLasNuevas}
					onclick={() => (todasLasNuevas = !todasLasNuevas)}
				>
					<Icono nombre={todasLasNuevas ? 'arriba' : 'abajo'} tamano={16} />
					{todasLasNuevas ? 'Ver menos' : `Ver las ${nuevas.length}`}
				</button>
			{/if}
		{:else}
			<div class="aviso info">
				<Icono nombre="info" />
				<span>
					{listado.personas.length > 0
						? 'Todas las personas del archivo ya están en el padrón.'
						: 'No hay personas para incorporar.'}
				</span>
			</div>
		{/if}

		<form
			class="confirmacion acciones-del-listado"
			method="POST"
			action="?/importar"
			use:enhance={() => {
				importando = true;
				return async ({ result, update }) => {
					await update();
					importando = false;
					if (result.type === 'success') {
						descartarListado();
						conListado = false;
					}
				};
			}}
		>
			<input
				type="hidden"
				name="personas"
				value={JSON.stringify(nuevas.map(({ dni, apellido, nombre }) => ({ dni, apellido, nombre })))}
			/>
			{#if nuevas.length > 0}
				<button class="boton" type="submit" disabled={importando}>
					<Icono nombre="tilde" tamano={16} />
					{importando
						? 'Incorporando…'
						: nuevas.length === 1
							? 'Incorporar 1 persona'
							: `Incorporar ${nuevas.length} personas`}
				</button>
			{/if}
			<button
				class="boton secundario"
				type="button"
				onclick={descartarListado}
				disabled={importando}
			>
				Elegir otro archivo
			</button>
		</form>
	{/if}
{/snippet}

<svelte:head>
	<title>Padrón — SIMUNaM</title>
</svelte:head>

<div class="pagina-cabecera">
	<div class="titulo">
		<h1>Padrón</h1>
		<p class="bajada">Las personas cargadas para el evento</p>
	</div>
</div>

{#if form?.mensaje}
	<div class="aviso error" role="alert">
		<Icono nombre="error" />
		<span>{form.mensaje}</span>
	</div>
{/if}
{#if form?.exito}
	<div class="aviso exito" role="status">
		<Icono nombre="tilde-circulo" />
		<span>{form.exito}</span>
	</div>
{/if}

{#if data.pendientes.length > 0}
	<div class="tarjeta">
		<div class="tarjeta-cabecera">
			<h2>DNI sin resolver</h2>
			<span class="chip alerta">{data.pendientes.length}</span>
		</div>
		<p class="ayuda">
			Ocuparon un rol en alguna mesa pero no están en el padrón. O les falta el alta, o el
			documento se tipeó mal: tocá dónde ocupó el rol para verlo en su mesa y darlo de baja.
		</p>
		<ul class="lista">
			{#each data.pendientes as pendiente (pendiente.dni)}
				<li class="pendiente-padron">
					<span class="quien">DNI {mostrarDni(pendiente.dni)}</span>
					<span class="registros">
						{#each pendiente.registros as registro (registro.ruta)}
							<a class="registro" href={registro.ruta}>
								<span class="donde">{registro.texto}</span>
								<span class="detalle">{registro.curso}</span>
							</a>
						{/each}
					</span>
					<button
						class="boton fantasma"
						type="button"
						style="margin-left: auto"
						onclick={() => completarCon(pendiente.dni)}
					>
						<Icono nombre="mas" tamano={16} />
						Incorporar
					</button>
				</li>
			{/each}
		</ul>
	</div>
{/if}

<div class="tarjeta">
	<div class="tarjeta-cabecera">
		<h2>{conListado ? 'Importar un listado' : 'Incorporar a una persona'}</h2>
		<button
			class="boton secundario desplegar"
			type="button"
			onclick={() => {
				conListado = !conListado;
				descartarListado();
			}}
		>
			<Icono nombre={conListado ? 'editar' : 'subir'} tamano={16} />
			{conListado ? 'De a una' : 'Desde un archivo'}
		</button>
	</div>
	{#if conListado}
		{@render importacion()}
	{:else}
		<form
			method="POST"
			action="?/incorporar"
			use:enhance={() => {
				incorporando = true;
				return async ({ update }) => {
					await update();
					incorporando = false;
				};
			}}
		>
			<div class="rejilla tres" style="margin-bottom: 0">
				<div class="campo">
					<label for="dni">DNI</label>
					<div class="campo-con-icono">
						<Icono nombre="dni" />
						<input
							id="dni"
							name="dni"
							type="tel"
							inputmode="numeric"
							autocomplete="off"
							placeholder="30111222"
							value={altaConLoTipeado?.dni ?? ''}
							aria-invalid={altaConLoTipeado?.campo === 'dni'}
							required
						/>
					</div>
				</div>
				<div class="campo">
					<label for="nombre">Nombre</label>
					<input
						id="nombre"
						name="nombre"
						type="text"
						autocomplete="off"
						value={altaConLoTipeado?.nombre ?? ''}
						aria-invalid={altaConLoTipeado?.campo === 'nombre'}
						required
					/>
				</div>
				<div class="campo">
					<label for="apellido">Apellido</label>
					<input
						id="apellido"
						name="apellido"
						type="text"
						autocomplete="off"
						value={altaConLoTipeado?.apellido ?? ''}
						aria-invalid={altaConLoTipeado?.campo === 'apellido'}
						required
					/>
				</div>
			</div>
			<button class="boton" type="submit" disabled={incorporando}>
				{incorporando ? 'Incorporando…' : 'Incorporar al padrón'}
			</button>
		</form>
	{/if}
</div>

<div class="tarjeta">
	<div class="tarjeta-cabecera">
		<h2>Personas en el padrón</h2>
		<span class="detalle">
			{#if buscando}{encontradas.length} de {data.padron.length}{:else}{data.padron.length}{/if}
		</span>
	</div>

	{#if data.padron.length === 0}
		<div class="vacio">El padrón está vacío.</div>
	{:else}
		<!-- Filtra lo que ya está en pantalla: no hay ida y vuelta al servidor, así
		     responde mientras se tipea. La página se sigue armando entera del lado
		     del servidor, así que sin JavaScript no falta nada, sólo el filtro. -->
		<div class="campo buscador">
			<label for="buscar">Buscar en el padrón</label>
			<div class="campo-con-icono">
				<Icono nombre="buscar" />
				<input
					id="buscar"
					type="text"
					autocomplete="off"
					placeholder="Apellido, nombre o DNI"
					bind:value={busqueda}
				/>
			</div>
		</div>

		{#if buscando && encontradas.length === 0}
			<div class="vacio">
				<p style="margin: 0 0 12px">
					Nadie del padrón coincide con «{busqueda.trim()}».
				</p>
				{#if /^[\d.]+$/.test(busqueda.trim())}
					<button
						class="boton secundario"
						type="button"
						onclick={() => completarCon(busqueda.replace(/\D/g, ''))}
					>
						<Icono nombre="mas" tamano={16} />
						Incorporar ese DNI
					</button>
				{/if}
			</div>
		{:else}
			<div class="tabla-envoltorio">
				<table class="tabla">
					<thead>
						<tr>
							<th>DNI</th>
							<th>Apellido y nombre</th>
							<th>Roles ocupados</th>
							<th class="acciones"></th>
						</tr>
					</thead>
					<tbody>
						{#each encontradas as persona (persona.id)}
							<tr>
								<td>{mostrarDni(persona.dni)}</td>
								<td class="principal">{persona.apellido}, {persona.nombre}</td>
								<td class="detalle">
									{#if persona.registros === 0}
										—
									{:else}
										{persona.registros}
									{/if}
								</td>
								<td class="acciones">
									{#if editando === persona.id || quitando === persona.id}
										<button
											class="icono-boton"
											type="button"
											title="Cancelar"
											onclick={() => {
												cerrarEdicion();
												quitando = null;
											}}
										>
											<Icono nombre="cerrar" tamano={18} />
											<span class="visualmente-oculto">Cancelar</span>
										</button>
									{:else}
										<span class="acciones-fila">
											<button
												class="icono-boton"
												type="button"
												title="Editar"
												onclick={() => abrirEdicion(persona)}
											>
												<Icono nombre="editar" tamano={18} />
												<span class="visualmente-oculto">Editar</span>
											</button>
											<button
												class="icono-boton peligroso"
												type="button"
												title="Quitar del padrón"
												onclick={() => {
													cerrarEdicion();
													quitando = persona.id;
												}}
											>
												<Icono nombre="quitar" tamano={18} />
												<span class="visualmente-oculto">Quitar del padrón</span>
											</button>
										</span>
									{/if}
								</td>
							</tr>

							{#if editando === persona.id}
								{@const cambiaElDni = dniEnEdicion !== '' && dniEnEdicion !== persona.dni}
								{@const esperando = pendienteDe(dniEnEdicion)}
								<tr>
									<td colspan="4" style="padding-top: 0">
										<form
											class="desplegable"
											method="POST"
											action="?/editar"
											use:enhance={() => {
												guardando = true;
												return async ({ update }) => {
													await update();
													guardando = false;
													// Si salió bien la fila se cierra; si no, queda abierta con
													// lo que el servidor devolvió.
													abiertaAMano = form?.editando ?? null;
													dniTipeado = null;
												};
											}}
										>
											<input type="hidden" name="id" value={persona.id} />

											<div class="rejilla tres">
												<div class="campo">
													<label for="editar-dni">DNI</label>
													<div class="campo-con-icono">
														<Icono nombre="dni" />
														<input
															id="editar-dni"
															name="dni"
															type="tel"
															inputmode="numeric"
															autocomplete="off"
															value={dniEnEdicion}
															oninput={(e) => (dniTipeado = e.currentTarget.value)}
															aria-invalid={form?.editando === persona.id && form?.campo === 'dni'}
															required
														/>
													</div>
												</div>
												<div class="campo">
													<label for="editar-nombre">Nombre</label>
													<input
														id="editar-nombre"
														name="nombre"
														type="text"
														autocomplete="off"
														value={form?.editando === persona.id
															? (form.nombre ?? '')
															: persona.nombre}
														aria-invalid={form?.editando === persona.id &&
															form?.campo === 'nombre'}
														required
													/>
												</div>
												<div class="campo">
													<label for="editar-apellido">Apellido</label>
													<input
														id="editar-apellido"
														name="apellido"
														type="text"
														autocomplete="off"
														value={form?.editando === persona.id
															? (form.apellido ?? '')
															: persona.apellido}
														aria-invalid={form?.editando === persona.id &&
															form?.campo === 'apellido'}
														required
													/>
												</div>
											</div>

											{#if cambiaElDni && (persona.registros > 0 || esperando)}
												<div class="aviso alerta" style="margin: 0 0 16px">
													<Icono nombre="alerta" />
													<div>
														{#if persona.registros > 0}
															Lo que registró con el DNI actual va a quedar sin identificar.
														{/if}
														{#if esperando}
															Se le van a asignar
															{esperando.registros.length === 1
																? 'el registro hecho'
																: `los ${esperando.registros.length} registros hechos`}
															con el DNI nuevo.
														{/if}
													</div>
												</div>
											{/if}

											<div class="confirmacion">
												<button class="boton" type="submit" disabled={guardando}>
													<Icono nombre="tilde" tamano={16} />
													{guardando ? 'Guardando…' : 'Guardar los cambios'}
												</button>
												<button
													class="boton secundario"
													type="button"
													onclick={cerrarEdicion}
													disabled={guardando}
												>
													Cancelar
												</button>
											</div>
										</form>
									</td>
								</tr>
							{/if}

							{#if quitando === persona.id}
								<tr>
									<td colspan="4" style="padding-top: 0">
										<div class="aviso alerta desplegable" style="margin: 0">
											<Icono nombre="alerta" />
											<div>
												{#if persona.registros > 0}
													<strong>
														{persona.apellido}, {persona.nombre} ocupó
														{persona.registros === 1 ? 'un rol' : `${persona.registros} roles`}
														en las mesas.
													</strong>
													Sus evaluaciones no se borran, pero quedan sin identificar.
												{:else}
													<strong>
														¿Quitar a {persona.apellido}, {persona.nombre} del padrón?
													</strong>
												{/if}
												<form
													method="POST"
													action="?/quitar"
													style="margin-top: 12px"
													use:enhance={() => async ({ update }) => {
														await update();
														quitando = null;
													}}
												>
													<input type="hidden" name="id" value={persona.id} />
													<button class="boton peligro" type="submit">
														<Icono nombre="quitar" />
														Sí, quitar del padrón
													</button>
												</form>
											</div>
										</div>
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/if}
</div>
