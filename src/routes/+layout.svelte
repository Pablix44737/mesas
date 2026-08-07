<script lang="ts">
	// Fuentes servidas desde el propio proyecto: ningún pedido a terceros, así la
	// tipografía no depende de que la red del aula llegue a Google.
	import '@fontsource/hanken-grotesk/600.css';
	import '@fontsource/hanken-grotesk/700.css';
	import '@fontsource/inter/400.css';
	import '@fontsource/inter/500.css';
	import '@fontsource/inter/600.css';
	import '../app.css';

	let { children } = $props();
</script>

{@render children()}
