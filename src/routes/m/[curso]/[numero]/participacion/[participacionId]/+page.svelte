<script lang="ts">
	import { enhance } from '$app/forms';
	import Icono from '$lib/Icono.svelte';
	import BarraSuperior from '$lib/BarraSuperior.svelte';
	import { mostrarDni } from '$lib/dni';
	import { mostrarTamano } from '$lib/planificacion';
	import { iconoDeRol, llevaChecklist, practicaLaTecnica, queHaceElRol } from '$lib/roles';

	let { data, form } = $props();

	/**
	 * Lo que el observador marcó en esta pantalla. Manda sobre lo que trajo el
	 * servidor mientras el checklist está abierto.
	 *
	 * Antes cada marca llamaba a `update()`, que recarga todos los datos de la
	 * página. Con toques seguidos, la respuesta de una recarga vieja llegaba
	 * después de una nueva y pisaba marcas ya hechas: ítems que se marcaban o
	 * desmarcaban solos. Ahora la marca viaja al servidor sin recargar nada, y si
	 * el servidor la rechaza se vuelve atrás ese ítem.
	 */
	let marcas = $state<Record<string, boolean | null>>({});
	let falloDeMarca = $state<string | null>(null);
	let confirmandoEnvio = $state(false);
	/** Se intentó enviar con ítems sin marcar: se los resalta hasta completarlos. */
	let mostrarFaltantes = $state(false);
	let enviando = $state(false);
	let avanzando = $state(false);

	const enviada = $derived(data.enviadaEn !== null);
	const practica = $derived(practicaLaTecnica(data.participacion.rolCodigo));
	const evalua = $derived(llevaChecklist(data.participacion.checklistOrigen));
	// El facilitador es el único que recibe las dos cosas: la planificación para
	// guiar la corrida y la lista de cotejo de la técnica para evaluarla.
	const facilita = $derived(data.participacion.rolCodigo === 'facilitador');

	/** `true` es «Hizo», `false` es «No hizo» y `null`, sin marcar. */
	const items = $derived(
		(data.checklist?.items ?? []).map((item) => ({
			...item,
			hizo: item.id in marcas ? marcas[item.id] : item.hizo
		}))
	);

	const hechos = $derived(items.filter((item) => item.hizo === true).length);
	const noHechos = $derived(items.filter((item) => item.hizo === false).length);
	const faltan = $derived(items.length - hechos - noHechos);
	const puntos = $derived(
		items.reduce((total, item) => total + (item.hizo === true ? item.peso : 0), 0)
	);
	const maximo = $derived(data.checklist?.maximo ?? 0);
	const porcentaje = $derived(maximo > 0 ? Math.round((puntos / maximo) * 100) : 0);

	const cifra = (n: number) => Math.round(n * 100) / 100;

	/**
	 * Marca un ítem sin recargar la página. Tocar la marca que ya tiene la quita.
	 * Si el servidor la rechaza, el ítem vuelve a como estaba.
	 */
	function marcar(item: { id: string; hizo: boolean | null }, elegida: boolean) {
		const antes = item.hizo;
		marcas[item.id] = antes === elegida ? null : elegida;
		// Sin `update()`: recargar en cada toque hacía que respuestas fuera de orden
		// pisaran marcas ya hechas.
		return async ({ result }: { result: { type: string; data?: Record<string, unknown> } }) => {
			if (result.type === 'failure') {
				marcas[item.id] = antes;
				falloDeMarca =
					(result.data?.mensaje as string) ?? 'No se pudo registrar la marca. Probá de nuevo.';
			} else if (result.type === 'error') {
				marcas[item.id] = antes;
				falloDeMarca = 'Se perdió la conexión. La marca no quedó registrada.';
			} else {
				falloDeMarca = null;
			}
		};
	}

	/** Lo que se manda al tocar un botón: la marca elegida, o quitarla si ya la tenía. */
	const marcaAEnviar = (actual: boolean | null, elegida: boolean) =>
		actual === elegida ? 'sin_marcar' : elegida ? 'hizo' : 'no_hizo';

	function pedirEnvio() {
		if (faltan > 0) {
			mostrarFaltantes = true;
			const primero = items.find((item) => item.hizo === null);
			if (primero) {
				document
					.getElementById(`item-${primero.id}`)
					?.scrollIntoView({ behavior: 'smooth', block: 'center' });
			}
			return;
		}
		confirmandoEnvio = true;
	}

	const fechaDeEnvio = $derived(
		data.enviadaEn
			? new Date(data.enviadaEn).toLocaleString('es-AR', {
					dateStyle: 'short',
					timeStyle: 'short',
					hour12: false
				})
			: null
	);
