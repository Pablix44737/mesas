<script lang="ts">
	import Icono from '$lib/Icono.svelte';
	import Marca from '$lib/Marca.svelte';

	const administracion = [
		{
			href: '/admin/escenarios',
			icono: 'escenario',
			titulo: 'Escenarios',
			detalle: 'Técnica, planificación y checklist de cada escenario'
		},
		{
			href: '/admin/checklists',
			icono: 'checklist',
			titulo: 'Checklists',
			detalle: 'Criterios con que los observadores evalúan'
		},
		{
			href: '/admin/mesas',
			icono: 'mesa',
			titulo: 'Consultar mesas',
			detalle: 'Corridas, roles ocupados y evaluaciones'
		},
		{
			href: '/admin/padron',
			icono: 'padron',
			titulo: 'Padrón',
			detalle: 'Participantes cargados y DNI sin resolver'
		}
	];
</script>

<svelte:head>
	<title>SIMUNaM</title>
</svelte:head>

<div class="app">
	<header class="app-barra">
		<a class="marca" href="/">
			<Marca alto={26} />
			SIMUNaM
		</a>
	</header>

	<div class="envoltorio">
		<div class="pagina-cabecera">
			<div class="titulo">
				<h1>Simulación clínica</h1>
				<p class="bajada">Apoyo a escenarios de simulación clínica</p>
			</div>
		</div>

		<h2 class="etiqueta" style="margin-bottom: 8px">Líder de mesa</h2>
		<a class="tarjeta-enlace" href="/mesas">
			<span class="avatar-rol"><Icono nombre="mesa" /></span>
			<span class="texto">
				<span class="titulo">Mesas</span>
				<span class="detalle">Crear una mesa y habilitar sus corridas</span>
			</span>
			<Icono nombre="adelante" clase="flecha" />
		</a>

		<h2 class="etiqueta" style="margin: 24px 0 8px">Administración</h2>
		{#each administracion as seccion (seccion.href)}
			<a class="tarjeta-enlace" href={seccion.href}>
				<span class="avatar-rol gris"><Icono nombre={seccion.icono} /></span>
				<span class="texto">
					<span class="titulo">{seccion.titulo}</span>
					<span class="detalle">{seccion.detalle}</span>
				</span>
				<Icono nombre="adelante" clase="flecha" />
			</a>
		{/each}

		<h2 class="etiqueta" style="margin: 24px 0 8px">Participantes</h2>
		<div class="tarjeta">
			<div class="fila">
				<span class="avatar-rol verde"><Icono nombre="qr" /></span>
				<div class="identidad">
					<span class="nombre">Entran por el código QR</span>
					<span class="detalle">
						Cada participante escanea el QR de su mesa, se identifica con su DNI y declara el
						rol que ocupa en la corrida habilitada.
					</span>
				</div>
			</div>
		</div>
	</div>
</div>
