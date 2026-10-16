<script lang="ts">
	import Icono from '$lib/Icono.svelte';
	import Marca from '$lib/Marca.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Cartel de la mesa {data.mesa.numero} — SIMUNaM</title>
</svelte:head>

<div class="cartel-pagina">
	<!-- Los controles no se imprimen: el papel se queda sólo con el cartel. -->
	<div class="cartel-controles no-imprimir">
		<a class="mesa-volver" href="/mesas/{data.curso.codigo}/{data.mesa.numero}">
			<Icono nombre="atras" />
			Mesa {data.mesa.numero}
		</a>
		<button class="boton secundario cartel-imprimir" type="button" onclick={() => window.print()}>
			<Icono nombre="imprimir" tamano={18} />
			Imprimir
		</button>
	</div>

	<!-- Ocupa toda la ventana sin que el líder toque nada: en vertical, una columna
	     con el código abajo; en una pantalla horizontal ancha, el código a la
	     izquierda y los textos a la derecha; en papel, una hoja A4. -->
	<main class="cartel">
		<div class="cartel-textos">
			<!-- El curso va primero porque cada edición numera sus mesas desde 1: sin
			     él, dos carteles «Mesa 4» del mismo edificio serían iguales. -->
			<p class="cartel-curso">{data.curso.nombre}</p>
			<div>
				<p class="cartel-rotulo">Escaneá para entrar a</p>
				<p class="cartel-numero">Mesa {data.mesa.numero}</p>
			</div>
			{#if data.mesa.escenario?.nombre}
				<p class="cartel-escenario">{data.mesa.escenario.nombre}</p>
			{/if}
		</div>

		<img
			class="cartel-qr"
			src="/m/{data.curso.codigo}/{data.mesa.numero}/qr"
			alt="Código QR para entrar a la mesa {data.mesa.numero}"
		/>

		<p class="cartel-firma">
			<Marca alto={20} />
			SIMUNaM
		</p>
	</main>
</div>