</script>

<svelte:head>
	<title>{data.participacion.rolNombre} — Mesa {data.mesa.numero}</title>
</svelte:head>

<div class="app">
	<BarraSuperior
		volverA={data.volverA}
		titulo="Mesa {data.mesa.numero}"
		sub={data.escenario?.nombre ?? ''}
	>
		{#snippet derecha()}
			<span class="chip azul sin-punto">Ciclo {data.corrida.numero}</span>
		{/snippet}
	</BarraSuperior>

	<div class="envoltorio">
		<div class="tarjeta">
			<div class="fila">
				<span class="avatar-rol" class:gris={!evalua}>
					<Icono nombre={iconoDeRol[data.participacion.rolCodigo] ?? 'operador'} tamano={22} />
				</span>
				<div class="identidad">
					{#if data.participacion.nombre}
						<span class="etiqueta">Te identificamos como</span>
						<span class="nombre">{data.participacion.nombre}</span>
						<span class="detalle">
							DNI {mostrarDni(data.participacion.dni)} · {data.participacion.rolNombre}
						</span>
					{:else}
						<span class="etiqueta">Quedaste registrado como</span>
						<span class="nombre">{data.participacion.rolNombre}</span>
						<span class="detalle">DNI {mostrarDni(data.participacion.dni)}</span>
					{/if}
				</div>
			</div>
		</div>

		{#if !data.participacion.nombre}
			<div class="aviso alerta">
				<Icono nombre="alerta" />
				<span>
					<strong>No encontramos el DNI {mostrarDni(data.participacion.dni)} en el padrón.</strong>
					Podés seguir igual. Si te equivocaste al tipear, avisale al líder de mesa.
				</span>
			</div>
		{/if}

		{#if !data.corrida.habilitada && !enviada}
			<div class="aviso alerta">
				<Icono nombre="reloj" />
				<span>Este ciclo ya fue cerrado por el líder.</span>
			</div>
		{/if}

		{#if form?.mensaje || falloDeMarca}
			<div class="aviso error" role="alert">
				<Icono nombre="error" />
				<span>{form?.mensaje ?? falloDeMarca}</span>
			</div>
		{/if}

		{#each data.pendientes as pendiente (pendiente.participacionId)}
			<div class="pendiente-sin-enviar">
				<div class="aviso alerta" style="margin: 0 0 12px">
					<Icono nombre="alerta" />
					<span>
						<strong>Te quedó un checklist sin enviar</strong> del ciclo
						{pendiente.corridaNumero}, cuando fuiste {pendiente.rol}:
						{pendiente.marcados} de {pendiente.items} ítems marcados.
					</span>
				</div>
				<a
					class="boton enviar bloque"
					href="/m/{data.curso?.codigo}/{data.mesa.numero}/participacion/{pendiente.participacionId}"
				>
					<Icono nombre="enviar" />
					Terminar y enviarlo
				</a>
			</div>
		{/each}

		{#if facilita}
			<div class="tarjeta">
				<div class="tarjeta-cabecera">
					<h2>Planificación del escenario</h2>
				</div>
				{#if data.escenario?.planificacion_archivo}
					<a
						class="boton secundario bloque"
						href="/m/{data.curso?.codigo}/{data.mesa.numero}/planificacion"
						target="_blank"
						rel="noopener"
					>
						<Icono nombre="descargar" />
						{data.escenario.planificacion_archivo}
					</a>
					<p class="detalle" style="margin: 8px 0 0; text-align: center">
						{mostrarTamano(data.escenario.planificacion_tamano ?? 0)}
					</p>
				{:else}
					<div class="aviso alerta" style="margin: 0">
						<Icono nombre="alerta" />
						<span>La planificación de este escenario todavía no está disponible.</span>
					</div>
				{/if}
			</div>
		{/if}

		{#if evalua}
			{#if !data.checklist}
				<div class="aviso alerta">
					<Icono nombre="alerta" />
					<span>Todavía no hay un checklist cargado para tu rol. Avisale al líder de mesa.</span>
				</div>
			{:else}
				{#if enviada}
					<div class="aviso exito" role="status">
						<Icono nombre="tilde-circulo" />
						<span>
							<strong>Checklist enviado</strong> el {fechaDeEnvio}. Ya no admite cambios.
						</span>
					</div>
				{/if}

				<h2 class="t-sub" style="margin-bottom: 4px">{data.checklist.nombre}</h2>

				<div class="progreso-fijo">
					<div class="resultado">
						<span class="valor">
							<strong>{cifra(puntos)}</strong> de {cifra(maximo)}
						</span>
						<span class="detalle">
							{hechos} hizo · {noHechos} no hizo{faltan > 0 ? ` · ${faltan} sin marcar` : ''}
						</span>
					</div>
					<div class="barra" role="presentation">
						<span style="width: {porcentaje}%"></span>
					</div>
				</div>

				{#if !enviada}
					<p class="detalle" style="margin-bottom: 12px">Marcá en cada ítem si lo hizo o no lo hizo.</p>
				{/if}

				<div class="items">
					{#each items as item (item.id)}
						<div
							class="item"
							id="item-{item.id}"
							class:hizo={item.hizo === true}
							class:no-hizo={item.hizo === false}
							class:falta={mostrarFaltantes && item.hizo === null}
						>
							<div class="item-enunciado">
								<span class="texto">{item.texto}</span>
								{#if data.checklist.ponderado}
									<span class="peso" title="Peso del ítem">{item.peso}</span>
								{/if}
							</div>
							<div class="decision" role="group" aria-label={item.texto}>
								{#each [true, false] as elegida (elegida)}
									<form
										method="POST"
										action="?/marcar"
										use:enhance={() => marcar(item, elegida)}
									>
										<input type="hidden" name="itemId" value={item.id} />
										<input type="hidden" name="marca" value={marcaAEnviar(item.hizo, elegida)} />
										<button
											type="submit"
											class={elegida ? 'opcion-hizo' : 'opcion-no-hizo'}
											aria-pressed={item.hizo === elegida}
											disabled={enviada}
										>
											<Icono nombre={elegida ? 'tilde' : 'cerrar'} tamano={16} grosor={3} />
											{elegida ? 'Hizo' : 'No hizo'}
										</button>
									</form>
								{/each}
							</div>
						</div>
					{/each}
				</div>

				{#if !enviada}
					{#if confirmandoEnvio}
						<div class="tarjeta">
							<p>
								Vas a enviar el checklist con <strong>{hechos} hizo</strong> y
								<strong>{noHechos} no hizo</strong>, {cifra(puntos)} de {cifra(maximo)} puntos.
								Después no se puede modificar.
							</p>
							<div class="confirmacion">
								<form
									method="POST"
									action="?/enviar"
									use:enhance={() => {
										enviando = true;
										return async ({ update }) => {
											await update({ reset: false });
											// Enviado: a partir de acá manda lo que devuelve el servidor.
											marcas = {};
											falloDeMarca = null;
											enviando = false;
											confirmandoEnvio = false;
										};
									}}
								>
									<button class="boton enviar bloque" type="submit" disabled={enviando}>
										<Icono nombre="enviar" />
										{enviando ? 'Enviando…' : 'Confirmar el envío'}
									</button>
								</form>
								<button
									class="boton secundario bloque"
									type="button"
									onclick={() => (confirmandoEnvio = false)}
									disabled={enviando}
								>
									Volver al checklist
								</button>
							</div>
						</div>
					{:else}
						{#if mostrarFaltantes && faltan > 0}
							<div class="aviso alerta" role="alert">
								<Icono nombre="alerta" />
								<span>
									{faltan === 1
										? 'Falta marcar 1 ítem: indicá si lo hizo o no lo hizo.'
										: `Faltan marcar ${faltan} ítems: indicá en cada uno si lo hizo o no lo hizo.`}
								</span>
							</div>
						{/if}
						<div class="barra-accion">
							<button class="boton enviar bloque" type="button" onclick={pedirEnvio}>
								<Icono nombre="enviar" />
								Enviar checklist
							</button>
						</div>
					{/if}
				{/if}
			{/if}
		{:else if practica}
			<div class="tarjeta">
				<div class="tarjeta-cabecera">
					<h2>Durante el ciclo</h2>
				</div>
				<p>Tu rol es practicar la técnica: no vas a usar el sistema mientras la ejecutás.</p>
				<a class="boton secundario bloque" href="/m/{data.curso?.codigo}/{data.mesa.numero}/consulta">
					<Icono nombre="resultado" />
					Ver lo registrado sobre tu ciclo
				</a>
			</div>
		{/if}

		<!-- El docente no rota: su lugar de facilitador se le abre en cada corrida que
		     habilite. Lo que necesita es volver a conducir la mesa, y sin esto quedaba
		     encerrado acá con la sola flecha de la barra. -->
		{#if data.conduceLaMesa}
			<div class="avanzar">
				<h2 class="t-sub" style="margin-bottom: 12px">Seguís conduciendo la mesa</h2>
				<a class="boton bloque" href="/mesas/{data.curso?.codigo}/{data.mesa.numero}">
					<Icono nombre="atras" />
					Volver a conducir la mesa
				</a>
			</div>
		{:else if enviada}
			<!-- Enviado el checklist, lo que sigue es la corrida siguiente. Sin esto había
			     que volver a escanear el QR y tipear el DNI de nuevo para rotar de rol. -->
			<div class="avanzar">
				{#if data.mesaCerrada}
					<h2 class="t-sub">La mesa está cerrada</h2>
				{:else if !data.siguienteCorrida}
					<h2 class="t-sub">El ciclo {data.corrida.numero} es el que sigue abierto</h2>
					<p class="detalle" style="margin-bottom: 12px">
						Cuando el líder de mesa habilite el siguiente, vas a poder entrar desde acá.
					</p>
					<a
						class="boton secundario bloque"
						href="/m/{data.curso?.codigo}/{data.mesa.numero}/participacion/{data.participacion.id}"
						data-sveltekit-reload
					>
						<Icono nombre="reloj" />
						Buscar de nuevo
					</a>
				{:else if data.siguienteCorrida.participacionId}
					<h2 class="t-sub" style="margin-bottom: 12px">
						Ya estás en el ciclo {data.siguienteCorrida.numero}
					</h2>
					<a
						class="boton bloque"
						href="/m/{data.curso?.codigo}/{data.mesa.numero}/participacion/{data.siguienteCorrida
							.participacionId}"
					>
						Ir al ciclo {data.siguienteCorrida.numero}
						<Icono nombre="adelante" />
					</a>
				{:else}
					<h2 class="t-sub" style="margin-bottom: 12px">
						Avanzar al ciclo {data.siguienteCorrida.numero}
					</h2>
					<form
						method="POST"
						action="?/avanzar"
						use:enhance={() => {
							avanzando = true;
							return async ({ update }) => {
								await update({ reset: false });
								avanzando = false;
							};
						}}
					>
						<fieldset class="roles">
							<legend>El rol que vas a ocupar en el ciclo {data.siguienteCorrida.numero}</legend>
							{#each data.roles as rol (rol.codigo)}
								<label class="rol">
									<input type="radio" name="rolCodigo" value={rol.codigo} required />
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
							<button class="boton bloque" type="submit" disabled={avanzando}>
								{avanzando ? 'Registrando…' : `Entrar al ciclo ${data.siguienteCorrida.numero}`}
								{#if !avanzando}<Icono nombre="adelante" />{/if}
							</button>
						</div>
					</form>
				{/if}
			</div>
		{/if}
	</div>
</div>
