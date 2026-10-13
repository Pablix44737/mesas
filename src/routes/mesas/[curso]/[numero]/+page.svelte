<script lang="ts">
	import { enhance } from '$app/forms';
	import Icono from '$lib/Icono.svelte';
	import BarraSuperior from '$lib/BarraSuperior.svelte';
	import { mostrarDni } from '$lib/dni';
	import { mostrarTamano } from '$lib/planificacion';

	let { data, form } = $props();

	let habilitando = $state(false);
	let confirmandoAvance = $state(false);
	let confirmandoCierre = $state(false);
	let cerrando = $state(false);
	let declarandoDocente = $state(false);
	let confirmandoQuitarDocente = $state(false);

	/**
	 * La pantalla junta muchas cosas y el líder la mira con la mesa andando. Queda a
	 * la vista lo que usa en cada corrida —el QR, habilitar la siguiente, quién está
	 * y qué le falta a cada uno— y lo que consulta de vez en cuando se despliega
	 * desde la cabecera de su tarjeta, como ya hacía el QR.
	 */
	// El QR sólo hace falta mientras la gente entra: con la mesa cerrada arranca
	// plegado. Mientras nadie lo toque, manda eso; después, lo que se eligió.
	let qrAMano = $state<boolean | undefined>(undefined);
	let mostrarCorridas = $state(false);
	let cambiandoDocente = $state(false);
	let detalleDelRecorrido = $state(false);
	let mostrarMaterial = $state(false);

	const siguiente = $derived((data.corridas[0]?.numero ?? 0) + 1);
	// Tuvo corridas y ninguna está abierta: el líder la dio por terminada.
	const cerrada = $derived(!data.corridaEnCurso && data.corridas.length > 0);
	const mostrarQr = $derived(qrAMano ?? !cerrada);

	/**
	 * «Observador» es la palabra más larga de la tabla de recorrido y es la que fija
	 * el ancho mínimo de tres de sus columnas: abreviarla es la diferencia entre ver
	 * un rol por vez en el teléfono y ver dos. Sólo en el encabezado, donde la
	 * columna ya dice de qué se trata; en el resto del sistema el rol va entero.
	 */
	const abreviado = (rol: string) => rol.replace(/^Observador /, 'Obs. ');

	const hora = (fecha: string) =>
		new Date(fecha).toLocaleTimeString('es-AR', {
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		});
</script>

<svelte:head>
	<title>Mesa {data.mesa.numero} — SIMUNaM</title>
</svelte:head>

<!-- El botón que pliega y despliega una tarjeta desde su cabecera. Con borde e
     icono y no como texto subrayado: es lo que se toca para ver más, y tiene que
     leerse como botón. La flecha dice para dónde va: abajo abre, arriba cierra. -->
{#snippet desplegar(
	abierto: boolean,
	alternar: () => void,
	paraAbrir: string,
	paraCerrar = 'Ocultar',
	icono = 'abajo'
)}
	<button
		class="boton secundario desplegar"
		type="button"
		aria-expanded={abierto}
		onclick={alternar}
	>
		<Icono nombre={abierto ? 'arriba' : icono} tamano={16} />
		{abierto ? paraCerrar : paraAbrir}
	</button>
{/snippet}

