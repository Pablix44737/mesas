<script lang="ts">
	import BarraSuperior from '$lib/BarraSuperior.svelte';
	import Icono from '$lib/Icono.svelte';

	let { children } = $props();
</script>

<BarraSuperior titulo="Plataforma" sub="Instituciones de SIMUNaM">
	{#snippet derecha()}
		<!-- Sin JavaScript el POST navega solo: la salida nunca depende del cliente. -->
		<form method="POST" action="/plataforma/salir">
			<button class="boton fantasma" type="submit">
				<Icono nombre="candado" tamano={16} />
				Salir
			</button>
		</form>
	{/snippet}
</BarraSuperior>

<div class="envoltorio ancho">
	{@render children()}
</div>
