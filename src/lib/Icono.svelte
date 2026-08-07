<script lang="ts">
	import { iconos } from './iconos';

	let {
		nombre,
		tamano = 20,
		grosor = 1.75,
		clase = ''
	}: { nombre: string; tamano?: number; grosor?: number; clase?: string } = $props();

	const trazos = $derived(iconos[nombre] ?? []);
</script>

<svg
	class="icono {clase}"
	width={tamano}
	height={tamano}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width={grosor}
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	focusable="false"
>
	{#each trazos as d (d)}
		<path {d} />
	{/each}
</svg>

<style>
	.icono {
		flex: 0 0 auto;
		display: block;
	}
</style>
