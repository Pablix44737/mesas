<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icono from './Icono.svelte';

	let {
		volverA = '',
		titulo,
		sub = '',
		derecha
	}: { volverA?: string; titulo: string; sub?: string; derecha?: Snippet } = $props();
</script>

<header class="app-barra">
	{#if volverA}
		<a class="icono-boton" href={volverA} aria-label="Volver">
			<Icono nombre="atras" />
		</a>
	{/if}
	<div class="contexto">
		<span class="titulo">{titulo}</span>
		{#if sub}<span class="sub">{sub}</span>{/if}
	</div>
	{#if derecha}{@render derecha()}{/if}
</header>
