<script lang="ts">
	import Icono from '$lib/Icono.svelte';
	import Marca from '$lib/Marca.svelte';
</script>

<svelte:head>
	<title>SIMUNaM</title>
</svelte:head>

<div class="bienvenida">
	<main class="bienvenida-caja">
		<header class="bienvenida-encabezado">
			<span class="bienvenida-logo"><Marca alto={46} /></span>
			<h1>SIMUNaM</h1>
			<p>
				Apoyo a los escenarios de simulación clínica. Elegí desde dónde vas a trabajar para
				empezar.
			</p>
		</header>

		<nav class="accesos" aria-label="Elegí desde dónde vas a trabajar">
			<a class="acceso principal" href="/participar">
				<span class="avatar-rol"><Icono nombre="qr" tamano={26} /></span>
				<span class="texto">
					<span class="titulo">Participante</span>
					<span class="etiqueta">Escanear el QR de la mesa</span>
				</span>
				<Icono nombre="adelante" clase="flecha" />
			</a>

			<p class="separador etiqueta"><span>Quienes coordinan</span></p>

			<a class="acceso" href="/mesas">
				<span class="avatar-rol"><Icono nombre="mesa" /></span>
				<span class="texto">
					<span class="titulo">Líder de mesa</span>
					<span class="detalle">Crear la mesa y habilitar sus corridas</span>
				</span>
				<Icono nombre="adelante" clase="flecha" />
			</a>

			<a class="acceso" href="/admin">
				<span class="avatar-rol gris"><Icono nombre="escudo" /></span>
				<span class="texto">
					<span class="titulo">Administración</span>
					<span class="detalle">Escenarios, checklists y padrón · pide clave</span>
				</span>
				<Icono nombre="adelante" clase="flecha" />
			</a>
		</nav>

		<footer class="bienvenida-pie">
			Centro de Simulación · Escuela de Enfermería (UNaM)
		</footer>
	</main>
</div>
