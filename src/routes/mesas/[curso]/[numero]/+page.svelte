<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import Icono from '$lib/Icono.svelte';
	import { mostrarDni } from '$lib/dni';
	import { mostrarTamano } from '$lib/planificacion';
	import { abreviaturaDeRol } from '$lib/roles';

	let { data, form } = $props();

	let habilitando = $state(false);
	let cerrando = $state(false);
	let guardandoDocente = $state(false);
	/** La confirmación abierta: pasar al ciclo siguiente o cerrar la mesa. */
	let confirmando = $state<'siguiente' | 'cierre' | null>(null);
	let pestana = $state<'ciclo' | 'recorrido'>('ciclo');
	/**
	 * El modo corregir. Mientras está apagado la lista del ciclo queda como
	 * siempre: lo normal es mirarla, no tocarla. Se enciende cuando alguien se
	 * equivocó de rol o entró a la mesa que no era.
	 */
	let corrigiendo = $state(false);
	/** A quién se está por sacar del ciclo, mientras se confirma. */
	let sacando = $state<Participante | null>(null);
	let saliendo = $state(false);
	let materialAbierto = $state(false);
	let confirmandoSinDocente = $state(false);
	/** El mensaje que el líder ya cerró, para no volver a mostrarlo. */
	let avisoDescartado = $state.raw<unknown>(null);

	/**
	 * Lo que se eligió a mano. Mientras valga `undefined` manda el estado de la
	 * mesa: el QR arranca a la vista salvo con la mesa cerrada, y el formulario del
	 * docente se reabre si el servidor rechazó lo que se cargó.
	 */
	let qrAMano = $state<boolean | undefined>(undefined);
	let editandoAMano = $state<boolean | undefined>(undefined);

	const enCurso = $derived(data.corridaEnCurso);
	const sinCiclos = $derived(data.corridas.length === 0);
	const cerrada = $derived(!data.corridaEnCurso && data.corridas.length > 0);
	const siguiente = $derived((data.corridas[0]?.numero ?? 0) + 1);
	const mostrarQr = $derived(qrAMano ?? !cerrada);

	const raiz = $derived(`/mesas/${data.curso.codigo}/${data.mesa.numero}`);
	const direccion = $derived(
		`${data.origen}/m/${data.curso.codigo}/${data.mesa.numero}`.replace(/^https?:\/\//, '')
	);

	const errorDelDocente = $derived(form?.delDocente ? form.mensaje : null);
	const editandoDocente = $derived(editandoAMano ?? Boolean(form?.delDocente));

	const aviso = $derived(
		form && !form.delDocente && form !== avisoDescartado && (form.mensaje || form.exito)
			? { error: Boolean(form.mensaje), texto: (form.mensaje ?? form.exito) as string }
			: null
	);

	/** Una fila por rol del ciclo; un rol que nadie ocupó queda a la vista como tal. */
	type Participante = (typeof data.participantes)[number];
	const filasDelCiclo = $derived(
		data.rolesDeLaMesa.flatMap((rol): { rol: typeof rol; persona: Participante | null }[] => {
			const quienes = data.participantes.filter((p) => p.rolCodigo === rol.codigo);
			return quienes.length > 0
				? quienes.map((persona) => ({ rol, persona }))
				: [{ rol, persona: null }];
		})
	);
	const nadieEntro = $derived(filasDelCiclo.every((fila) => fila.persona === null));

	const recorridoDe = (dni: string) => data.recorrido.find((p) => p.dni === dni);
	const pendienteDe = (participacionId: string) =>
		data.sinEnviar.find((p) => p.participacionId === participacionId);

	// Quien conduce la mesa va primero: es la fila que no rota.
	const recorridoOrdenado = $derived(
		[...data.recorrido].sort((a, b) => Number(b.conduceLaMesa) - Number(a.conduceLaMesa))
	);

	const hora = (fecha: string) =>
		new Date(fecha).toLocaleTimeString('es-AR', {
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		});

	const ciclos = (n: number) => (n === 1 ? 'un ciclo' : `${n} ciclos`);

	function cancelarConfirmacion() {
		if (!habilitando && !cerrando) confirmando = null;
	}

	function cancelarSalida() {
		if (!saliendo) sacando = null;
	}

	function abrirEdicionDocente() {
		editandoAMano = true;
		confirmandoSinDocente = false;
	}

	function cerrarEdicionDocente() {
		editandoAMano = false;
		confirmandoSinDocente = false;
	}

	const enfocar = (nodo: HTMLElement) => nodo.focus();

	// El material se consulta de vez en cuando: plegado en el teléfono, abierto
	// donde sobra lugar.
	onMount(() => {
		materialAbierto = window.matchMedia('(min-width: 900px)').matches;
	});
</script>

<svelte:head>
	<title>Mesa {data.mesa.numero} — SIMUNaM</title>
</svelte:head>

<svelte:window
	onkeydown={(e) => {
		if (e.key !== 'Escape') return;
		if (sacando) cancelarSalida();
		else if (confirmando) cancelarConfirmacion();
	}}
/>

{#snippet botonHabilitar(texto: string)}
	<button class="boton enviar" type="submit" disabled={habilitando}>
		{habilitando ? 'Habilitando…' : texto}
		{#if !habilitando}<Icono nombre="avanzar" tamano={20} grosor={2.25} />{/if}
	</button>
{/snippet}

{#snippet nombreDe(persona: { nombre: string | null; dni: string })}
	{persona.nombre ?? `DNI ${mostrarDni(persona.dni)}`}
{/snippet}

<div class="mesa-pagina">
	<header class="mesa-cabecera">
		<div class="mesa-cabecera-dentro">
			<div class="mesa-navegacion">
				<a class="mesa-volver" href="/mesas">
					<Icono nombre="atras" />
					Mis mesas
				</a>
				<button
					class="boton secundario mesa-boton-qr"
					type="button"
					aria-pressed={mostrarQr}
					onclick={() => (qrAMano = !mostrarQr)}
				>
					<Icono nombre="qr" tamano={18} />
					{mostrarQr ? 'Ocultar QR' : 'Mostrar QR'}
				</button>
			</div>

			<div class="mesa-titulo-fila">
				<div class="mesa-titulo">
					<h1>Mesa {data.mesa.numero}</h1>
					{#if data.escenario?.nombre}
						<p class="mesa-escenario">{data.escenario.nombre}</p>
					{/if}
					{#if enCurso}
						<span class="estado-mesa en-curso">
							<span class="punto" aria-hidden="true"></span>
							Ciclo {enCurso.numero} · en curso desde las {hora(enCurso.creada_en)}
						</span>
					{:else if cerrada}
						<span class="estado-mesa cerrada">
							<Icono nombre="candado" tamano={16} />
							La mesa está cerrada, con {ciclos(data.corridas.length)}
						</span>
					{:else}
						<span class="estado-mesa sin-ciclos">
							<span class="punto" aria-hidden="true"></span>
							Sin ciclos todavía
						</span>
					{/if}
				</div>

				<!-- La acción del momento. En el teléfono queda fija abajo, al alcance del
				     pulgar; en pantallas anchas, al lado del título. -->
				<div class="acciones-mesa">
					{#if enCurso}
						<button class="boton secundario" type="button" onclick={() => (confirmando = 'cierre')}>
							Cerrar la mesa
						</button>
						<button class="boton enviar" type="button" onclick={() => (confirmando = 'siguiente')}>
							Habilitar el ciclo {siguiente}
							<Icono nombre="avanzar" tamano={20} grosor={2.25} />
						</button>
					{:else}
						<form
							method="POST"
							action="?/habilitarSiguiente"
							use:enhance={() => {
								habilitando = true;
								return async ({ update }) => {
									await update({ reset: false });
									habilitando = false;
									pestana = 'ciclo';
								};
							}}
						>
							{#if cerrada}
								<button class="boton secundario reabrir" type="submit" disabled={habilitando}>
									<Icono nombre="reabrir" tamano={18} />
									{habilitando ? 'Habilitando…' : `Reabrirla con el ciclo ${siguiente}`}
								</button>
							{:else}
								{@render botonHabilitar('Habilitar el primer ciclo')}
							{/if}
						</form>
					{/if}
				</div>
			</div>
		</div>
	</header>

	{#if aviso}
		<div class="mesa-aviso" class:error={aviso.error} role={aviso.error ? 'alert' : 'status'}>
			<Icono nombre={aviso.error ? 'error' : 'tilde-circulo'} />
			<span>{aviso.texto}</span>
			<button
				class="icono-boton"
				type="button"
				aria-label="Cerrar mensaje"
				onclick={() => (avisoDescartado = form)}
			>
				<Icono nombre="cerrar" tamano={18} />
			</button>
		</div>
	{/if}

	<main class="mesa-cuerpo">
		<div class="mesa-columna mesa-izquierda">
			{#if mostrarQr}
				<!-- En el teléfono: grande antes del primer ciclo, compacto después. -->
				{#if sinCiclos}
					<section class="mesa-tarjeta qr-grande solo-movil">
						<img
							src="/m/{data.curso.codigo}/{data.mesa.numero}/qr"
							alt="Código QR para entrar a la mesa {data.mesa.numero}"
							width="232"
							height="232"
						/>
						<p class="qr-direccion">{direccion}</p>
						<p class="detalle">Habilitá el primer ciclo para que puedan entrar.</p>
						<a class="boton secundario bloque" href="{raiz}/cartel" target="_blank" rel="noopener">
							Abrir el cartel para proyectar
							<Icono nombre="externo" tamano={16} />
						</a>
					</section>
				{:else}
					<section class="mesa-tarjeta qr-compacto solo-movil">
						<img
							src="/m/{data.curso.codigo}/{data.mesa.numero}/qr"
							alt="Código QR para entrar a la mesa {data.mesa.numero}"
							width="104"
							height="104"
						/>
						<div class="qr-compacto-texto">
							<span class="detalle">Para entrar sin escanear</span>
							<span class="qr-direccion">{direccion}</span>
							<a class="enlace-accion" href="{raiz}/cartel" target="_blank" rel="noopener">
								Abrir el cartel
								<Icono nombre="externo" tamano={15} />
							</a>
						</div>
					</section>
				{/if}
			{/if}

			<section class="mesa-tarjeta personas">
				<div class="mesa-tarjeta-cabecera">
					<h2>{cerrada ? 'Recorrido de la mesa' : 'Personas'}</h2>
					{#if enCurso}
						<span class="detalle">
							{data.participantes.length === 1
								? '1 en el ciclo'
								: `${data.participantes.length} en el ciclo`}
						</span>
					{/if}
				</div>

				{#if data.docente}
					<div class="docente">
						{#if data.docente.dni && !editandoDocente}
							<div class="docente-fila">
								<div class="docente-identidad">
									<span class="rotulo-chico">Conduce la mesa · Facilitador</span>
									{#if data.docente.nombre}
										<span class="nombre">{data.docente.nombre}</span>
										<span class="detalle">DNI {mostrarDni(data.docente.dni)}</span>
									{:else}
										<span class="nombre">DNI {mostrarDni(data.docente.dni)}</span>
										<span class="detalle">No está en el padrón</span>
									{/if}
								</div>
								<button class="enlace-accion" type="button" onclick={abrirEdicionDocente}>
									Cambiar
								</button>
							</div>

							{#if enCurso && data.docente.participacionId}
								<a
									class="docente-tecnica"
									href="/m/{data.curso.codigo}/{data.mesa.numero}/participacion/{data.docente
										.participacionId}"
								>
									<Icono nombre="checklist" />
									<span>
										{data.docente.evaluo
											? `Ver lo que enviaste en el ciclo ${enCurso.numero}`
											: `Completar la técnica del ciclo ${enCurso.numero}`}
									</span>
									<Icono nombre="adelante" tamano={18} />
								</a>
							{:else if sinCiclos}
								<p class="detalle docente-nota">Habilitá el primer ciclo para completar la técnica.</p>
							{/if}
						{:else}
							<form
								method="POST"
								action="?/declararDocente"
								use:enhance={() => {
									guardandoDocente = true;
									return async ({ update, result }) => {
										await update({ reset: false });
										guardandoDocente = false;
										if (result.type === 'success') cerrarEdicionDocente();
									};
								}}
							>
								<span class="rotulo-chico">
									{data.docente.dni ? 'Cambiar quién conduce' : '¿Quién conduce la mesa?'}
								</span>
								<label for="docente-dni">Tu documento</label>
								<div class="docente-campo">
									<input
										id="docente-dni"
										name="dni"
										type="tel"
										inputmode="numeric"
										autocomplete="off"
										placeholder="Ej.: 25444111"
										value={data.docente.dni ?? ''}
										aria-invalid={Boolean(errorDelDocente)}
										aria-describedby="docente-ayuda"
										required
									/>
									<button class="boton" type="submit" disabled={guardandoDocente}>
										{guardandoDocente ? 'Guardando…' : 'Guardar'}
									</button>
								</div>
								{#if errorDelDocente}
									<p class="campo-error" id="docente-ayuda" role="alert">
										<Icono nombre="error" tamano={16} />
										{errorDelDocente}
									</p>
								{:else}
									<p class="ayuda" id="docente-ayuda">
										Solo números, sin puntos. Quedás como facilitador en todos los ciclos.
									</p>
								{/if}
							</form>

							{#if data.docente.dni}
								{#if confirmandoSinDocente}
									<div class="docente-quitar">
										<p>La mesa va a quedar sin nadie que la conduzca. Lo que ya evaluó queda registrado.</p>
										<div class="docente-quitar-botones">
											<form
												method="POST"
												action="?/quitarDocente"
												use:enhance={() => async ({ update }) => {
													await update({ reset: false });
													cerrarEdicionDocente();
												}}
											>
												<button class="boton peligro bloque" type="submit">Dejar sin docente</button>
											</form>
											<button
												class="boton secundario"
												type="button"
												onclick={() => (confirmandoSinDocente = false)}
											>
												No, volver
											</button>
										</div>
									</div>
								{:else}
									<div class="docente-edicion">
										<button class="boton secundario" type="button" onclick={cerrarEdicionDocente}>
											Cancelar
										</button>
										<button
											class="enlace-accion peligroso"
											type="button"
											onclick={() => (confirmandoSinDocente = true)}
										>
											Dejar la mesa sin docente
										</button>
									</div>
								{/if}
							{/if}
						{/if}
					</div>
				{/if}

				{#if enCurso}
					<div class="pestanas" role="group" aria-label="Qué mostrar">
						<button
							type="button"
							aria-pressed={pestana === 'ciclo'}
							onclick={() => (pestana = 'ciclo')}
						>
							Roles del ciclo
						</button>
						<button
							type="button"
							aria-pressed={pestana === 'recorrido'}
							onclick={() => (pestana = 'recorrido')}
						>
							Recorrido
						</button>
					</div>
				{/if}

				{#if sinCiclos}
					<div class="mesa-vacio">
						<strong>Todavía no hay ningún ciclo habilitado</strong>
						<span>Cuando habilites el primero, acá vas a ver quién entra y con qué rol.</span>
					</div>
				{:else if enCurso && pestana === 'ciclo'}
					{#if nadieEntro}
						<div class="mesa-vacio">
							<strong>Todavía no se identificó nadie en este ciclo</strong>
							<span>Mostrales el QR para que entren y elijan su rol.</span>
							{#if !mostrarQr}
								<button class="boton secundario" type="button" onclick={() => (qrAMano = true)}>
									Mostrar el QR
								</button>
							{/if}
						</div>
					{:else}
						<!-- Apagado no cambia nada de la lista; encendido, cada fila ocupada
						     muestra con qué sacar a esa persona del ciclo. -->
						<div class="ciclo-corregir">
							<button
								class="enlace-accion"
								type="button"
								aria-pressed={corrigiendo}
								onclick={() => (corrigiendo = !corrigiendo)}
							>
								{corrigiendo ? 'Listo' : 'Corregir'}
							</button>
						</div>
						<ul class="roles-del-ciclo" class:corrigiendo>
							{#each filasDelCiclo as fila, i (fila.persona?.id ?? `libre-${i}`)}
								{@const persona = fila.persona}
								<li>
									<div class="rol-persona">
										<span class="rotulo-chico">{fila.rol.nombre}</span>
										{#if persona}
											{@const suRecorrido = recorridoDe(persona.dni)}
											<span class="nombre">{@render nombreDe(persona)}</span>
											{#if !persona.nombre}
												<span class="detalle">No está en el padrón</span>
											{/if}
											{#if suRecorrido}
												{#if suRecorrido.conduceLaMesa}
													<span class="falta">Conduce la mesa</span>
												{:else if suRecorrido.faltan.length > 0}
													<span class="falta">Le falta: {suRecorrido.faltan.join(', ')}</span>
												{:else}
													<span class="falta completo">Ya ocupó todos los roles</span>
												{/if}
											{/if}
										{:else}
											<span class="sin-ocupar">Sin ocupar</span>
										{/if}
									</div>
									{#if corrigiendo && persona}
										<button
											class="enlace-accion peligroso"
											type="button"
											onclick={() => (sacando = persona)}
										>
											Sacar del ciclo
										</button>
									{:else if persona?.envio}
										<a class="envio" href="{raiz}/corridas/{enCurso.numero}#p-{persona.id}">
											<Icono nombre="tilde" tamano={16} grosor={2.5} />
											Envió
											<Icono nombre="adelante" tamano={16} />
										</a>
									{:else if persona}
										{@const pendiente = pendienteDe(persona.id)}
										{#if pendiente}
											<span class="progreso-lista">
												{pendiente.marcados} de {pendiente.items} ítems
											</span>
										{/if}
									{/if}
								</li>
							{/each}
						</ul>
					{/if}
				{:else}
					{@render recorrido()}
				{/if}
			</section>
		</div>

		<div class="mesa-columna mesa-derecha">
			{#if mostrarQr}
				<section class="mesa-tarjeta qr-grande solo-escritorio">
					<img
						src="/m/{data.curso.codigo}/{data.mesa.numero}/qr"
						alt="Código QR para entrar a la mesa {data.mesa.numero}"
						width="208"
						height="208"
					/>
					<p class="qr-direccion">{direccion}</p>
					{#if sinCiclos}
						<p class="detalle">Habilitá el primer ciclo para que puedan entrar.</p>
					{/if}
					<a class="boton secundario bloque" href="{raiz}/cartel" target="_blank" rel="noopener">
						Abrir el cartel para proyectar
						<Icono nombre="externo" tamano={16} />
					</a>
				</section>
			{/if}

			{#if !sinCiclos}
				<section class="mesa-tarjeta">
					<div class="mesa-tarjeta-cabecera">
						<h2>Lo evaluado</h2>
					</div>
					<ul class="lo-evaluado">
						{#each data.corridas as corrida (corrida.id)}
							<li>
								<a href="{raiz}/corridas/{corrida.numero}">
									<span class="ciclo">
										<span class="nombre">Ciclo {corrida.numero}</span>
										<span class="detalle">
											{corrida.habilitada
												? `En curso desde las ${hora(corrida.creada_en)}`
												: `Cerrado · empezó a las ${hora(corrida.creada_en)}`}
										</span>
									</span>
									{#if corrida.evaluaciones > 0}
										<span class="enviadas" class:incompleto={corrida.enviadas < corrida.evaluaciones}>
											{corrida.enviadas} de {corrida.evaluaciones}
											{corrida.evaluaciones === 1 ? 'enviada' : 'enviadas'}
										</span>
									{/if}
									<Icono nombre="adelante" tamano={18} />
								</a>
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			<section class="mesa-tarjeta">
				<button
					class="material-cabecera"
					type="button"
					aria-expanded={materialAbierto}
					onclick={() => (materialAbierto = !materialAbierto)}
				>
					<Icono nombre="libro" />
					<span>Material del escenario</span>
					<Icono nombre={materialAbierto ? 'arriba' : 'abajo'} />
				</button>
				{#if materialAbierto}
					<ul class="material-lista">
						<li>
							<span class="detalle">Planificación para el facilitador</span>
							{#if data.escenario?.planificacion_archivo}
								<a href="{raiz}/planificacion" target="_blank" rel="noopener" class="material-archivo">
									<span>
										<span class="archivo">{data.escenario.planificacion_archivo}</span>
										<span class="detalle">{mostrarTamano(data.escenario.planificacion_tamano ?? 0)}</span>
									</span>
									<Icono nombre="descargar" />
								</a>
							{:else}
								<span class="pendiente">Sin planificación cargada</span>
							{/if}
						</li>
						<li>
							<span class="detalle">Lista de cotejo de la técnica</span>
							{#if data.checklistDeTecnica}
								<span class="nombre">{data.checklistDeTecnica.nombre}</span>
								<span class="detalle">{data.checklistDeTecnica.items} ítems</span>
							{:else}
								<span class="pendiente">El escenario no tiene checklist de la técnica</span>
							{/if}
						</li>
						<li>
							{#if data.checklistComun}
								<span class="detalle">Lista de cotejo del {data.checklistComun.rol.toLowerCase()}</span>
								<span class="nombre">{data.checklistComun.nombre}</span>
								<span class="detalle">{data.checklistComun.items} ítems</span>
							{:else}
								<span class="detalle">Lista de cotejo del observador</span>
								<span class="pendiente">Sin checklist cargado</span>
							{/if}
						</li>
					</ul>
				{/if}
			</section>
		</div>
	</main>
</div>

{#snippet recorrido()}
	{#if data.recorrido.length === 0}
		<div class="mesa-vacio">
			<strong>Todavía no pasó nadie por esta mesa.</strong>
		</div>
	{:else}
		<p class="ayuda recorrido-ayuda">
			Cada número es un ciclo en el que ocupó ese rol. El hueco es lo que le falta.
		</p>
		<div class="recorrido-envoltorio">
			<table class="recorrido-tabla" style="--roles: {data.rolesDeLaMesa.length}">
				<thead>
					<tr>
						<th scope="col">Persona</th>
						{#each data.rolesDeLaMesa as rol (rol.codigo)}
							<th scope="col">
								<abbr title={rol.nombre}>{abreviaturaDeRol[rol.codigo] ?? rol.nombre}</abbr>
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each recorridoOrdenado as persona (persona.dni)}
						<tr>
							<th scope="row">
								{#if persona.nombre}
									<span title={persona.nombre}>{persona.corto ?? persona.nombre}</span>
								{:else}
									<span>DNI<br />{mostrarDni(persona.dni)}</span>
								{/if}
							</th>
							{#if persona.conduceLaMesa}
								<td colspan={data.rolesDeLaMesa.length}>
									<div class="celda conduce">Conduce la mesa</div>
								</td>
							{:else}
								{#each persona.porRol as celda (celda.codigo)}
									<td class:hueco={celda.numeros.length === 0}>
										<div class="celda">
											{#if celda.numeros.length === 0}
												<span class="visualmente-oculto">Nunca</span>
												<span aria-hidden="true">–</span>
											{:else}
												{#each celda.numeros as numero (numero)}
													<span class="ciclo-marca" class:ahora={numero === enCurso?.numero}>
														{numero}
													</span>
												{/each}
											{/if}
										</div>
									</td>
								{/each}
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<div class="recorrido-referencias">
			{#if enCurso}
				<span><span class="ciclo-marca ahora">{enCurso.numero}</span> Ciclo en curso</span>
			{/if}
			{#each data.rolesDeLaMesa as rol (rol.codigo)}
				<span><b>{abreviaturaDeRol[rol.codigo] ?? rol.nombre}</b> {rol.nombre}</span>
			{/each}
		</div>
		{#if data.nadieLosOcupo.length > 0}
			<p class="recorrido-nadie">
				En esta mesa nadie ocupó todavía: {data.nadieLosOcupo.join(', ')}.
			</p>
		{/if}
	{/if}
{/snippet}

{#if sacando && enCurso}
	{@const quien = sacando}
	<div
		class="mesa-velo"
		role="presentation"
		onclick={(e) => e.target === e.currentTarget && cancelarSalida()}
	>
		<div
			class="mesa-dialogo"
			role="dialog"
			aria-modal="true"
			aria-labelledby="sacar-titulo"
			tabindex="-1"
			use:enfocar
		>
			<span class="asa" aria-hidden="true"></span>
			<h2 id="sacar-titulo">¿Sacar del ciclo a {@render nombreDe(quien)}?</h2>
			<p class="dialogo-texto">
				Deja de ocupar {quien.rolNombre} y puede volver a entrar con el rol que le toca.
			</p>

			{#if quien.envio}
				<p class="dialogo-aviso">
					<Icono nombre="alerta" tamano={18} />
					Se borra el checklist que envió.
				</p>
			{/if}

			<div class="dialogo-botones">
				<button class="boton secundario" type="button" onclick={cancelarSalida} disabled={saliendo}>
					No, que siga
				</button>
				<form
					method="POST"
					action="?/sacarDelCiclo"
					use:enhance={() => {
						saliendo = true;
						return async ({ update }) => {
							await update({ reset: false });
							saliendo = false;
							sacando = null;
						};
					}}
				>
					<input type="hidden" name="participacionId" value={quien.id} />
					<button class="boton peligro" type="submit" disabled={saliendo}>
						{saliendo ? 'Sacando…' : 'Sacar del ciclo'}
					</button>
				</form>
			</div>
		</div>
	</div>
{/if}

{#if confirmando && enCurso}
	<!-- Hoja que sube desde abajo en el teléfono; diálogo centrado en pantallas anchas. -->
	<div
		class="mesa-velo"
		role="presentation"
		onclick={(e) => e.target === e.currentTarget && cancelarConfirmacion()}
	>
		<div
			class="mesa-dialogo"
			role="dialog"
			aria-modal="true"
			aria-labelledby="dialogo-titulo"
			tabindex="-1"
			use:enfocar
		>
			<span class="asa" aria-hidden="true"></span>
			<h2 id="dialogo-titulo">
				{confirmando === 'cierre' ? '¿Cerrar la mesa?' : `¿Habilitar el ciclo ${siguiente}?`}
			</h2>
			<p class="dialogo-texto">
				{confirmando === 'cierre'
					? `Se cierra el ciclo ${enCurso.numero} y no se abre otro. Después podés reabrirla.`
					: `Se cierra el ciclo ${enCurso.numero} y cada participante elige su nuevo rol.`}
			</p>

			{#if data.sinEnviar.length > 0}
				<div class="dialogo-pendientes">
					<strong>
						<Icono nombre="alerta" tamano={18} />
						{data.sinEnviar.length === 1
							? 'Falta que envíe su lista'
							: `Faltan ${data.sinEnviar.length} listas por enviar`}
					</strong>
					<ul>
						{#each data.sinEnviar as pendiente (pendiente.participacionId)}
							<li>
								<span>
									<span class="nombre">{pendiente.quien}</span>
									<span class="detalle">{pendiente.rol}</span>
								</span>
								<span class="items-marcados">{pendiente.marcados} de {pendiente.items} ítems</span>
							</li>
						{/each}
					</ul>
					<p>Van a poder terminarla igual, pero conviene esperarlos.</p>
				</div>
			{/if}

			<div class="dialogo-botones">
				<button
					class="boton secundario"
					type="button"
					onclick={cancelarConfirmacion}
					disabled={habilitando || cerrando}
				>
					Seguir en el ciclo {enCurso.numero}
				</button>
				{#if confirmando === 'siguiente'}
					<form
						method="POST"
						action="?/habilitarSiguiente"
						use:enhance={() => {
							habilitando = true;
							return async ({ update }) => {
								await update({ reset: false });
								habilitando = false;
								confirmando = null;
								pestana = 'ciclo';
							};
						}}
					>
						{@render botonHabilitar(`Habilitar el ciclo ${siguiente}`)}
					</form>
				{:else}
					<form
						method="POST"
						action="?/cerrar"
						use:enhance={() => {
							cerrando = true;
							return async ({ update }) => {
								await update({ reset: false });
								cerrando = false;
								confirmando = null;
							};
						}}
					>
						<button class="boton peligro" type="submit" disabled={cerrando}>
							{cerrando ? 'Cerrando…' : 'Cerrar la mesa'}
						</button>
					</form>
				{/if}
			</div>
		</div>
	</div>
{/if}
