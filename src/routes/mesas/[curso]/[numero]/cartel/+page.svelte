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
		<a class="boton fantasma" href="/mesas/{data.curso.codigo}/{data.mesa.numero}">
			<Icono nombre="atras" tamano={16} />
			Volver a la mesa
		</a>
		<button class="boton" type="button" onclick={() => window.print()}>
			<Icono nombre="descargar" tamano={16} />
			Imprimir
		</button>
	</div>

	<div class="cartel">
		<!-- El curso va arriba del número porque cada edición numera sus mesas desde
		     1: sin él, dos carteles «Mesa 4» del mismo edificio serían iguales. -->
		<p class="cartel-curso">{data.curso.nombre}</p>
		<p class="cartel-rotulo">Escaneá para entrar a</p>
		<p class="cartel-numero">Mesa {data.mesa.numero}</p>
		{#if data.mesa.escenario?.nombre}
			<p class="cartel-escenario">{data.mesa.escenario.nombre}</p>
		{/if}

		<img
			class="cartel-qr"
			src="/m/{data.curso.codigo}/{data.mesa.numero}/qr"
			alt="Código QR para entrar a la mesa {data.mesa.numero}"
		/>

		<!-- <p class="cartel-url">{data.origen}/m/{data.curso.codigo}/{data.mesa.numero}</p> -->

		<p class="cartel-firma">
			<Marca alto={14} />
			SIMUNaM
		</p>
	</div>

	<!-- <p class="pie no-imprimir">
		Desde el teléfono, «Imprimir» abre el diálogo del sistema: sirve tanto para mandarlo a una
		impresora como para guardarlo en PDF.
	</p> -->
</div>
