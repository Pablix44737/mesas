<script lang="ts">
	import Icono from '$lib/Icono.svelte';
	import { iconoDeRol, queHaceElRol } from '$lib/roles';
	import type { Rol } from '$lib/tipos';

	/**
	 * Las tarjetas para elegir el rol de un ciclo, en dos grupos: quienes observan
	 * y quienes participan del escenario. Las usan la pantalla de la mesa, al
	 * entrar, y la del rol, al pasar al ciclo siguiente.
	 */
	let {
		roles,
		leyenda,
		elegido = $bindable(''),
		error = null,
		onelegir
	}: {
		roles: Pick<Rol, 'codigo' | 'nombre' | 'observador'>[];
		leyenda: string;
		elegido?: string;
		error?: string | null;
		onelegir?: (codigo: string) => void;
	} = $props();

	const grupos = $derived(
		[
			{ titulo: 'Observás el escenario', roles: roles.filter((rol) => rol.observador) },
			{ titulo: 'Participás del escenario', roles: roles.filter((rol) => !rol.observador) }
		].filter((grupo) => grupo.roles.length > 0)
	);
</script>

<fieldset class="sumarse-roles" aria-describedby={error ? 'rol-error' : undefined}>
	<legend>{leyenda}</legend>
	{#each grupos as grupo (grupo.titulo)}
		<p class="rotulo-chico">{grupo.titulo}</p>
		{#each grupo.roles as rol (rol.codigo)}
			<label class="sumarse-rol" class:observa={rol.observador} class:invalido={Boolean(error)}>
				<input
					type="radio"
					name="rolCodigo"
					value={rol.codigo}
					checked={elegido === rol.codigo}
					onchange={() => {
						elegido = rol.codigo;
						onelegir?.(rol.codigo);
					}}
				/>
				<span class="sumarse-rol-icono">
					<Icono nombre={iconoDeRol[rol.codigo] ?? 'operador'} tamano={22} grosor={2} />
				</span>
				<span class="sumarse-rol-texto">
					<strong>{rol.nombre}</strong>
					<span>{queHaceElRol[rol.codigo] ?? ''}</span>
				</span>
				<span class="sumarse-rol-marca">
					<Icono nombre="tilde" tamano={14} grosor={3.5} />
				</span>
			</label>
		{/each}
	{/each}
	{#if error}
		<p class="campo-error" id="rol-error"><Icono nombre="error" tamano={16} />{error}</p>
	{/if}
</fieldset>
