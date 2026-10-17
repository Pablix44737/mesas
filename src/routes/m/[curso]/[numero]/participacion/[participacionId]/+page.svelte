<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import Icono from '$lib/Icono.svelte';
	import ElegirRol from '$lib/ElegirRol.svelte';
	import { mostrarDni } from '$lib/dni';
	import { mostrarTamano } from '$lib/planificacion';
	import { iconoDeRol, llevaChecklist, practicaLaTecnica } from '$lib/roles';

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
	/** La marca que el servidor rechazó: el error va debajo de ese ítem. */
	let falloDeMarca = $state<{ itemId: string; mensaje: string } | null>(null);
	let confirmandoEnvio = $state(false);
	/** Se intentó enviar con ítems sin marcar: se los resalta hasta completarlos. */
	let mostrarFaltantes = $state(false);
	let enviando = $state(false);
	let avanzando = $state(false);
	let rolNuevo = $state('');
	let rolNuevoFalta = $state(false);
	/** Qué formulario mandó el último `form?.mensaje`, para mostrarlo en su lugar. */
	let accion = $state<'enviar' | 'avanzar' | null>(null);

	const enviada = $derived(data.enviadaEn !== null);
	const practica = $derived(practicaLaTecnica(data.participacion.rolCodigo));
	const evalua = $derived(llevaChecklist(data.participacion.checklistOrigen));
	// El facilitador es el único que recibe las dos cosas: la planificación para
	// guiar el ciclo y la lista de cotejo de la técnica para evaluarla.
	const facilita = $derived(data.participacion.rolCodigo === 'facilitador');
	const raiz = $derived(`/m/${data.curso?.codigo}/${data.mesa.numero}`);
	const marcando = $derived(evalua && Boolean(data.checklist) && !enviada);

	/** `true` es «Hizo», `false` es «No hizo» y `null`, sin marcar. */
	const items = $derived(
		(data.checklist?.items ?? []).map((item, posicion) => ({
			...item,
			numero: posicion + 1,
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
	const primeroSinMarcar = $derived(items.find((item) => item.hizo === null)?.id ?? null);

	const cifra = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });
	const conteos = $derived(`${hechos} hizo · ${noHechos} no hizo`);
	const parte = (n: number) => (items.length > 0 ? (n / items.length) * 100 : 0);

	const mensajeDe = (de: 'enviar' | 'avanzar') =>
		form?.mensaje && accion === de ? form.mensaje : null;
	// Sin JavaScript no se sabe qué formulario respondió: va arriba.
	const mensajeSuelto = $derived(form?.mensaje && accion === null ? form.mensaje : null);

	/**
	 * Marca un ítem sin recargar la página. Tocar la marca que ya tiene la quita.
	 * Si el servidor la rechaza, el ítem vuelve a como estaba.
	 */
	function marcar(item: { id: string; hizo: boolean | null }, elegida: boolean) {
		const antes = item.hizo;
		marcas[item.id] = antes === elegida ? null : elegida;
		if (falloDeMarca?.itemId === item.id) falloDeMarca = null;
		// Sin `update()`: recargar en cada toque hacía que respuestas fuera de orden
		// pisaran marcas ya hechas.
		return async ({ result }: { result: { type: string; data?: Record<string, unknown> } }) => {
			if (result.type === 'failure') {
				marcas[item.id] = antes;
				falloDeMarca = {
					itemId: item.id,
					mensaje:
						(result.data?.mensaje as string) ?? 'No se pudo registrar la marca. Probá de nuevo.'
				};
			} else if (result.type === 'error') {
				marcas[item.id] = antes;
				falloDeMarca = {
					itemId: item.id,
					mensaje: 'Se perdió la conexión. La marca no quedó registrada.'
				};
			}
		};
	}

	/** Lo que se manda al tocar un botón: la marca elegida, o quitarla si ya la tenía. */
	const marcaAEnviar = (actual: boolean | null, elegida: boolean) =>
		actual === elegida ? 'sin_marcar' : elegida ? 'hizo' : 'no_hizo';

	function irAlPrimeroSinMarcar() {
		if (!primeroSinMarcar) return;
		document
			.getElementById(`item-${primeroSinMarcar}`)
			?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	function pedirEnvio() {
		accion = null;
		if (faltan > 0) {
			mostrarFaltantes = true;
			irAlPrimeroSinMarcar();
			return;
		}
		confirmandoEnvio = true;
	}

	const enfocar = (nodo: HTMLElement) => nodo.focus();

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

{#snippet senal(hizo: boolean)}
	<Icono nombre={hizo ? 'tilde' : 'cerrar'} tamano={16} grosor={3} />
{/snippet}

<div class="cotejo-pagina">
	<header class="mesa-cabecera">
		<div class="mesa-cabecera-dentro cotejo-angosto">
			<div class="mesa-navegacion">
				<a class="mesa-volver" href={data.volverA}>
					<Icono nombre="atras" />
					{data.conduceLaMesa ? 'Conducir la mesa' : `Mesa ${data.mesa.numero}`}
				</a>
			</div>
			<div class="mesa-titulo-fila">
				<div class="mesa-titulo">
					<div class="sumarse-titulo">
						<h1>Mesa {data.mesa.numero}</h1>
						<span class="estado-mesa" class:en-curso={data.corrida.habilitada}>
							{#if data.corrida.habilitada}<span class="punto"></span>{/if}
							Ciclo {data.corrida.numero}
						</span>
					</div>
					{#if data.escenario?.nombre}
						<p class="sumarse-escenario">{data.escenario.nombre}</p>
					{/if}
					{#if data.curso?.nombre}
						<p class="mesa-escenario sumarse-curso">{data.curso.nombre}</p>
					{/if}
				</div>
			</div>
		</div>
	</header>

	<main class="entrar-cuerpo cotejo-angosto">
		<section class="mesa-tarjeta cotejo-yo">
			<span class="cotejo-yo-icono" class:evalua>
				<Icono nombre={iconoDeRol[data.participacion.rolCodigo] ?? 'operador'} tamano={22} grosor={2} />
			</span>
			<div>
				{#if data.participacion.nombre}
					<p class="cotejo-yo-intro">Te identificamos como</p>
					<p class="cotejo-yo-nombre">{data.participacion.nombre}</p>
					<p class="cotejo-yo-detalle">
						DNI {mostrarDni(data.participacion.dni)} · {data.participacion.rolNombre}{data.conduceLaMesa
							? ' · Conducís la mesa'
							: ''}
					</p>
				{:else}
					<p class="cotejo-yo-intro">Quedaste registrado como</p>
					<p class="cotejo-yo-nombre">{data.participacion.rolNombre}</p>
					<p class="cotejo-yo-detalle">DNI {mostrarDni(data.participacion.dni)}</p>
				{/if}
			</div>
		</section>

		{#if !data.participacion.nombre}
			<div class="entrar-aviso">
				<Icono nombre="alerta" />
				<span>
					No encontramos el DNI {mostrarDni(data.participacion.dni)} en el padrón. Podés seguir igual.
					Si te equivocaste al tipear, avisale al líder de mesa.
				</span>
			</div>
		{/if}

		{#if !data.corrida.habilitada && !enviada}
			<div class="entrar-aviso">
				<Icono nombre="candado" />
				<span>Este ciclo ya fue cerrado por el líder.</span>
			</div>
		{/if}

		{#if mensajeSuelto}
			<p class="dialogo-error" role="alert">
				<Icono nombre="error" tamano={18} />
				{mensajeSuelto}
			</p>
		{/if}

		{#each data.pendientes as pendiente (pendiente.participacionId)}
			<section class="cotejo-pendiente">
				<p>
					<Icono nombre="alerta" />
					<span>
						Te quedó un checklist sin enviar del ciclo {pendiente.corridaNumero}, cuando fuiste
						{pendiente.rol}: <strong>{pendiente.marcados} de {pendiente.items} ítems marcados.</strong>
					</span>
				</p>
				<a class="boton bloque cotejo-pendiente-boton" href="{raiz}/participacion/{pendiente.participacionId}">
					Terminar y enviarlo
					<Icono nombre="avanzar" tamano={18} grosor={2.25} />
				</a>
			</section>
		{/each}

		{#if facilita}
			{#if data.escenario?.planificacion_archivo}
				<a class="cotejo-planificacion" href="{raiz}/planificacion" target="_blank" rel="noopener">
					<span class="cotejo-planificacion-icono"><Icono nombre="planificacion" tamano={22} /></span>
					<span class="cotejo-planificacion-texto">
						<strong>Planificación del escenario</strong>
						<span>
							{data.escenario.planificacion_archivo} · {mostrarTamano(
								data.escenario.planificacion_tamano ?? 0
							)}
						</span>
					</span>
					<Icono nombre="externo" tamano={18} />
				</a>
			{:else}
				<p class="mesa-tarjeta cotejo-nota">La planificación de este escenario todavía no está disponible.</p>
			{/if}
		{/if}

		{#if practica}
			<section class="mesa-tarjeta cotejo-bloque">
				<h2>Durante el ciclo</h2>
				<p>Tu rol es practicar la técnica: no vas a usar el sistema mientras la ejecutás.</p>
				<a class="boton secundario bloque" href="{raiz}/consulta">Ver lo registrado sobre tu ciclo</a>
			</section>
		{/if}

		{#if enviada && data.checklist}
			<section class="mesa-tarjeta cotejo-enviado" role="status">
				<p class="cotejo-enviado-aviso">
					<Icono nombre="tilde-circulo" />
					<span>Checklist enviado el {fechaDeEnvio}. Ya no admite cambios.</span>
				</p>
				<p class="cotejo-enviado-puntaje">
					<strong>{cifra(puntos)} de {cifra(maximo)}</strong>
					<span>{conteos}</span>
				</p>
			</section>
		{/if}

		<!-- El docente no rota: su lugar de facilitador se le abre en cada ciclo que
		     habilite. Lo que necesita es volver a conducir la mesa. -->
		{#if data.conduceLaMesa}
			{#if enviada}
				<section class="mesa-tarjeta cotejo-bloque">
					<h2>Seguís conduciendo la mesa</h2>
					<a class="boton enviar bloque" href="/mesas/{data.curso?.codigo}/{data.mesa.numero}">
						Volver a conducir la mesa
						<Icono nombre="avanzar" tamano={20} grosor={2.25} />
					</a>
				</section>
			{/if}
		{:else if enviada || practica}
			<!-- Lo que sigue es el ciclo siguiente: sin esto había que volver a escanear
			     el QR y tipear el DNI de nuevo para rotar de rol. -->
			<section class="mesa-tarjeta cotejo-bloque">
				{#if data.mesaCerrada}
					<p class="cotejo-cerrada">
						<Icono nombre="candado" />
						La mesa está cerrada.
					</p>
				{:else if !data.siguienteCorrida}
					<h2>El ciclo {data.corrida.numero} es el que sigue abierto</h2>
					<p class="cotejo-suave">
						Cuando el líder de mesa habilite el siguiente, vas a poder entrar desde acá.
					</p>
					<a
						class="boton secundario bloque"
						href="{raiz}/participacion/{data.participacion.id}"
						data-sveltekit-reload
					>
						<Icono nombre="reabrir" tamano={18} />
						Buscar de nuevo
					</a>
				{:else if data.siguienteCorrida.participacionId}
					<h2>Ya estás en el ciclo {data.siguienteCorrida.numero}</h2>
					<a
						class="boton enviar bloque"
						href="{raiz}/participacion/{data.siguienteCorrida.participacionId}"
					>
						Ir al ciclo {data.siguienteCorrida.numero}
						<Icono nombre="avanzar" tamano={20} grosor={2.25} />
					</a>
				{:else}
					<h2>Avanzar al ciclo {data.siguienteCorrida.numero}</h2>
					{#if mensajeDe('avanzar')}
						<p class="dialogo-error" role="alert">
							<Icono nombre="error" tamano={18} />
							{mensajeDe('avanzar')}
						</p>
					{/if}
					<form
						class="cotejo-avanzar"
						method="POST"
						action="?/avanzar"
						novalidate
						use:enhance={({ cancel }) => {
							if (!rolNuevo) {
								rolNuevoFalta = true;
								cancel();
								return;
							}
							accion = 'avanzar';
							avanzando = true;
							return async ({ update }) => {
								await update({ reset: false });
								avanzando = false;
							};
						}}
					>
						<ElegirRol
							roles={data.roles}
							leyenda="Tu rol en el ciclo {data.siguienteCorrida.numero}"
							bind:elegido={rolNuevo}
							error={rolNuevoFalta ? 'Elegí el rol que vas a ocupar en el ciclo nuevo.' : null}
							onelegir={() => (rolNuevoFalta = false)}
						/>
						<button class="boton enviar bloque cotejo-entrar" type="submit" disabled={avanzando}>
							{avanzando ? 'Registrando…' : `Entrar al ciclo ${data.siguienteCorrida.numero}`}
							{#if !avanzando}<Icono nombre="avanzar" tamano={20} grosor={2.25} />{/if}
						</button>
					</form>
				{/if}
			</section>
		{/if}

		{#if evalua}
			{#if !data.checklist}
				<p class="mesa-tarjeta cotejo-nota">
					Todavía no hay un checklist cargado para tu rol. Avisale al líder de mesa.
				</p>
			{:else}
				<section class="cotejo-lista" aria-labelledby="cotejo-nombre">
					<div class="cotejo-lista-cabecera">
						<p class="rotulo-chico">{enviada ? 'Tus marcas' : 'Tu checklist'}</p>
						<h2 id="cotejo-nombre">{data.checklist.nombre}</h2>
						{#if !enviada}
							<p class="cotejo-suave">Marcá en cada ítem si lo hizo o no lo hizo.</p>
						{/if}
					</div>

					{#each items as item (item.id)}
						{@const falta = marcando && mostrarFaltantes && item.hizo === null}
						{@const seguis =
							marcando && !mostrarFaltantes && item.id === primeroSinMarcar && faltan < items.length}
						<article
							class="cotejo-item"
							id="item-{item.id}"
							class:marcado={item.hizo !== null}
							class:falta
							class:seguis
						>
							<div class="cotejo-item-fila">
								<span
									class="cotejo-numero"
									class:hizo={item.hizo === true}
									class:no-hizo={item.hizo === false}
								>
									{item.numero}
								</span>
								<div class="cotejo-item-texto">
									{#if falta}
										<span class="cotejo-etiqueta falta">Falta marcar</span>
									{:else if seguis}
										<span class="cotejo-etiqueta">Seguís acá</span>
									{/if}
									<p>{item.texto}</p>
									{#if data.checklist.ponderado}
										<span class="cotejo-peso">Peso {cifra(item.peso)}</span>
									{/if}
								</div>
								{#if enviada}
									<span class="cotejo-marca" class:hizo={item.hizo === true}>
										{#if item.hizo !== null}
											{@render senal(item.hizo)}
											{item.hizo ? 'Hizo' : 'No hizo'}
										{/if}
									</span>
								{/if}
							</div>

							{#if !enviada}
								<div class="cotejo-decision" role="group" aria-label="Ítem {item.numero}">
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
											>
												{@render senal(elegida)}
												{elegida ? 'Hizo' : 'No hizo'}
											</button>
										</form>
									{/each}
								</div>
							{/if}

							{#if falloDeMarca?.itemId === item.id}
								<p class="campo-error" role="alert">
									<Icono nombre="error" tamano={16} />{falloDeMarca.mensaje}
								</p>
							{/if}
						</article>
					{/each}
				</section>

				{#if marcando}
					<!-- Fija abajo mientras se marca; al final de la lista queda en su lugar. -->
					<div class="cotejo-barra">
						{#if mensajeDe('enviar')}
							<p class="cotejo-barra-aviso error" role="alert">
								<Icono nombre="error" tamano={18} />
								<span>{mensajeDe('enviar')}</span>
							</p>
						{:else if mostrarFaltantes && faltan > 0}
							<p class="cotejo-barra-aviso" role="alert">
								<Icono nombre="alerta" tamano={18} />
								<span>
									{faltan === 1
										? 'Falta marcar 1 ítem: indicá si lo hizo o no lo hizo.'
										: `Faltan marcar ${faltan} ítems: indicá en cada uno si lo hizo o no lo hizo.`}
								</span>
							</p>
						{/if}

						<div class="cotejo-progreso">
							<div class="cotejo-progreso-datos">
								<div class="cotejo-progreso-fila">
									<strong>{cifra(puntos)} de {cifra(maximo)}</strong>
									<span class="cotejo-progreso-barra" aria-hidden="true">
										<span class="hizo" style="width: {parte(hechos)}%"></span>
										<span class="no-hizo" style="width: {parte(noHechos)}%"></span>
									</span>
								</div>
								<p>{conteos}{faltan === 0 ? ' · todo marcado' : ''}</p>
							</div>
							{#if faltan > 0}
								<button class="cotejo-ir" type="button" onclick={irAlPrimeroSinMarcar}>
									{faltan === 1 ? '1 sin marcar' : `${faltan} sin marcar`}
									<Icono nombre="abajo" tamano={16} grosor={2.25} />
								</button>
							{/if}
						</div>

						<button class="boton enviar bloque" type="button" onclick={pedirEnvio}>
							Enviar checklist
							<Icono nombre="enviar" tamano={18} />
						</button>
					</div>
				{/if}
			{/if}
		{/if}
	</main>
</div>

{#if confirmandoEnvio && marcando}
	<!-- Hoja que sube desde abajo en el teléfono; diálogo centrado en pantallas anchas. -->
	<div
		class="mesa-velo"
		role="presentation"
		onclick={(e) => e.target === e.currentTarget && !enviando && (confirmandoEnvio = false)}
	>
		<div
			class="mesa-dialogo"
			role="dialog"
			aria-modal="true"
			aria-labelledby="envio-titulo"
			tabindex="-1"
			use:enfocar
		>
			<span class="asa" aria-hidden="true"></span>
			<h2 id="envio-titulo">¿Enviar el checklist?</h2>
			<p class="dialogo-texto cotejo-resumen">
				Vas a enviar el checklist con <strong>{hechos} hizo</strong> y
				<strong>{noHechos} no hizo</strong>, {cifra(puntos)} de {cifra(maximo)} puntos. Después no se
				puede modificar.
			</p>
			<div class="dialogo-botones">
				<button
					class="boton secundario"
					type="button"
					onclick={() => (confirmandoEnvio = false)}
					disabled={enviando}
				>
					Volver al checklist
				</button>
				<form
					method="POST"
					action="?/enviar"
					use:enhance={() => {
						accion = 'enviar';
						enviando = true;
						return async ({ update, result }) => {
							await update({ reset: false });
							enviando = false;
							confirmandoEnvio = false;
							if (result.type === 'success') {
								// Enviado: a partir de acá manda lo que devuelve el servidor.
								marcas = {};
								falloDeMarca = null;
								mostrarFaltantes = false;
								await tick();
								window.scrollTo({ top: 0, behavior: 'smooth' });
							}
						};
					}}
				>
					<button class="boton enviar" type="submit" disabled={enviando}>
						{enviando ? 'Enviando…' : 'Confirmar el envío'}
					</button>
				</form>
			</div>
		</div>
	</div>
{/if}