<!-- Lo que se pierde de vista al cerrar la corrida en curso, sea para pasar a la
     siguiente o para cerrar la mesa: los mismos checklists a medio hacer. -->
{#snippet quienesNoEnviaron()}
	{#if data.sinEnviar.length > 0}
		<div class="aviso alerta">
			<Icono nombre="alerta" />
			<div>
				<strong>
					{data.sinEnviar.length === 1
						? 'Hay alguien que todavía no envió su checklist'
						: `Hay ${data.sinEnviar.length} personas que todavía no enviaron su checklist`}.
				</strong>
				Van a poder terminarlo igual, pero si podés, esperalos.
				<ul class="lista" style="margin-top: 8px">
					{#each data.sinEnviar as pendiente, i (i)}
						<li class="pendiente-padron">
							<span class="quien">{pendiente.quien}</span>
							<span class="detalle">
								{pendiente.rol} · {pendiente.marcados} de {pendiente.items} ítems
							</span>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	{/if}
{/snippet}

{#snippet quien(persona: { nombre: string | null; dni: string })}
	{#if persona.nombre}
		{persona.nombre}
	{:else}
		<span class="pendiente">DNI {mostrarDni(persona.dni)}</span>
	{/if}
{/snippet}

<div class="app">
	<BarraSuperior
		volverA="/mesas"
		titulo="Mesa {data.mesa.numero}"
		sub={data.escenario?.nombre ?? ''}
	>
		{#snippet derecha()}
			{#if data.corridaEnCurso}
				<span class="chip exito">Corrida {data.corridaEnCurso.numero}</span>
			{:else if cerrada}
				<span class="chip neutro">Cerrada</span>
			{/if}
		{/snippet}
	</BarraSuperior>

	<div class="envoltorio">
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

		<div class="tarjeta">
			<div class="tarjeta-cabecera">
				<h2>Código QR de la mesa</h2>
				{@render desplegar(mostrarQr, () => (qrAMano = !mostrarQr), 'Mostrar')}
			</div>

			{#if mostrarQr}
				<div class="qr-panel">
					<img
						class="qr"
						src="/m/{data.curso.codigo}/{data.mesa.numero}/qr"
						alt="Código QR para entrar a la mesa {data.mesa.numero}"
						width="240"
						height="240"
					/>
					<p class="detalle" style="margin: 0">
						Los participantes lo escanean para identificarse y declarar su rol.
					</p>
					<p class="qr-url">{data.origen}/m/{data.curso.codigo}/{data.mesa.numero}</p>
					<a
						class="boton secundario"
						href="/mesas/{data.curso.codigo}/{data.mesa.numero}/cartel"
						target="_blank"
						rel="noopener"
					>
						<Icono nombre="qr" />
						Abrir el cartel, para proyectar o imprimir
					</a>
				</div>
			{/if}
		</div>

		<!-- En un curso de alumnos el facilitador es el docente que conduce la mesa:
		     ningún alumno lo ve en la lista de roles del QR. Se declara acá, una vez
		     por mesa, y evalúa en la pantalla del facilitador de siempre. -->
		{#if data.docente}
			<div class="tarjeta">
				<!-- Sin el chip de «Evaluó»: ya lo dice el botón, que pasa de completar
				     la técnica a ver lo enviado. -->
				<div class="tarjeta-cabecera">
					<h2>Quién conduce la mesa</h2>
					{#if data.docente.dni && !declarandoDocente}
						{@render desplegar(
							cambiandoDocente,
							() => {
								cambiandoDocente = !cambiandoDocente;
								confirmandoQuitarDocente = false;
							},
							'Cambiar',
							'Ocultar',
							'editar'
						)}
					{/if}
				</div>

				{#if !data.docente.dni || declarandoDocente}
					<p class="ayuda">En este curso el facilitador sos vos.</p>
					<form
						method="POST"
						action="?/declararDocente"
						use:enhance={() => async ({ update, result }) => {
							await update({ reset: false });
							if (result.type === 'success') {
								declarandoDocente = false;
								cambiandoDocente = false;
							}
						}}
					>
						<div class="campo">
							<label for="docente-dni">Tu documento</label>
							<div class="campo-con-icono">
								<Icono nombre="dni" />
								<input
									id="docente-dni"
									name="dni"
									type="tel"
									inputmode="numeric"
									autocomplete="off"
									placeholder="20111222"
									value={data.docente.dni ?? ''}
									aria-invalid={Boolean(form?.mensaje)}
									required
								/>
							</div>
							<p class="ayuda">Sin puntos ni espacios.</p>
						</div>
						<div class="confirmacion">
							<button class="boton" type="submit">Guardar</button>
							{#if data.docente.dni}
								<button
									class="boton secundario"
									type="button"
									onclick={() => (declarandoDocente = false)}
								>
									Cancelar
								</button>
							{/if}
						</div>
					</form>
				{:else}
					<div class="fila" style="margin-bottom: 12px">
						<span class="avatar-rol"><Icono nombre="facilitador" tamano={22} /></span>
						<div class="identidad">
							<span class="etiqueta">Conduce y facilita</span>
							{#if data.docente.nombre}
								<span class="nombre">{data.docente.nombre}</span>
								<span class="detalle">DNI {mostrarDni(data.docente.dni)}</span>
							{:else}
								<span class="nombre">DNI {mostrarDni(data.docente.dni)}</span>
								<span class="detalle">No está en el padrón</span>
							{/if}
						</div>
					</div>

					{#if data.docente.participacionId && data.corridaEnCurso}
						<a
							class="boton bloque"
							href="/m/{data.curso.codigo}/{data.mesa.numero}/participacion/{data.docente
								.participacionId}"
						>
							<Icono nombre="checklist" />
							{data.docente.evaluo
								? `Ver lo que enviaste en la corrida ${data.corridaEnCurso.numero}`
								: `Completar la técnica de la corrida ${data.corridaEnCurso.numero}`}
						</a>
					{:else if !data.corridaEnCurso && !cerrada}
						<p class="detalle" style="margin: 0">
							Habilitá la primera corrida para empezar a evaluar.
						</p>
					{/if}

					<!-- Dos acciones que no son el camino principal —ése es completar la
					     técnica—: se despliegan desde «Cambiar», pero una vez a la vista
					     tienen que decir qué hacen sin que haya que probarlas. Mismo patrón
					     que quitar la planificación de un escenario: un botón, y la
					     confirmación recién al tocarlo. -->
					{#if cambiandoDocente && confirmandoQuitarDocente}
						<div class="aviso alerta" style="margin: 16px 0 0">
							<Icono nombre="alerta" />
							<div>
								<strong>La mesa va a quedar sin nadie que la conduzca.</strong>
								Lo que ya evaluó queda registrado.
								<div class="confirmacion" style="margin-top: 12px">
									<form
										method="POST"
										action="?/quitarDocente"
										use:enhance={() => async ({ update }) => {
											await update({ reset: false });
											confirmandoQuitarDocente = false;
											cambiandoDocente = false;
										}}
									>
										<button class="boton peligro" type="submit">
											<Icono nombre="quitar" />
											Sí, dejarla sin docente
										</button>
									</form>
									<button
										class="boton secundario"
										type="button"
										onclick={() => (confirmandoQuitarDocente = false)}
									>
										Cancelar
									</button>
								</div>
							</div>
						</div>
					{:else if cambiandoDocente}
						<div class="acciones-docente">
							<button
								class="boton secundario"
								type="button"
								onclick={() => (declarandoDocente = true)}
							>
								<Icono nombre="editar" tamano={16} />
								La conduce otra persona
							</button>
							<button
								class="boton secundario"
								type="button"
								onclick={() => (confirmandoQuitarDocente = true)}
							>
								<Icono nombre="quitar" tamano={16} />
								Dejarla sin docente
							</button>
						</div>
					{/if}
				{/if}
			</div>
		{/if}

		<div class="tarjeta">
			<div class="tarjeta-cabecera">
				<h2>Corridas</h2>
				<!-- Con una sola corrida la lista repetiría la línea de abajo. -->
				{#if data.corridas.length > 1}
					{@render desplegar(mostrarCorridas, () => (mostrarCorridas = !mostrarCorridas), 'Ver todas')}
				{/if}
			</div>

			{#if data.corridaEnCurso}
				<p>
					La <strong>corrida {data.corridaEnCurso.numero}</strong> está en curso desde las
					{hora(data.corridaEnCurso.creada_en)}.
				</p>
			{:else if cerrada}
				<p>
					La mesa está cerrada, con
					{data.corridas.length === 1 ? 'una corrida' : `${data.corridas.length} corridas`}.
				</p>
			{:else}
				<p>
					Habilitá la primera corrida para que los participantes puedan escanear el QR.
				</p>
			{/if}

			{#if confirmandoAvance}
				<p>
					Habilitar la corrida {siguiente} cierra la corrida {data.corridaEnCurso?.numero}.
				</p>

				{@render quienesNoEnviaron()}

				<div class="confirmacion">
					<form
						method="POST"
						action="?/habilitarSiguiente"
						use:enhance={() => {
							habilitando = true;
							return async ({ update }) => {
								await update({ reset: false });
								habilitando = false;
								confirmandoAvance = false;
							};
						}}
					>
						<button class="boton enviar bloque" type="submit" disabled={habilitando}>
							<Icono nombre="corrida" />
							{habilitando ? 'Habilitando…' : `Sí, habilitar la corrida ${siguiente}`}
						</button>
					</form>
					<button
						class="boton secundario bloque"
						type="button"
						onclick={() => (confirmandoAvance = false)}
						disabled={habilitando}
					>
						Seguir en la corrida {data.corridaEnCurso?.numero}
					</button>
				</div>
			{:else if confirmandoCierre}
				<p>
					Cerrar la mesa cierra la corrida {data.corridaEnCurso?.numero} y no abre otra.
				</p>

				{@render quienesNoEnviaron()}

				<div class="confirmacion">
					<form
						method="POST"
						action="?/cerrar"
						use:enhance={() => {
							cerrando = true;
							return async ({ update }) => {
								await update({ reset: false });
								cerrando = false;
								confirmandoCierre = false;
							};
						}}
					>
						<button class="boton bloque" type="submit" disabled={cerrando}>
							<Icono nombre="tilde" />
							{cerrando ? 'Cerrando…' : 'Sí, cerrar la mesa'}
						</button>
					</form>
					<button
						class="boton secundario bloque"
						type="button"
						onclick={() => (confirmandoCierre = false)}
						disabled={cerrando}
					>
						Seguir en la corrida {data.corridaEnCurso?.numero}
					</button>
				</div>
			{:else if data.corridaEnCurso}
				<!-- Las dos maneras de terminar la corrida en curso: pasar a la siguiente,
				     o terminar la mesa. La segunda es la de una sola vez, así que va abajo
				     y sin color. -->
				<div class="confirmacion">
					<button class="boton bloque" type="button" onclick={() => (confirmandoAvance = true)}>
						<Icono nombre="corrida" />
						Habilitar la corrida {siguiente}
					</button>
					<button
						class="boton secundario bloque"
						type="button"
						onclick={() => (confirmandoCierre = true)}
					>
						<Icono nombre="tilde" />
						Cerrar la mesa
					</button>
				</div>
			{:else}
				<!-- Cerrada, la mesa se puede volver a abrir: por si se cerró antes de
				     tiempo. Sin color, porque ya no es lo que se espera que pase. -->
				<form
					method="POST"
					action="?/habilitarSiguiente"
					use:enhance={() => {
						habilitando = true;
						return async ({ update }) => {
							await update({ reset: false });
							habilitando = false;
						};
					}}
				>
					<button
						class="boton bloque"
						class:enviar={!cerrada}
						class:secundario={cerrada}
						type="submit"
						disabled={habilitando}
					>
						<Icono nombre="corrida" />
						{#if habilitando}
							Habilitando…
						{:else if cerrada}
							Reabrirla con la corrida {siguiente}
						{:else}
							Habilitar la primera corrida
						{/if}
					</button>
				</form>
			{/if}

			{#if mostrarCorridas && data.corridas.length > 1}
				<ul class="lista" style="margin-top: 16px">
					{#each data.corridas as corrida (corrida.id)}
						<li class:en-curso={corrida.habilitada}>
							<span class="rotulo">Corrida {corrida.numero}</span>
							<span class="detalle">
								{#if corrida.habilitada}
									en curso desde las {hora(corrida.creada_en)}
								{:else}
									cerrada · comenzó a las {hora(corrida.creada_en)}
								{/if}
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<!-- Cerrada la mesa no hay corrida de la que mostrar quién está. -->
		{#if !cerrada}
		<div class="tarjeta">
			<div class="tarjeta-cabecera">
				<h2>Participantes</h2>
				{#if data.corridaEnCurso}
					<span class="chip azul sin-punto">
						{data.participantes.length} en la corrida {data.corridaEnCurso.numero}
					</span>
				{/if}
			</div>

			{#if !data.corridaEnCurso}
				<p class="detalle" style="margin: 0">Todavía no hay ninguna corrida habilitada.</p>
			{:else if data.participantes.length === 0}
				<p class="detalle" style="margin: 0">
					Todavía no se identificó nadie en esta corrida. Mostrales el código QR de arriba.
				</p>
			{:else}
				<ul class="lista participantes">
					{#each data.participantes as participante (participante.id)}
						<li>
							<span class="rotulo">{participante.rolNombre}</span>
							<span class="quien">
								{#if participante.nombre}
									{participante.nombre}
								{:else}
									<span class="pendiente">DNI {mostrarDni(participante.dni)}</span>
								{/if}
							</span>
							{#if participante.envio}
								<span class="chip exito">Evaluó</span>
							{/if}
						</li>
					{/each}
				</ul>

				{#if data.rolesLibres.length > 0}
					<p class="detalle" style="margin: 12px 0 0">
						Sin ocupar en esta corrida: {data.rolesLibres.join(', ')}.
					</p>
				{/if}
			{/if}
		</div>
		{/if}

		<!-- Lo que el modelo MESAS no resuelve solo: con más o menos de cinco personas
		     la rotación en sentido de las agujas del reloj no cierra, alguien repite
		     rol y alguien nunca llega a otro. Esto no decide por el líder, le muestra
		     de qué decidir.
		     De entrada, sólo qué le falta a cada uno: es lo que se usa para armar la
		     corrida que viene. En qué corrida ocupó cada rol es el detalle. -->
		<div class="tarjeta">
			<div class="tarjeta-cabecera">
				<h2>Recorrido de la mesa</h2>
				{#if data.recorrido.length > 0}
					{@render desplegar(
						detalleDelRecorrido,
						() => (detalleDelRecorrido = !detalleDelRecorrido),
						'Ver detalle'
					)}
				{/if}
			</div>

			{#if data.recorrido.length === 0}
				<p class="detalle" style="margin: 0">Todavía no pasó nadie por esta mesa.</p>
			{:else if !detalleDelRecorrido}
				<ul class="lista recorrido-resumen">
					{#each data.recorrido as persona (persona.dni)}
						<li>
							<span class="quien">{@render quien(persona)}</span>
							<span class="detalle">
								{#if persona.conduceLaMesa}
									Conduce la mesa
								{:else if persona.faltan.length > 0}
									Le falta: {persona.faltan.join(', ')}
								{:else}
									Ya ocupó todos los roles
								{/if}
							</span>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="ayuda">
					Cada número es una corrida en la que ocupó ese rol. El hueco es lo que le falta.
				</p>

				<!-- Acá la primera columna lleva sólo el nombre: lo que le falta ya lo dice
				     el hueco, y repetirlo en texto la ensanchaba hasta tapar los roles. -->
				<div class="tabla-envoltorio">
					<table class="tabla recorrido">
						<thead>
							<tr>
								<th scope="col">Persona</th>
								{#each data.rolesDeLaMesa as rol (rol.codigo)}
									<th scope="col"><abbr title={rol.nombre}>{abreviado(rol.nombre)}</abbr></th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each data.recorrido as persona (persona.dni)}
								<tr>
									<th scope="row">
										<span class="recorrido-quien">{@render quien(persona)}</span>
										{#if persona.conduceLaMesa}
											<span class="recorrido-nota">Conduce la mesa</span>
										{/if}
									</th>
									{#each persona.porRol as celda (celda.codigo)}
										<td>
											{#if celda.numeros.length === 0}
												<span class="visualmente-oculto">Nunca</span>
												<span class="sin-ocupar" aria-hidden="true">—</span>
											{:else}
												{#each celda.numeros as numero (numero)}
													<span
														class="corrida-marca"
														class:ahora={numero === data.corridaEnCurso?.numero}
													>
														{numero}
													</span>
												{/each}
											{/if}
										</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				{#if data.nadieLosOcupo.length > 0}
					<p class="detalle" style="margin: 12px 0 0">
						En esta mesa nadie ocupó todavía: {data.nadieLosOcupo.join(', ')}.
					</p>
				{/if}
			{/if}
		</div>

		<div class="tarjeta">
			<div class="tarjeta-cabecera">
				<h2>Material del escenario</h2>
				{@render desplegar(mostrarMaterial, () => (mostrarMaterial = !mostrarMaterial), 'Mostrar')}
			</div>

			{#if mostrarMaterial}
				<div class="material">
					<div>
						<span class="etiqueta">Planificación · para el facilitador</span>
						{#if data.escenario?.planificacion_archivo}
							<span>
								<a href="/mesas/{data.curso.codigo}/{data.mesa.numero}/planificacion" target="_blank" rel="noopener">
									{data.escenario.planificacion_archivo}
								</a>
							</span>
							<span class="detalle">
								{mostrarTamano(data.escenario.planificacion_tamano ?? 0)}
							</span>
						{:else}
							<span class="pendiente">Sin planificación cargada</span>
						{/if}
					</div>

					<div>
						<span class="etiqueta">Checklist de la técnica</span>
						{#if data.checklistDeTecnica}
							<span>{data.checklistDeTecnica.nombre}</span>
							<span class="detalle">{data.checklistDeTecnica.items} ítems</span>
						{:else}
							<span class="pendiente">El escenario no tiene checklist de la técnica</span>
						{/if}
					</div>
	
					<div>
						{#if data.checklistComun}
							<span class="etiqueta">Checklist · para el {data.checklistComun.rol.toLowerCase()}</span>
							<span>{data.checklistComun.nombre}</span>
							<span class="detalle">{data.checklistComun.items} ítems</span>
						{:else}
							<span class="etiqueta">Checklist del observador</span>
							<span class="pendiente">Sin checklist cargado</span>
						{/if}
					</div>
				</div>
			{/if}
		</div>

	</div>
</div>
