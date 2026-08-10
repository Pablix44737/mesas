<script lang="ts">
	import { enhance } from '$app/forms';
	import Icono from '$lib/Icono.svelte';
	import BarraSuperior from '$lib/BarraSuperior.svelte';
	import { mostrarDni } from '$lib/dni';
	import { mostrarTamano } from '$lib/planificacion';
	import { esObservador, iconoDeRol, practicaLaTecnica } from '$lib/roles';

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
	let marcas = $state<Record<string, boolean>>({});
	let falloDeMarca = $state<string | null>(null);
	let confirmandoEnvio = $state(false);
	let enviando = $state(false);

	const enviada = $derived(data.enviadaEn !== null);
	const observa = $derived(esObservador(data.participacion.rolCodigo));
	const practica = $derived(practicaLaTecnica(data.participacion.rolCodigo));

	const items = $derived(
		(data.checklist?.items ?? []).map((item) => ({
			...item,
			cumplido: marcas[item.id] ?? item.cumplido
		}))
	);

	const cumplidos = $derived(items.filter((item) => item.cumplido).length);
	const puntos = $derived(
		items.reduce((total, item) => total + (item.cumplido ? item.peso : 0), 0)
	);
	const maximo = $derived(data.checklist?.maximo ?? 0);
	const porcentaje = $derived(maximo > 0 ? Math.round((puntos / maximo) * 100) : 0);

	const cifra = (n: number) => Math.round(n * 100) / 100;

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
		volverA="/m/{data.mesa.numero}"
		titulo="Mesa {data.mesa.numero}"
		sub={data.escenario?.nombre ?? ''}
	>
		{#snippet derecha()}
			<span class="chip azul sin-punto">Corrida {data.corrida.numero}</span>
		{/snippet}
	</BarraSuperior>

	<div class="envoltorio">
		<div class="tarjeta">
			<div class="fila">
				<span class="avatar-rol" class:gris={!observa}>
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
					Podés seguir trabajando igual: tu registro quedó hecho y el administrador lo completa
					cuando te incorpore. Si te equivocaste al tipear, avisale al líder de mesa.
				</span>
			</div>
		{/if}

		{#if !data.corrida.habilitada && !enviada}
			<div class="aviso alerta">
				<Icono nombre="reloj" />
				<span>Esta corrida ya fue cerrada por el líder. Lo que ves quedó registrado en ella.</span>
			</div>
		{/if}

		{#if form?.mensaje || falloDeMarca}
			<div class="aviso error" role="alert">
				<Icono nombre="error" />
				<span>{form?.mensaje ?? falloDeMarca}</span>
			</div>
		{/if}

		{#each data.pendientes as pendiente (pendiente.participacionId)}
			<div class="tarjeta">
				<div class="aviso alerta" style="margin: 0 0 12px">
					<Icono nombre="alerta" />
					<span>
						<strong>Te quedó un checklist sin enviar</strong> de la corrida
						{pendiente.corridaNumero}, cuando fuiste {pendiente.rol}:
						{pendiente.marcados} de {pendiente.items} ítems marcados.
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

		{#if data.participacion.rolCodigo === 'facilitador'}
			<div class="tarjeta">
				<div class="tarjeta-cabecera">
					<h2>Planificación del escenario</h2>
					<Icono nombre="planificacion" />
				</div>
				{#if data.escenario?.planificacion_archivo}
					<a
						class="boton secundario bloque"
						href="/m/{data.mesa.numero}/planificacion"
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
						<span>
							La planificación de este escenario no está disponible: el administrador todavía
							no la adjuntó.
						</span>
					</div>
				{/if}
			</div>
		{:else if observa}
			{#if !data.checklist}
				<div class="aviso alerta">
					<Icono nombre="alerta" />
					<span>
						El escenario de esta mesa todavía no tiene asociado un checklist de la técnica.
						Avisale al líder de mesa.
					</span>
				</div>
			{:else}
				{#if enviada}
					<div class="aviso exito" role="status">
						<Icono nombre="tilde-circulo" />
						<span>
							<strong>Checklist enviado.</strong> Quedó registrado el {fechaDeEnvio} junto con
							tu rol, la corrida y la mesa, y ya no admite cambios.
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
							{cumplidos} de {items.length} ítems · {porcentaje}%
						</span>
					</div>
					<div class="barra" role="presentation">
						<span style="width: {porcentaje}%"></span>
					</div>
				</div>

				{#if !enviada}
					<p class="detalle" style="margin-bottom: 12px">Tocá cada ítem al observarlo.</p>
				{/if}

				<div class="items">
					{#each items as item (item.id)}
						<form
							method="POST"
							action="?/marcar"
							use:enhance={() => {
								const antes = item.cumplido;
								marcas[item.id] = !antes;
								// Sin `update()`: recargar en cada toque hacía que respuestas fuera
								// de orden pisaran marcas ya hechas.
								return async ({ result }) => {
									if (result.type === 'failure') {
										marcas[item.id] = antes;
										falloDeMarca =
											(result.data?.mensaje as string) ??
											'No se pudo registrar la marca. Probá de nuevo.';
									} else if (result.type === 'error') {
										marcas[item.id] = antes;
										falloDeMarca = 'Se perdió la conexión. La marca no quedó registrada.';
									} else {
										falloDeMarca = null;
									}
								};
							}}
						>
							<input type="hidden" name="itemId" value={item.id} />
							<input type="hidden" name="cumplido" value={item.cumplido ? 'false' : 'true'} />
							<button
								type="submit"
								class="item"
								aria-pressed={item.cumplido}
								disabled={enviada}
							>
								<span class="marca"><Icono nombre="tilde" tamano={16} grosor={3} /></span>
								<span class="texto">{item.texto}</span>
								{#if data.checklist.ponderado}
									<span class="peso" title="Peso del ítem">{item.peso}</span>
								{/if}
							</button>
						</form>
					{/each}
				</div>

				{#if !enviada}
					{#if confirmandoEnvio}
						<div class="tarjeta">
							<p>
								Vas a enviar el checklist con <strong>{cumplidos} de {items.length}</strong>
								ítems marcados, {cifra(puntos)} de {cifra(maximo)} puntos. El envío cierra la
								evaluación y no se puede modificar.
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
									Seguir observando
								</button>
							</div>
						</div>
					{:else}
						<div class="barra-accion">
							<button
								class="boton enviar bloque"
								type="button"
								onclick={() => (confirmandoEnvio = true)}
							>
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
					<h2>Durante la corrida</h2>
					<Icono nombre="reloj" />
				</div>
				<p>Tu rol es practicar la técnica: no vas a usar el sistema mientras la ejecutás.</p>
				<a class="boton secundario bloque" href="/m/{data.mesa.numero}/consulta">
					<Icono nombre="resultado" />
					Ver lo registrado sobre tu corrida
				</a>
			</div>
		{/if}
	</div>
</div>
