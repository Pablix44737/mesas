<script lang="ts">
	import Icono from '$lib/Icono.svelte';
	import BarraSuperior from '$lib/BarraSuperior.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Mesa {data.numero} — SIMUNaM</title>
</svelte:head>

<div class="app">
	<BarraSuperior volverA="/" titulo="Mesa {data.numero}" sub="¿De qué curso?" />

	<div class="envoltorio">
		<div class="aviso alerta">
			<Icono nombre="alerta" />
			<span>
				Hay una <strong>mesa {data.numero}</strong> en más de un curso, así que este código no
				alcanza para saber a cuál entrar. Es un cartel de los viejos: pedile al líder de mesa el
				actualizado.
			</span>
		</div>

		<h2 class="etiqueta" style="margin-bottom: 8px">Elegí el curso</h2>

		{#each data.cursos as curso (curso.codigo)}
			<a class="tarjeta-enlace" href="/m/{curso.codigo}/{data.numero}">
				<span class="numero-mesa">{data.numero}</span>
				<span class="texto">
					<span class="titulo">{curso.nombre}</span>
					<span class="detalle">Mesa {data.numero} de este curso</span>
				</span>
				<Icono nombre="adelante" clase="flecha" />
			</a>
		{/each}
	</div>
</div>
