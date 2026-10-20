<script lang="ts">
	import { enhance } from '$app/forms';
	import Icono from '$lib/Icono.svelte';

	let { data, form } = $props();

	let creando = $state(false);
	let restableciendo = $state(false);

	const fecha = (crudo: string | null) =>
		crudo ? new Date(crudo).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
</script>

<svelte:head>
	<title>Instituciones — SIMUNaM</title>
</svelte:head>

<div class="pagina-cabecera">
	<div class="titulo">
		<h1>Instituciones</h1>
		<p class="bajada">Quiénes usan SIMUNaM, y con qué clave entran a su administración</p>
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

<div class="rejilla dos">
	<div class="tarjeta" style="margin: 0">
		<div class="tarjeta-cabecera">
			<h2>Dar de alta una institución</h2>
		</div>
		<form
			method="POST"
			action="?/crear"
			use:enhance={() => {
				creando = true;
				return async ({ update }) => {
					await update();
					creando = false;
				};
			}}
		>
			<div class="campo">
				<label for="nombre">Nombre de la institución</label>
				<input
					id="nombre"
					name="nombre"
					type="text"
					autocomplete="off"
					placeholder="Universidad Nacional del Nordeste"
					value={form?.nombre ?? ''}
					required
				/>
				<span class="ayuda">El código con que se la nombra sale de acá; no hace falta elegirlo.</span>
			</div>

			<div class="campo">
				<label for="clave">Clave de su administración</label>
				<div class="campo-con-icono">
					<Icono nombre="candado" />
					<input
						id="clave"
						name="clave"
						type="password"
						autocomplete="new-password"
						minlength="8"
						required
					/>
				</div>
				<span class="ayuda">
					Al menos 8 caracteres. La comparten quienes preparan los cursos de esa institución, y el
					sistema no la vuelve a mostrar.
				</span>
			</div>

			<button class="boton bloque" type="submit" disabled={creando}>
				{creando ? 'Creando…' : 'Dar de alta la institución'}
			</button>
		</form>
	</div>

	<div class="tarjeta" style="margin: 0">
		<div class="tarjeta-cabecera">
			<h2>Restablecer una clave</h2>
		</div>

		{#if data.instituciones.length === 0}
			<div class="aviso alerta" style="margin: 0">
				<Icono nombre="alerta" />
				<span>Todavía no hay ninguna institución.</span>
			</div>
		{:else}
			<form
				method="POST"
				action="?/restablecerClave"
				use:enhance={() => {
					restableciendo = true;
					return async ({ update }) => {
						await update();
						restableciendo = false;
					};
				}}
			>
				<div class="campo">
					<label for="id">Institución</label>
					<select id="id" name="id" required>
						<option value="" disabled selected={!form?.restableciendo}>Elegí la institución</option>
						{#each data.instituciones as institucion (institucion.id)}
							<option value={institucion.id} selected={form?.restableciendo === institucion.id}>
								{institucion.nombre}
							</option>
						{/each}
					</select>
				</div>

				<div class="campo">
					<label for="claveNueva">Clave nueva</label>
					<div class="campo-con-icono">
						<Icono nombre="candado" />
						<input
							id="claveNueva"
							name="clave"
							type="password"
							autocomplete="new-password"
							minlength="8"
							required
						/>
					</div>
				</div>

				<div class="campo">
					<label for="confirmacion">Escribí su código para confirmar</label>
					<input
						id="confirmacion"
						name="confirmacion"
						type="text"
						autocomplete="off"
						placeholder="unam"
						required
					/>
					<span class="ayuda">
						La institución queda afuera hasta que le pasen la clave nueva, así que no alcanza con
						elegirla de la lista.
					</span>
				</div>

				<button class="boton bloque peligro" type="submit" disabled={restableciendo}>
					{restableciendo ? 'Cambiando…' : 'Restablecer la clave'}
				</button>
			</form>
		{/if}
	</div>
</div>

<div class="tarjeta">
	<div class="tarjeta-cabecera">
		<h2>Instituciones</h2>
		<span class="detalle">{data.instituciones.length}</span>
	</div>

	{#if data.instituciones.length === 0}
		<div class="vacio">Todavía no hay ninguna institución dada de alta.</div>
	{:else}
		<div class="tabla-envoltorio">
			<table class="tabla">
				<thead>
					<tr>
						<th>Institución</th>
						<th>Código</th>
						<th>Cursos</th>
						<th>Mesas</th>
						<th>Escenarios</th>
						<th>Padrón</th>
						<th>Dada de alta</th>
					</tr>
				</thead>
				<tbody>
					{#each data.instituciones as institucion (institucion.id)}
						<tr>
							<td class="principal">{institucion.nombre}</td>
							<!-- Sin `.etiqueta`: esa clase pasa el texto a mayúsculas, y este código
							     es justamente el que hay que escribir para confirmar un cambio de clave. -->
							<td class="detalle">{institucion.codigo}</td>
							<td>{institucion.cursos}</td>
							<td>{institucion.mesas}</td>
							<td>{institucion.escenarios}</td>
							<td>{institucion.padron}</td>
							<td class="detalle">{fecha(institucion.creado_en)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<p class="pie">
	Esta zona no administra ninguna institución: para eso se entra a
	<a href="/admin">la administración</a> con la clave de cada una.
</p>
