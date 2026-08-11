<script lang="ts">
	import { enhance } from '$app/forms';
	import Icono from '$lib/Icono.svelte';
	import { mostrarDni } from '$lib/dni';

	let { data, form } = $props();

	let incorporando = $state(false);
	/** Id de la persona que se está por quitar, mientras se confirma. */
	let quitando = $state<string | null>(null);

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
						value={form?.dni ?? ''}
						aria-invalid={form?.campo === 'dni'}
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
					value={form?.nombre ?? ''}
					aria-invalid={form?.campo === 'nombre'}
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
					value={form?.apellido ?? ''}
					aria-invalid={form?.campo === 'apellido'}
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
		<span class="detalle">{data.padron.length}</span>
	</div>

	{#if data.padron.length === 0}
		<div class="vacio">El padrón está vacío.</div>
	{:else}
		<div class="tabla-envoltorio" style="margin: 0">
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
					{#each data.padron as persona (persona.id)}
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
								{#if quitando === persona.id}
									<button class="enlace" type="button" onclick={() => (quitando = null)}>
										Cancelar
									</button>
								{:else}
									<button
										class="enlace peligroso"
										type="button"
										onclick={() => (quitando = persona.id)}
									>
										Quitar
									</button>
								{/if}
							</td>
						</tr>

						{#if quitando === persona.id}
							<tr>
								<td colspan="4" style="padding-top: 0">
									<div class="aviso alerta" style="margin: 0">
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
</div>
