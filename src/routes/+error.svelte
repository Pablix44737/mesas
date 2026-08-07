<script lang="ts">
	import { page } from '$app/state';
	import Icono from '$lib/Icono.svelte';
</script>

<svelte:head>
	<title>{page.status} — MESAS</title>
</svelte:head>

<div class="app">
	<header class="app-barra">
		<a class="marca" href="/">
			<Icono nombre="checklist" tamano={22} />
			MESAS
		</a>
	</header>

	<div class="envoltorio">
		<div class="tarjeta" style="margin-top: 32px">
			<div class="fila">
				<span class="avatar-rol gris"><Icono nombre="alerta" tamano={22} /></span>
				<div class="identidad">
					<span class="etiqueta">Error {page.status}</span>
					<span class="nombre">{page.error?.message ?? 'Algo salió mal'}</span>
				</div>
			</div>
			<p class="detalle">
				Si llegaste acá escaneando el código de tu mesa, avisale al líder de mesa.
			</p>
			<a class="boton secundario bloque" href="/">
				<Icono nombre="inicio" />
				Volver al inicio
			</a>
		</div>
	</div>
</div>
