<script lang="ts">
	import { page } from '$app/state';
	import Icono from '$lib/Icono.svelte';
	import Marca from '$lib/Marca.svelte';

	let { children } = $props();

	const secciones = [
		{ href: '/admin/escenarios', nombre: 'Escenarios', icono: 'escenario' },
		{ href: '/admin/checklists', nombre: 'Checklists', icono: 'checklist' },
		{ href: '/admin/cursos', nombre: 'Cursos', icono: 'mesa' },
		{ href: '/admin/padron', nombre: 'Padrón', icono: 'padron' },
		{ href: '/admin/estadisticas', nombre: 'Estadísticas', icono: 'resultado' }
	];

	const actual = (href: string) => (page.url.pathname.startsWith(href) ? 'page' : undefined);

	/**
	 * Las secciones ya rediseñadas arman su propio encabezado a todo el ancho; las
	 * demás siguen dentro del envoltorio de siempre hasta que les toque.
	 */
	const rediseñadas = ['/admin/escenarios', '/admin/padron'];
	const propia = $derived(rediseñadas.some((ruta) => page.url.pathname.startsWith(ruta)));
</script>

<div class="admin">
	<header class="admin-barra">
		<div class="admin-barra-dentro">
			<a class="admin-marca" href="/" aria-label="SIMUNaM Administración, ir al inicio">
				<span class="admin-marca-logo"><Marca alto={22} /></span>
				<span class="admin-marca-texto">
					<strong>SIMUNaM</strong>
					<span>Administración</span>
				</span>
			</a>

			<nav class="admin-secciones" aria-label="Secciones de administración">
				{#each secciones as seccion (seccion.href)}
					<a href={seccion.href} aria-current={actual(seccion.href)}>
						<Icono nombre={seccion.icono} tamano={18} />
						{seccion.nombre}
					</a>
				{/each}
			</nav>

			<div class="admin-salidas">
				<a class="admin-inicio" href="/" title="Volver al inicio">
					<Icono nombre="inicio" tamano={18} />
					<span>Volver al inicio</span>
				</a>
				<!-- Sin JavaScript el POST navega solo: la salida nunca depende del cliente. -->
				<form method="POST" action="/salir">
					<button class="admin-salir" type="submit">
						<Icono nombre="salir" tamano={18} />
						Salir
					</button>
				</form>
			</div>
		</div>
	</header>

	<div class="admin-contenido">
		{#if propia}
			{@render children()}
		{:else}
			<div class="envoltorio ancho">
				{@render children()}
			</div>
		{/if}
	</div>

	<!-- En el teléfono las secciones van abajo, al alcance del pulgar. -->
	<nav class="admin-pestanas" aria-label="Secciones de administración">
		{#each secciones as seccion (seccion.href)}
			<a href={seccion.href} aria-current={actual(seccion.href)}>
				<span><Icono nombre={seccion.icono} tamano={20} /></span>
				{seccion.nombre}
			</a>
		{/each}
	</nav>
</div>
