<script lang="ts">
	import { enhance } from '$app/forms';
	import Icono from '$lib/Icono.svelte';
	import BarraSuperior from '$lib/BarraSuperior.svelte';
	import { iconoDeRol, queHaceElRol } from '$lib/roles';

	let { data, form } = $props();

	let enviando = $state(false);
</script>

<svelte:head>
	<title>Mesa {data.mesa.numero} — SIMUNaM</title>
</svelte:head>

<div class="app">
	<BarraSuperior titulo="Mesa {data.mesa.numero}" sub={data.mesa.escenario?.nombre ?? ''}>
		{#snippet derecha()}
			{#if data.corrida}
				<span class="chip azul sin-punto">Corrida {data.corrida.numero}</span>
			{/if}
		{/snippet}
	</BarraSuperior>

	<div class="envoltorio">
		{#if !data.corrida}
			<div class="aviso alerta">
				<Icono nombre="alerta" />
				<span>
					Esta mesa todavía no tiene una corrida habilitada. Esperá a que el líder de mesa la
					habilite.
				</span>
			</div>
		{:else if form?.pendientes && form.pendientes.length > 0}
			<div class="aviso alerta" role="alert">
				<Icono nombre="alerta" />
				<span>
					<strong>Dejaste un checklist sin enviar.</strong> Mientras observabas, el líder habilitó
					la corrida {data.corrida.numero}. Lo que marcaste sigue guardado y todavía podés
					enviarlo.
				</span>
			</div>

			{#each form.pendientes as pendiente (pendiente.participacionId)}
				<div class="tarjeta">
					<div class="identidad">
						<span class="etiqueta">
							Corrida {pendiente.corridaNumero} · {pendiente.rol}
						</span>
						<span class="nombre">{pendiente.checklist}</span>
						<span class="detalle">
							{pendiente.marcados} de {pendiente.items} ítems marcados, sin enviar
						</span>
					</div>
					<a
						class="boton enviar bloque"
						href="/m/{data.mesa.numero}/participacion/{pendiente.participacionId}"
					>
						<Icono nombre="enviar" />
						Terminar y enviarlo
					</a>
				</div>
			{/each}

			<form method="POST" use:enhance>
				<input type="hidden" name="dni" value={form.dni} />
				<input type="hidden" name="rolCodigo" value={form.rolCodigo} />
				<input type="hidden" name="continuar" value="true" />
				<button class="boton secundario bloque" type="submit">
					Ahora no: entrar como {form.rolNombre} en la corrida {data.corrida.numero}
				</button>
			</form>

			<p class="pie">
				Si entrás a la corrida nueva vas a poder volver a este checklist desde tu pantalla.
			</p>
		{:else}
			{#if form?.mensaje}
				<div class="aviso error" role="alert">
					<Icono nombre="error" />
					<span>{form.mensaje}</span>
				</div>
			{/if}

			<form
				method="POST"
				use:enhance={() => {
					enviando = true;
					return async ({ update }) => {
						await update({ reset: false });
						enviando = false;
					};
				}}
			>
				<div class="campo">
					<label for="dni">Tu DNI</label>
					<div class="campo-con-icono">
						<Icono nombre="dni" />
						<input
							id="dni"
							name="dni"
							type="tel"
							inputmode="numeric"
							autocomplete="off"
							enterkeyhint="next"
							placeholder="30111222"
							value={form?.dni ?? ''}
							aria-invalid={form?.campo === 'dni'}
							required
						/>
					</div>
					<p class="ayuda">Sin puntos ni espacios.</p>
				</div>

				<fieldset class="roles" class:invalido={form?.campo === 'rolCodigo'}>
					<legend>El rol que vas a ocupar en esta corrida</legend>
					{#each data.roles as rol (rol.codigo)}
						<label class="rol">
							<input
								type="radio"
								name="rolCodigo"
								value={rol.codigo}
								checked={form?.rolCodigo === rol.codigo}
								required
							/>
							<span class="avatar-rol" class:gris={!rol.observador}>
								<Icono nombre={iconoDeRol[rol.codigo] ?? 'operador'} />
							</span>
							<span class="texto">
								<span class="rol-nombre">{rol.nombre}</span>
								<span class="detalle">{queHaceElRol[rol.codigo] ?? ''}</span>
							</span>
							<Icono nombre="tilde-circulo" clase="marca-elegido" />
						</label>
					{/each}
				</fieldset>

				<div class="barra-accion">
					<button class="boton bloque" type="submit" disabled={enviando}>
						{enviando ? 'Registrando…' : 'Entrar a la corrida'}
						{#if !enviando}<Icono nombre="adelante" />{/if}
					</button>
				</div>
			</form>

			<p class="pie">
				¿Ya practicaste la técnica en esta mesa?
				<a href="/m/{data.mesa.numero}/consulta">Consultá lo registrado sobre tu corrida</a>.
			</p>
		{/if}
	</div>
</div>
