<script lang="ts">
	import { enhance } from '$app/forms';
	import Icono from '$lib/Icono.svelte';
	import BarraSuperior from '$lib/BarraSuperior.svelte';
	import { mostrarDni } from '$lib/dni';
	import { mostrarTamano } from '$lib/planificacion';

	let { data, form } = $props();

	let habilitando = $state(false);
	let confirmandoAvance = $state(false);
	let mostrarQr = $state(true);
	let declarandoDocente = $state(false);
	let confirmandoQuitarDocente = $state(false);

	const siguiente = $derived((data.corridas[0]?.numero ?? 0) + 1);

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

<div class="app">
	<BarraSuperior
		volverA="/mesas"
		titulo="Mesa {data.mesa.numero}"
		sub={data.escenario?.nombre ?? ''}
	>
		{#snippet derecha()}
			{#if data.corridaEnCurso}
				<span class="chip exito">Corrida {data.corridaEnCurso.numero}</span>
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
				<button class="enlace" type="button" onclick={() => (mostrarQr = !mostrarQr)}>
					{mostrarQr ? 'Ocultar' : 'Mostrar'}
				</button>
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
				<div class="tarjeta-cabecera">
					<h2>Quién conduce la mesa</h2>
					{#if data.docente.evaluo}
						<span class="chip exito">Evaluó</span>
					{/if}
				</div>

				{#if !data.docente.dni || declarandoDocente}
					<p class="ayuda">
						En este curso el facilitador sos vos, no un alumno. Dejá tu documento una vez y el
						sistema te abre tu lugar en cada corrida que habilites, para que puedas completar la
						lista de cotejo de la técnica.
					</p>
					<form
						method="POST"
						action="?/declararDocente"
						use:enhance={() => async ({ update, result }) => {
							await update({ reset: false });
							if (result.type === 'success') declarandoDocente = false;
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
								<span class="detalle">No está en el padrón: su evaluación va a ir sin nombre.</span>
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
					{:else if !data.corridaEnCurso}
						<p class="detalle" style="margin: 0">
							Habilitá la primera corrida y se te abre ahí tu lugar de facilitador.
						</p>
					{/if}

					<!-- Dos acciones que no son el camino principal —ése es completar la
					     técnica—, pero que tienen que decir qué hacen sin que haya que
					     probarlas. Mismo patrón que quitar la planificación de un escenario:
					     un botón, y la confirmación recién al tocarlo. -->
					{#if confirmandoQuitarDocente}
						<div class="aviso alerta" style="margin: 16px 0 0">
							<Icono nombre="alerta" />
							<div>
								<strong>La mesa va a quedar sin nadie que la conduzca.</strong>
								Lo que {data.docente.nombre ?? 'esa persona'} ya evaluó queda registrado; lo que
								deja de pasar es que se le abra lugar de facilitador en las corridas nuevas.
								<div class="confirmacion" style="margin-top: 12px">
									<form
										method="POST"
										action="?/quitarDocente"
										use:enhance={() => async ({ update }) => {
											await update({ reset: false });
											confirmandoQuitarDocente = false;
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
					{:else}
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
			</div>

			{#if data.corridaEnCurso}
				<p>
					La <strong>corrida {data.corridaEnCurso.numero}</strong> está habilitada desde las
					{hora(data.corridaEnCurso.creada_en)}. Los participantes pueden identificarse y declarar
					su rol, y lo que se evalúe queda referido a esta corrida.
				</p>
			{:else}
				<p>
					Esta mesa todavía no tiene ninguna corrida habilitada. Hasta que habilites la primera,
					los participantes no pueden identificarse.
				</p>
			{/if}

			{#if confirmandoAvance}
				<p>
					Habilitar la corrida {siguiente} cierra la corrida {data.corridaEnCurso?.numero}. A
					partir de ahí, lo que se registre queda referido a la nueva.
				</p>

				{#if data.sinEnviar.length > 0}
					<div class="aviso alerta">
						<Icono nombre="alerta" />
						<div>
							<strong>
								{data.sinEnviar.length === 1
									? 'Hay alguien que todavía no envió su checklist'
									: `Hay ${data.sinEnviar.length} personas que todavía no enviaron su checklist`}.
							</strong>
							Van a poder terminarlo igual —el sistema se los ofrece cuando vuelvan a escanear
							el QR—, pero si podés, esperalos.
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
			{:else if data.corridaEnCurso}
				<button class="boton bloque" type="button" onclick={() => (confirmandoAvance = true)}>
					<Icono nombre="corrida" />
					Habilitar la corrida {siguiente}
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
						};
					}}
				>
					<button class="boton enviar bloque" type="submit" disabled={habilitando}>
						<Icono nombre="corrida" />
						{habilitando ? 'Habilitando…' : 'Habilitar la primera corrida'}
					</button>
				</form>
			{/if}

			{#if data.corridas.length > 0}
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
				<p class="detalle" style="margin: 0">
					Habilitá una corrida para que los participantes puedan identificarse.
				</p>
			{:else if data.participantes.length === 0}
				<p class="detalle" style="margin: 0">
					Todavía no se identificó nadie en esta corrida. Mostrales el código QR de arriba.
				</p>
			{:else}
				<ul class="lista">
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

			{#if data.personasEnLaMesa > data.participantes.length}
				<p class="detalle" style="margin: 12px 0 0">
					Por esta mesa pasaron {data.personasEnLaMesa} personas contando todas sus corridas.
				</p>
			{/if}
		</div>

		<!-- Lo que el modelo MESAS no resuelve solo: con más o menos de cinco personas
		     la rotación en sentido de las agujas del reloj no cierra, alguien repite
		     rol y alguien nunca llega a otro. Esto no decide por el líder, le muestra
		     de qué decidir. -->
		<div class="tarjeta">
			<div class="tarjeta-cabecera">
				<h2>Recorrido de la mesa</h2>
				{#if data.recorrido.length > 0}
					<span class="detalle">
						{data.recorrido.length}
						{data.recorrido.length === 1 ? 'persona' : 'personas'}
					</span>
				{/if}
			</div>

			{#if data.recorrido.length === 0}
				<p class="detalle" style="margin: 0">
					Todavía no pasó nadie por esta mesa. Cuando se identifiquen vas a ver acá qué rol
					ocupó cada uno en cada corrida.
				</p>
			{:else}
				<p class="ayuda">
					En qué corridas ocupó cada rol. El hueco es lo que le falta, y es por donde conviene
					seguir la rotación.
				</p>

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
										<span class="recorrido-quien">
											{#if persona.nombre}
												{persona.nombre}
											{:else}
												<span class="pendiente">DNI {mostrarDni(persona.dni)}</span>
											{/if}
										</span>
										{#if persona.conduceLaMesa}
											<span class="recorrido-falta">Conduce la mesa, no rota</span>
										{:else if persona.faltan.length > 0}
											<span class="recorrido-falta">
												Le falta: {persona.faltan.join(', ')}
											</span>
										{:else}
											<span class="recorrido-falta">Ya ocupó todos los roles</span>
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
				<h2>Material que hereda del escenario</h2>
			</div>

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
						<span class="detalle">El facilitador va a ver que no está disponible.</span>
					{/if}
				</div>

				<div>
					<span class="etiqueta">Checklist de la técnica · para su observador y el facilitador</span>
					{#if data.checklistDeTecnica}
						<span>{data.checklistDeTecnica.nombre}</span>
						<span class="detalle">
							{data.checklistDeTecnica.items} ítems · máximo {data.checklistDeTecnica.maximo}
							{#if !data.checklistDeTecnica.ponderado}· sin ponderar{/if}
						</span>
					{:else}
						<span class="pendiente">El escenario no tiene checklist de la técnica</span>
					{/if}
				</div>

				<div>
					{#if data.checklistComun}
						<span class="etiqueta">Checklist · para el {data.checklistComun.rol.toLowerCase()}</span>
						<span>{data.checklistComun.nombre}</span>
						<span class="detalle">
							{data.checklistComun.items} ítems · máximo {data.checklistComun.maximo}
							{#if !data.checklistComun.ponderado}· sin ponderar{/if}
							· común a todos los escenarios
						</span>
					{:else}
						<span class="etiqueta">Checklist común del curso</span>
						<span class="pendiente">Este curso todavía no tiene el suyo cargado</span>
					{/if}
				</div>
			</div>
		</div>

	</div>
</div>
