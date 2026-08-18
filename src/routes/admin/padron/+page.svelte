<script lang="ts">
	import { enhance } from '$app/forms';
	import Icono from '$lib/Icono.svelte';
	import { mostrarDni } from '$lib/dni';

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

	/** Precarga el formulario con un DNI pendiente para no tipearlo de nuevo. */
	function completarCon(dni: string) {
		const campo = document.getElementById('dni') as HTMLInputElement | null;
		if (!campo) return;
		campo.value = dni;
		campo.dispatchEvent(new Event('input', { bubbles: true }));
		document.getElementById('nombre')?.focus();
	}
</script>

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
			Estos DNI ocuparon un rol pero no están en el padrón. Al incorporarlos, sus registros quedan
			resueltos solos.
		</p>
		<ul class="lista">
			{#each data.pendientes as pendiente (pendiente.dni)}
				<li class="pendiente-padron">
					<span class="quien">DNI {mostrarDni(pendiente.dni)}</span>
					<span class="detalle">{pendiente.registros.join(' · ')}</span>
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
		<h2>Incorporar a una persona</h2>
		<Icono nombre="padron" />
	</div>
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
									{#if editando === persona.id}
										<button class="enlace" type="button" onclick={cerrarEdicion}>Cancelar</button>
									{:else if quitando === persona.id}
										<button class="enlace" type="button" onclick={() => (quitando = null)}>
											Cancelar
										</button>
									{:else}
										<span class="fila">
											<button class="enlace" type="button" onclick={() => abrirEdicion(persona)}>
												Editar
											</button>
											<button
												class="enlace peligroso"
												type="button"
												onclick={() => {
													cerrarEdicion();
													quitando = persona.id;
												}}
											>
												Quitar
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

											{#if cambiaElDni}
												<div class="aviso alerta" style="margin: 0 0 16px">
													<Icono nombre="alerta" />
													<div>
														<strong>El DNI es con lo que las mesas identifican a la persona.</strong>
														{#if persona.registros > 0}
															Al cambiarlo,
															{persona.registros === 1
																? 'el registro que tiene'
																: `sus ${persona.registros} registros`}
															en las mesas
															{persona.registros === 1 ? 'queda' : 'quedan'} sin identificar, con
															el DNI viejo — no se
															{persona.registros === 1 ? 'borra' : 'borran'}.
														{:else}
															Todavía no ocupó ningún rol, así que no hay registros que se muevan.
														{/if}
														{#if esperando}
															En cambio, {esperando.registros.length === 1
																? 'queda resuelto 1 registro que está esperando'
																: `quedan resueltos ${esperando.registros.length} registros que están esperando`}
															el DNI nuevo.
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
													Al quitar a esa persona del padrón, sus registros y evaluaciones
													<strong>no se borran</strong>: quedan con el DNI, sin identificar.
													Si vuelve al padrón, se resuelven solos.
												{:else}
													<strong>
														{persona.apellido}, {persona.nombre} todavía no ocupó ningún rol.
													</strong>
													Quitar ese registro no afecta a ninguna mesa.
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
