<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { invalidateAll } from '$app/navigation';
	import Icono from '$lib/Icono.svelte';
	import { dniValido, normalizarDni } from '$lib/dni';
	import ElegirRol from '$lib/ElegirRol.svelte';

	let { data, form } = $props();

	let enviando = $state(false);
	let recargando = $state(false);
	// Se conservan después de un error: el formulario no se vacía.
	let dni = $state(untrack(() => form?.dni ?? ''));
	let rolElegido = $state(untrack(() => form?.rolCodigo ?? ''));
	/** Lo que se valida antes de mandar, los dos campos a la vez. */
	let errores = $state<Record<string, string>>({});
	/** Los campos tocados después del último envío: su error del servidor ya no aplica. */
	let corregidos = $state<Record<string, boolean>>({});

	const errorDe = (campo: string) =>
		errores[campo] ??
		(form?.mensaje && form.campo === campo && !corregidos[campo] ? form.mensaje : null);
	const errorGeneral = $derived(form?.mensaje && !form.campo ? form.mensaje : null);

	const pendientes = $derived(data.corrida && form?.pendientes?.length ? form.pendientes : null);
	const raiz = $derived(`/m/${data.curso.codigo}/${data.mesa.numero}`);

	function escribirDni(evento: Event & { currentTarget: HTMLInputElement }) {
		dni = normalizarDni(evento.currentTarget.value);
		evento.currentTarget.value = dni;
		delete errores.dni;
		corregidos.dni = true;
	}

	function elegirRol() {
		delete errores.rolCodigo;
		corregidos.rolCodigo = true;
	}

	async function volverACargar() {
		recargando = true;
		await invalidateAll();
		recargando = false;
	}

	/** En el teléfono la barra de abajo tapa el error de los roles: se lleva la vista ahí. */
	async function llevarAlError(enElDni: boolean) {
		await tick();
		if (enElDni) document.getElementById('dni')?.focus();
		else document.getElementById('rol-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	/** El mismo envío para entrar y para «Ahora no»: lo que cambia es `continuar`. */
	const registrar =
		(validar: boolean): SubmitFunction =>
		({ cancel }) => {
			if (validar) {
				const faltan: Record<string, string> = {};
				if (!dniValido(dni)) faltan.dni = 'Ingresá tu DNI, sin puntos.';
				if (!rolElegido) faltan.rolCodigo = 'Elegí el rol que vas a ocupar.';
				errores = faltan;
				if (Object.keys(faltan).length > 0) {
					cancel();
					llevarAlError(Boolean(faltan.dni));
					return;
				}
			}

			enviando = true;
			return async ({ update }) => {
				await update({ reset: false });
				enviando = false;
				corregidos = {};
			};
		};
</script>

<svelte:head>
	<title>Mesa {data.mesa.numero} — SIMUNaM</title>
</svelte:head>

<div class="sumarse-pagina">
	<!-- Acá se llega escaneando, así que no hay pantalla anterior en el historial:
	     la flecha lleva a `/participar`, que es desde donde se busca otra mesa. -->
	<header class="mesa-cabecera">
		<div class="mesa-cabecera-dentro entrar-angosto">
			<div class="mesa-navegacion">
				<a class="mesa-volver" href="/participar">
					<Icono nombre="atras" />
					Entrar a una mesa
				</a>
			</div>
			<div class="mesa-titulo-fila">
				<div class="mesa-titulo">
					<div class="sumarse-titulo">
						<h1>Mesa {data.mesa.numero}</h1>
						{#if data.corrida}
							<span class="estado-mesa en-curso">
								<span class="punto"></span>
								Ciclo {data.corrida.numero}
							</span>
						{:else if data.cerrada}
							<span class="estado-mesa">
								<Icono nombre="candado" tamano={14} grosor={2.25} />
								Cerrada
							</span>
						{/if}
					</div>
					{#if data.mesa.escenario?.nombre}
						<p class="sumarse-escenario">{data.mesa.escenario.nombre}</p>
					{/if}
					<p class="mesa-escenario sumarse-curso">{data.curso.nombre}</p>
				</div>
			</div>
		</div>
	</header>

	<main class="entrar-cuerpo entrar-angosto">
		{#if data.volvesAElegir}
			<div class="entrar-aviso" role="status">
				<Icono nombre="info" />
				<span>
					<strong>Ya no estás en este ciclo.</strong>
					Volvé a entrar y elegí el rol que te toca.
				</span>
			</div>
		{/if}

		{#if !data.corrida}
			<section class="mesa-tarjeta evaluado-vacio">
				{#if data.cerrada}
					<span class="evaluado-vacio-icono gris"><Icono nombre="candado" tamano={24} /></span>
					<strong>Esta mesa ya está cerrada.</strong>
				{:else}
					<span class="evaluado-vacio-icono"><Icono nombre="reloj" tamano={24} /></span>
					<strong>Esta mesa todavía no tiene un ciclo habilitado.</strong>
					<span>Esperá a que el líder de mesa lo habilite.</span>
					<button
						class="boton secundario sumarse-recargar"
						type="button"
						onclick={volverACargar}
						disabled={recargando}
					>
						<Icono nombre="reabrir" tamano={18} />
						{recargando ? 'Cargando…' : 'Volver a cargar'}
					</button>
				{/if}
			</section>
		{:else if pendientes && data.corrida}
			<div class="entrar-aviso" role="alert">
				<Icono nombre="alerta" />
				<span>
					<strong>
						{pendientes.length > 1
							? `Dejaste ${pendientes.length} checklists sin enviar.`
							: 'Dejaste un checklist sin enviar.'}
					</strong>
					Lo que marcaste sigue guardado y todavía podés enviarlo.
				</span>
			</div>

			{#each pendientes as pendiente (pendiente.participacionId)}
				<section class="mesa-tarjeta sumarse-pendiente">
					<div>
						<p class="rotulo-chico">Ciclo {pendiente.corridaNumero} · {pendiente.rol}</p>
						<h2>{pendiente.checklist}</h2>
					</div>
					<div>
						<div class="sumarse-barra" aria-hidden="true">
							<span style="width: {pendiente.items ? Math.round((pendiente.marcados / pendiente.items) * 100) : 0}%"></span>
						</div>
						<p class="sumarse-avance">
							<strong>{pendiente.marcados} de {pendiente.items} ítems</strong> marcados, sin enviar
						</p>
					</div>
					<a class="boton enviar bloque" href="{raiz}/participacion/{pendiente.participacionId}">
						Terminar y enviarlo
						<Icono nombre="avanzar" tamano={20} grosor={2.25} />
					</a>
				</section>
			{/each}

			<form class="sumarse-ahora-no" method="POST" use:enhance={registrar(false)}>
				<input type="hidden" name="dni" value={form?.dni} />
				<input type="hidden" name="rolCodigo" value={form?.rolCodigo} />
				<input type="hidden" name="continuar" value="true" />
				<button class="boton secundario bloque" type="submit" disabled={enviando}>
					{enviando
						? 'Registrando…'
						: `Ahora no: entrar como ${form?.rolNombre} en el ciclo ${data.corrida.numero}`}
				</button>
				<p>Si entrás al ciclo nuevo vas a poder volver a este checklist desde tu pantalla.</p>
			</form>
		{:else}
			<form
				class="sumarse-formulario"
				method="POST"
				novalidate
				use:enhance={registrar(true)}
			>
				{#if errorGeneral}
					<p class="dialogo-error" role="alert">
						<Icono nombre="error" tamano={18} />
						{errorGeneral}
					</p>
				{/if}

				<div class="sumarse-campo">
					<label for="dni">Tu DNI</label>
					<input
						id="dni"
						class="sumarse-dni"
						name="dni"
						type="text"
						inputmode="numeric"
						autocomplete="off"
						enterkeyhint="next"
						placeholder="Ej.: 40222333"
						value={dni}
						oninput={escribirDni}
						aria-invalid={Boolean(errorDe('dni'))}
						aria-describedby="dni-ayuda"
					/>
					{#if errorDe('dni')}
						<p class="campo-error" id="dni-ayuda"><Icono nombre="error" tamano={16} />{errorDe('dni')}</p>
					{:else}
						<p class="ayuda" id="dni-ayuda">Sin puntos ni espacios</p>
					{/if}
				</div>

				<ElegirRol
					roles={data.roles}
					leyenda="Tu rol en el ciclo {data.corrida.numero}"
					bind:elegido={rolElegido}
					error={errorDe('rolCodigo')}
					onelegir={elegirRol}
				/>

				<div class="sumarse-accion">
					<button class="boton enviar bloque" type="submit" disabled={enviando}>
						{enviando ? 'Registrando…' : 'Entrar al ciclo'}
						{#if !enviando}<Icono nombre="avanzar" tamano={20} grosor={2.25} />{/if}
					</button>
				</div>
			</form>
		{/if}

		<nav class="sumarse-pie" aria-label="Otras opciones">
			<a href="{raiz}/consulta">
				<Icono nombre="planificacion" tamano={18} />
				<span>¿Ya practicaste la técnica en esta mesa? <u>Consultá lo registrado sobre tu ciclo</u></span>
			</a>
			<a href="/participar">
				<Icono nombre="buscar" tamano={18} />
				<span>¿No es ésta tu mesa? <u>Buscá la tuya</u></span>
			</a>
		</nav>
	</main>
</div>
