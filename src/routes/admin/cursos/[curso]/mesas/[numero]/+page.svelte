<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import Icono from '$lib/Icono.svelte';
	import { mostrarDni } from '$lib/dni';
	import { iconoDeRol } from '$lib/roles';

	let { data, form } = $props();

	type Ciclo = (typeof data.corridas)[number];
	type Rol = Ciclo['participaciones'][number];
	type Accion = 'baja' | 'ciclo' | 'mesa';

	const curso = $derived(data.curso);
	const raiz = $derived(`/admin/cursos/${data.curso.codigo}/mesas/${data.mesa.numero}`);

	let accion = $state<Accion | null>(null);
	let trabajando = $state<Accion | null>(null);
	let avisoCerrado = $state(false);

	const cuantos = (n: number, singular: string, plural: string) =>
		`${n} ${n === 1 ? singular : plural}`;
	const hora = (valor: string) =>
		new Date(valor).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
	const quien = (rol: Rol) => rol.nombre ?? `DNI ${mostrarDni(rol.dni)}`;

	const enviadas = (ciclo: Ciclo) => ciclo.participaciones.filter((p) => p.evaluo).length;
	const roles = $derived(data.corridas.reduce((t, c) => t + c.participaciones.length, 0));
	const evaluaciones = $derived(data.corridas.reduce((t, c) => t + enviadas(c), 0));
	const enCurso = $derived(data.corridas.find((c) => c.habilitada) ?? null);
	const estado = $derived(
		enCurso
			? `Ciclo ${enCurso.numero} en curso`
			: data.corridas.length === 0
				? 'Sin ciclos'
				: cuantos(data.corridas.length, 'ciclo cerrado', 'ciclos cerrados')
	);

	/** Cada rol que ocupó un DNI fuera del padrón, para ir directo a él. */
	const sinResolver = $derived(
		data.corridas.flatMap((c) =>
			c.participaciones.filter((p) => !p.nombre).map((p) => ({ ciclo: c.numero, rol: p }))
		)
	);
	const textoSinResolver = $derived.by(() => {
		const n = sinResolver.length;
		const dnis = new Set(sinResolver.map((s) => s.rol.dni));
		if (dnis.size === 1) {
			return `${n === 1 ? '1 rol de esta mesa lo ocupó' : `${n} roles de esta mesa los ocupó`} el DNI ${mostrarDni(sinResolver[0].rol.dni)}, que no está en el padrón.`;
		}
		return `${n} roles de esta mesa los ocuparon DNI que no están en el padrón.`;
	});

	/** Qué dice cada rol de su evaluación. */
	function evaluacionDe(rol: Rol, ciclo: Ciclo) {
		if (rol.evaluo) {
			return { texto: `Envió su evaluación${rol.enviadaEn ? ` · ${hora(rol.enviadaEn)}` : ''}`, tono: 'enviada', icono: 'tilde' };
		}
		if (rol.marcas !== null) {
			return {
				texto: rol.marcas > 0 ? `Checklist abierto · ${cuantos(rol.marcas, 'marca', 'marcas')}` : 'Checklist abierto, sin enviar',
				tono: 'abierta',
				icono: 'reloj'
			};
		}
		if (rol.observador && !ciclo.habilitada) return { texto: 'No la envió', tono: 'ninguna', icono: 'cerrar' };
		return null;
	}

	/* --- los ciclos que se ven abiertos --- */

	/** El último ciclo arranca abierto: es el que importa durante un evento. */
	let abiertos = $state<Record<number, boolean>>(
		untrack(() => (data.corridas[0] ? { [data.corridas[0].numero]: true } : {}))
	);
	let senalado = $state<string | null>(null);

	async function irAlRol(ciclo: number, participacionId: string) {
		abiertos[ciclo] = true;
		senalado = participacionId;
		await tick();
		document.getElementById(`p-${participacionId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
	}

	// Desde el padrón se llega con el ancla de una persona: se abre su ciclo.
	onMount(() => {
		const id = location.hash.startsWith('#p-') ? location.hash.slice(3) : null;
		const ciclo = id ? data.corridas.find((c) => c.participaciones.some((p) => p.id === id)) : null;
		if (id && ciclo) irAlRol(ciclo.numero, id);
	});

	/* --- dar de baja, eliminar un ciclo, eliminar la mesa --- */

	let dialogo = $state<Accion | null>(untrack(() => (form?.eliminandoMesa ? 'mesa' : null)));
	let aDarDeBaja = $state<{ rol: Rol; ciclo: Ciclo } | null>(null);
	let confirmacion = $state('');
	let confirmacionCorregida = $state(false);
	const respuestaDe = (de: Accion) =>
		form?.mensaje && (accion === de || (de === 'mesa' && form.eliminandoMesa)) ? form.mensaje : null;

	const ultimo = $derived(data.corridas[0] ?? null);
	const anterior = $derived(data.corridas[1] ?? null);

	async function abrirDialogo(cual: Accion) {
		dialogo = cual;
		confirmacion = '';
		confirmacionCorregida = true;
		if (accion === cual) accion = null;
		await tick();
		document.querySelector<HTMLElement>('[data-enfocar]')?.focus();
	}

	function cerrar() {
		if (trabajando) return;
		dialogo = null;
	}

	const enviar =
		(de: Accion): SubmitFunction =>
		() => {
			accion = de;
			trabajando = de;
			avisoCerrado = false;
			confirmacionCorregida = false;
			return async ({ result, update }) => {
				await update({ reset: false });
				trabajando = null;
				if (result.type === 'success') {
					dialogo = null;
					window.scrollTo({ top: 0 });
				}
			};
		};

	const aviso = $derived.by(() => {
		if (avisoCerrado || dialogo) return null;
		if (form?.exito) return { exito: true, texto: form.exito };
		if (form?.mensaje && !form.eliminandoMesa) return { exito: false, texto: form.mensaje };
		return null;
	});

	/* --- las evaluaciones de un ciclo --- */

	const delCiclo = $derived(data.evaluacionesDelCiclo);
	let criteriosVisibles = $state<Record<string, boolean>>({});
	const numero = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });
</script>

<svelte:head>
	<title>Mesa {data.mesa.numero} — {curso.nombre} — SIMUNaM</title>
</svelte:head>

<svelte:window
	onkeydown={(evento) => {
		if (evento.key !== 'Escape') return;
		if (dialogo) cerrar();
		else if (delCiclo) document.getElementById('cerrar-evaluaciones')?.click();
	}}
/>

<div class="admin-encabezado">
	<div class="admin-ficha">
		<nav class="cursos-migas" aria-label="Dónde estás">
			<a href="/admin/cursos">Cursos</a>
			<Icono nombre="adelante" tamano={16} />
			<a href="/admin/cursos/{curso.codigo}">{curso.nombre}</a>
			<Icono nombre="adelante" tamano={16} />
			<span aria-current="page">Mesa {data.mesa.numero}</span>
		</nav>
		<a class="mesa-volver cursos-volver" href="/admin/cursos/{curso.codigo}">
			<Icono nombre="atras" tamano={18} />
			<span>{curso.nombre}</span>
		</a>

		<div class="cursos-ficha">
			<div>
				<div class="cursos-ficha-titulo">
					<h1>Mesa {data.mesa.numero}</h1>
					<span class="cursos-estado grande" class:en-curso={enCurso}>{estado}</span>
				</div>
				<p class="cursos-mesa-escenario-grande">{data.escenario?.nombre}</p>
				<p class="cursos-ficha-datos">
					<span>
						{cuantos(data.corridas.length, 'ciclo', 'ciclos')} · {cuantos(roles, 'rol ocupado', 'roles ocupados')} · {cuantos(evaluaciones, 'evaluación enviada', 'evaluaciones enviadas')}
					</span>
				</p>
			</div>
			<div class="cursos-ficha-acciones">
				<a
					class="boton secundario"
					href="/mesas/{curso.codigo}/{data.mesa.numero}/cartel"
					target="_blank"
					rel="noopener"
				>
					<Icono nombre="qr" tamano={18} />
					Abrir el cartel del QR
				</a>
				{#if data.escenario}
					<a class="boton secundario" href="/admin/estadisticas?escenario={data.escenario.id}">
						<Icono nombre="resultado" tamano={18} />
						Estadísticas del escenario
					</a>
				{/if}
			</div>
		</div>
	</div>
</div>

<div class="admin-cuerpo">
	{#if aviso}
		<div class="admin-aviso" class:error={!aviso.exito} role={aviso.exito ? 'status' : 'alert'}>
			<Icono nombre={aviso.exito ? 'tilde-circulo' : 'error'} />
			<p>{aviso.texto}</p>
			<button type="button" aria-label="Cerrar el mensaje" onclick={() => (avisoCerrado = true)}>
				<Icono nombre="cerrar" tamano={18} />
			</button>
		</div>
	{/if}

	{#if sinResolver.length > 0}
		<div class="admin-advertencia cursos-sin-resolver">
			<Icono nombre="alerta" />
			<div>
				<span>{textoSinResolver}</span>
				<div>
					{#each sinResolver as item (item.rol.id)}
						<button type="button" onclick={() => irAlRol(item.ciclo, item.rol.id)}>
							Ciclo {item.ciclo} · {item.rol.rolNombre}
						</button>
					{/each}
					<a href="/admin/padron">Incorporar en el Padrón<Icono nombre="adelante" tamano={16} /></a>
				</div>
			</div>
		</div>
	{/if}

	<div class="cursos-mesas-cabecera">
		<h2>Ciclos</h2>
		<span>{data.corridas.length}</span>
		{#if data.corridas.length > 1}<p>Del más nuevo al más viejo</p>{/if}
	</div>

	{#each data.corridas as ciclo (ciclo.id)}
		{@const abierto = Boolean(abiertos[ciclo.numero])}
		{@const enviadasDelCiclo = enviadas(ciclo)}
		<section class="mesa-tarjeta cursos-ciclo" class:en-curso={ciclo.habilitada} aria-label="Ciclo {ciclo.numero}">
			<div class="cursos-ciclo-cabecera">
				<button
					type="button"
					aria-expanded={abierto}
					onclick={() => (abiertos[ciclo.numero] = !abierto)}
				>
					<Icono nombre="adelante" tamano={20} clase="cursos-ciclo-flecha" />
					<span>
						<span class="cursos-ciclo-titulo">
							<strong>Ciclo {ciclo.numero}</strong>
							<span class="cursos-estado" class:en-curso={ciclo.habilitada}>
								{ciclo.habilitada ? `En curso desde las ${hora(ciclo.creada_en)}` : `Comenzó a las ${hora(ciclo.creada_en)}`}
							</span>
						</span>
						<span class="cursos-ciclo-resumen">
							{cuantos(ciclo.participaciones.length, 'rol ocupado', 'roles ocupados')} · {cuantos(enviadasDelCiclo, 'evaluación', 'evaluaciones')}
						</span>
					</span>
				</button>
				{#if enviadasDelCiclo > 0}
					<a class="boton secundario cursos-ver-evaluaciones" href="?ciclo={ciclo.numero}" data-sveltekit-noscroll>
						<Icono nombre="checklist" tamano={18} />
						{enviadasDelCiclo === 1 ? 'Ver la evaluación' : `Ver las ${enviadasDelCiclo} evaluaciones`}
					</a>
				{/if}
			</div>

			{#if abierto}
				<div class="cursos-ciclo-cuerpo">
					{#if ciclo.participaciones.length > 0}
						<div class="cursos-roles-columnas" aria-hidden="true">
							<span></span><span>Rol</span><span>Quién</span><span>Evaluación</span><span></span>
						</div>
					{/if}
					<ul class="cursos-roles">
						{#each ciclo.participaciones as rol (rol.id)}
							{@const evaluacion = evaluacionDe(rol, ciclo)}
							<!-- El id es el ancla con que el padrón enlaza un DNI sin resolver
							     hasta la fila exacta donde ocupó ese rol. -->
							<li id="p-{rol.id}" class="cursos-rol" class:senalado={senalado === rol.id}>
								<span class="cursos-rol-icono" class:sin-identificar={!rol.nombre}>
									<Icono nombre={iconoDeRol[rol.rolCodigo] ?? 'operador'} tamano={20} />
								</span>
								<span class="cursos-rol-nombre">{rol.rolNombre}</span>
								<span class="cursos-rol-quien">
									<strong>{quien(rol)}</strong>
									{#if rol.nombre}
										<span class="cursos-identificado"><Icono nombre="tilde" tamano={14} grosor={2.5} />Identificado</span>
									{:else}
										<span class="cursos-sin-identificar">Sin identificar</span>
									{/if}
								</span>
								<span class="cursos-rol-evaluacion">
									{#if evaluacion}
										<span class={evaluacion.tono}><Icono nombre={evaluacion.icono} tamano={16} />{evaluacion.texto}</span>
									{/if}
								</span>
								<span class="cursos-rol-acciones">
									{#if !rol.evaluo}
										<button
											class="icono-boton peligroso"
											type="button"
											aria-label="Dar de baja a {quien(rol)} como {rol.rolNombre}"
											title="Dar de baja de este rol"
											onclick={() => {
												aDarDeBaja = { rol, ciclo };
												abrirDialogo('baja');
											}}
										>
											<Icono nombre="quitar" tamano={18} />
										</button>
									{/if}
								</span>
							</li>
						{/each}
						{#each ciclo.sinOcupar as vacante (vacante.codigo)}
							<li class="cursos-rol vacante">
								<span class="cursos-rol-icono"><Icono nombre={iconoDeRol[vacante.codigo] ?? 'operador'} tamano={20} /></span>
								<span class="cursos-rol-nombre">{vacante.nombre}</span>
								<span class="cursos-rol-quien"><em>Nadie ocupó este rol todavía</em></span>
							</li>
						{/each}
					</ul>
					{#if ciclo.participaciones.length === 0 && ciclo.sinOcupar.length === 0}
						<p class="cursos-ciclo-vacio">Nadie se identificó todavía en este ciclo.</p>
					{/if}
					{#if ciclo.sePuedeEliminar}
						<div class="cursos-ciclo-pie">
							<span>¿El líder lo abrió por error? Como nadie envió una evaluación, se puede eliminar.</span>
							<button class="admin-quitar" type="button" onclick={() => abrirDialogo('ciclo')}>
								<Icono nombre="quitar" tamano={18} />
								Eliminar este ciclo
							</button>
						</div>
					{/if}
				</div>
			{/if}
		</section>
	{:else}
		<div class="mesa-tarjeta admin-vacio">
			<span class="evaluado-vacio-icono gris"><Icono nombre="corrida" tamano={24} /></span>
			<strong>Esta mesa todavía no tiene ciclos.</strong>
			<p>Aparecen acá cuando el líder abre el primero.</p>
		</div>
	{/each}

	<section class="admin-eliminar" aria-label="Eliminar la mesa">
		<div>
			<strong>Eliminar la mesa {data.mesa.numero}</strong>
			<span>
				{data.corridas.length > 0
					? 'Borra sus ciclos, quiénes ocuparon cada rol y sus evaluaciones, aunque ya estén enviadas.'
					: 'Todavía no tiene ciclos.'}
			</span>
		</div>
		<button class="boton secundario" type="button" onclick={() => abrirDialogo('mesa')}>
			<Icono nombre="quitar" tamano={18} />
			Eliminar la mesa
		</button>
	</section>
</div>

{#if dialogo}
	<div class="admin-velo" role="presentation" onclick={cerrar}></div>
	<div class="admin-dialogo" role="alertdialog" aria-modal="true" aria-labelledby="dialogo-titulo">
		<span class="admin-asa" aria-hidden="true"></span>

		{#if dialogo === 'baja' && aDarDeBaja}
			{@const { rol, ciclo } = aDarDeBaja}
			<h2 id="dialogo-titulo">¿Dar de baja a {quien(rol)} como {rol.rolNombre}?</h2>
			<p>
				{rol.nombre ?? `El DNI ${mostrarDni(rol.dni)}`} deja de estar registrado como {rol.rolNombre} en el
				ciclo {ciclo.numero}. Puede volver a escanear el QR y elegir otro rol. Se pierden las marcas que haya
				hecho con este.
			</p>
			{#if respuestaDe('baja')}
				<p class="dialogo-error" role="alert"><Icono nombre="error" tamano={18} />{respuestaDe('baja')}</p>
			{/if}
			<form method="POST" action="?/eliminarParticipacion" use:enhance={enviar('baja')}>
				<input type="hidden" name="participacionId" value={rol.id} />
				<button class="boton secundario neutro" type="button" onclick={cerrar} disabled={trabajando !== null} data-enfocar>
					Cancelar
				</button>
				<button class="boton peligro" type="submit" disabled={trabajando !== null}>
					{trabajando ? 'Dando de baja…' : 'Sí, dar de baja'}
				</button>
			</form>
		{:else if dialogo === 'ciclo' && ultimo}
			{@const abiertosDelCiclo = ultimo.sinEnviar}
			{@const seVan = [
				ultimo.participaciones.length > 0 ? cuantos(ultimo.participaciones.length, 'rol ocupado', 'roles ocupados') : null,
				abiertosDelCiclo > 0 ? cuantos(abiertosDelCiclo, 'checklist abierto sin enviar', 'checklists abiertos sin enviar') : null
			].filter(Boolean)}
			<h2 id="dialogo-titulo">¿Eliminar el ciclo {ultimo.numero}?</h2>
			<p>
				{anterior
					? `Eliminar el ciclo ${ultimo.numero} devuelve la mesa al ciclo ${anterior.numero}, que vuelve a quedar habilitado.`
					: `Eliminar el ciclo ${ultimo.numero} deja la mesa sin ciclos, como recién creada.`}
				{seVan.length > 0 ? `Se van con él ${seVan.join(' y ')}.` : ''}
			</p>
			{#if respuestaDe('ciclo')}
				<p class="dialogo-error" role="alert"><Icono nombre="error" tamano={18} />{respuestaDe('ciclo')}</p>
			{/if}
			<form method="POST" action="?/eliminarCorrida" use:enhance={enviar('ciclo')}>
				<input type="hidden" name="corridaId" value={ultimo.id} />
				<button class="boton secundario neutro" type="button" onclick={cerrar} disabled={trabajando !== null} data-enfocar>
					Cancelar
				</button>
				<button class="boton peligro" type="submit" disabled={trabajando !== null}>
					{trabajando ? 'Eliminando…' : 'Sí, eliminar el ciclo'}
				</button>
			</form>
		{:else if dialogo === 'mesa'}
			<h2 id="dialogo-titulo">¿Eliminar la mesa {data.mesa.numero}?</h2>
			<p>
				{data.corridas.length > 0
					? `Eliminar la mesa ${data.mesa.numero} borra también ${data.corridas.length === 1 ? 'su ciclo' : `sus ${data.corridas.length} ciclos`}, quiénes ocuparon cada rol${evaluaciones > 0 ? ` y ${evaluaciones === 1 ? 'la evaluación que se envió' : `las ${evaluaciones} evaluaciones que se enviaron`}` : ''}. No se puede deshacer.`
					: `La mesa ${data.mesa.numero} todavía no tiene ciclos. No se puede deshacer.`}
			</p>
			{#if data.corridas.length > 0}
				<p class="cursos-se-van">
					<span><strong>{data.corridas.length}</strong>{data.corridas.length === 1 ? 'ciclo' : 'ciclos'}</span>
					<span><strong>{roles}</strong>{roles === 1 ? 'rol ocupado' : 'roles ocupados'}</span>
					<span><strong>{evaluaciones}</strong>{evaluaciones === 1 ? 'evaluación enviada' : 'evaluaciones enviadas'}</span>
				</p>
			{/if}
			<form method="POST" action="?/eliminarMesa" novalidate use:enhance={enviar('mesa')}>
				<div class="admin-campo cursos-confirmar">
					<label for="confirmar-mesa">Para confirmar, escribí el número de la mesa</label>
					<input
						id="confirmar-mesa"
						class="cursos-confirmar-numero"
						name="confirmacion"
						type="text"
						inputmode="numeric"
						autocomplete="off"
						placeholder={String(data.mesa.numero)}
						bind:value={confirmacion}
						oninput={() => (confirmacionCorregida = true)}
						aria-invalid={Boolean(respuestaDe('mesa') && !confirmacionCorregida)}
						data-enfocar
					/>
					{#if respuestaDe('mesa') && !confirmacionCorregida}
						<p class="campo-error"><Icono nombre="error" tamano={16} />{respuestaDe('mesa')}</p>
					{/if}
				</div>
				<div class="cursos-dialogo-botones">
					<button class="boton secundario neutro" type="button" onclick={cerrar} disabled={trabajando !== null}>
						Cancelar
					</button>
					<button class="boton peligro" type="submit" disabled={trabajando !== null}>
						{trabajando ? 'Eliminando…' : `Eliminar la mesa ${data.mesa.numero}`}
					</button>
				</div>
			</form>
		{/if}
	</div>
{/if}

{#if delCiclo}
	<a class="admin-velo" href={raiz} aria-label="Cerrar" data-sveltekit-noscroll></a>
	<div class="admin-panel cursos-evaluaciones" role="dialog" aria-modal="true" aria-labelledby="evaluaciones-titulo">
		<span class="admin-asa" aria-hidden="true"></span>
		<div class="admin-panel-cabecera">
			<div>
				<span class="estadisticas-rotulo">Evaluaciones</span>
				<div class="cursos-ficha-titulo">
					<h2 id="evaluaciones-titulo">Ciclo {delCiclo.numero} · Mesa {data.mesa.numero}</h2>
					<span class="cursos-estado" class:en-curso={delCiclo.enCurso}>
						{delCiclo.enCurso ? `En curso desde las ${hora(delCiclo.desde)}` : `Comenzó a las ${hora(delCiclo.desde)}`}
					</span>
				</div>
				<p>{data.escenario?.nombre}</p>
			</div>
			<a id="cerrar-evaluaciones" class="admin-cerrar" href={raiz} aria-label="Cerrar" data-sveltekit-noscroll>
				<Icono nombre="cerrar" tamano={20} />
			</a>
		</div>

		<div class="admin-panel-cuerpo">
			{#each delCiclo.evaluaciones as evaluacion (evaluacion.instanciaId)}
				{@const visibles = Boolean(criteriosVisibles[evaluacion.instanciaId])}
				<article class="cursos-evaluacion">
					<div class="cursos-evaluacion-cabecera">
						<span class="cursos-rol-icono azul"><Icono nombre="checklist" tamano={20} /></span>
						<div>
							<span class="estadisticas-rotulo">{evaluacion.rol}</span>
							<strong>
								{evaluacion.observador ?? `DNI ${mostrarDni(evaluacion.dni)}`}
								{#if !evaluacion.observador}<span class="cursos-sin-identificar">Sin identificar</span>{/if}
							</strong>
							{#if evaluacion.enviadaEn}<span>La envió a las {hora(evaluacion.enviadaEn)}</span>{/if}
						</div>
						<div class="cursos-evaluacion-resultado">
							<strong>{numero(evaluacion.resultado)} de {numero(evaluacion.maximo)}</strong>
							<span>{evaluacion.porcentaje}%</span>
						</div>
					</div>
					<div class="cursos-evaluacion-barra">
						<span class="estadisticas-cumplimiento" aria-hidden="true">
							<span style="width: {evaluacion.porcentaje}%"></span>
						</span>
						<p>
							<span>{evaluacion.checklist}</span>
							{#if evaluacion.ponderado}
								<span>{evaluacion.itemsCumplidos} de {evaluacion.items.length} ítems</span>
							{/if}
						</p>
					</div>
					<button
						class="cursos-evaluacion-desplegar"
						type="button"
						aria-expanded={visibles}
						onclick={() => (criteriosVisibles[evaluacion.instanciaId] = !visibles)}
					>
						<Icono nombre="adelante" tamano={18} clase="cursos-ciclo-flecha" />
						{visibles ? 'Ocultar los criterios' : `Ver los ${evaluacion.items.length} criterios`}
					</button>
					{#if visibles}
						<ol class="cursos-criterios">
							{#each evaluacion.items as item, i (item.id)}
								<li class:no-hizo={!item.cumplido}>
									<span class="cursos-criterio-numero">{i + 1}</span>
									<span class="cursos-criterio-marca">
										<Icono nombre={item.cumplido ? 'tilde' : 'cerrar'} tamano={14} grosor={2.5} />
									</span>
									<span class="cursos-criterio-texto">{item.texto}</span>
									<span class="cursos-criterio-resultado">
										<strong>{item.cumplido ? 'Hizo' : 'No hizo'}</strong>
										{#if evaluacion.ponderado}<span>peso {numero(item.peso)}</span>{/if}
									</span>
								</li>
							{/each}
						</ol>
					{/if}
				</article>
			{:else}
				<div class="admin-vacio">
					<span class="evaluado-vacio-icono gris"><Icono nombre="checklist" tamano={24} /></span>
					<strong>Todavía no se envió ninguna evaluación en este ciclo.</strong>
				</div>
			{/each}
		</div>
	</div>
{/if}
