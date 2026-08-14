<script lang="ts">
	import { page } from '$app/state';
	import Icono from '$lib/Icono.svelte';
	import Marca from '$lib/Marca.svelte';

	let { children } = $props();

	const secciones = [
		{ href: '/admin/escenarios', nombre: 'Escenarios', icono: 'escenario' },
		{ href: '/admin/checklists', nombre: 'Checklists', icono: 'checklist' },
		{ href: '/admin/mesas', nombre: 'Mesas', icono: 'mesa' },
		{ href: '/admin/padron', nombre: 'Padrón', icono: 'padron' }
	];

	const actual = (href: string) => (page.url.pathname.startsWith(href) ? 'page' : undefined);
</script>

<div class="admin">
	<nav class="lateral" aria-label="Administración">
		<a class="lateral-marca" href="/">
			<span class="logo"><Marca alto={24} /></span>
			<span>
				<span class="nombre">SIMUNaM</span><br />
				<span class="sub">Administración</span>
			</span>
		</a>

		<ul class="lateral-nav">
			{#each secciones as seccion (seccion.href)}
				<li>
					<a href={seccion.href} aria-current={actual(seccion.href)}>
						<Icono nombre={seccion.icono} />
						{seccion.nombre}
					</a>
				</li>
			{/each}
		</ul>

		<div class="lateral-pie">
			<a href="/" style="text-decoration: none; color: inherit">← Volver al inicio</a>
		</div>
	</nav>

	<div class="admin-main">
		<header class="app-barra">
			<a class="marca" href="/">
				<Marca alto={26} />
				SIMUNaM
			</a>
			<div class="contexto"></div>
			<!-- Sin JavaScript el POST navega solo: la salida nunca depende del cliente. -->
			<form method="POST" action="/salir">
				<button class="boton fantasma" type="submit">
					<Icono nombre="candado" tamano={16} />
					Salir
				</button>
			</form>
		</header>

		<nav class="admin-barra-movil" aria-label="Secciones de administración">
			{#each secciones as seccion (seccion.href)}
				<a href={seccion.href} aria-current={actual(seccion.href)}>
					<Icono nombre={seccion.icono} tamano={16} />
					{seccion.nombre}
				</a>
			{/each}
		</nav>

		<div class="envoltorio ancho">
			{@render children()}
		</div>
	</div>
</div>
