<script lang="ts">
	import { tick } from 'svelte';
	import Marca from '$lib/Marca.svelte';
	import Icono from '$lib/Icono.svelte';
	import { page } from '$app/state';
	import { guiones } from './guiones';
	import type { Estado } from './tipos';

	/**
	 * El escenario del video: 432 × 768 px de CSS, que con densidad 2,5 dan el
	 * cuadro vertical de 1080 × 1920. El teléfono es un iframe con las pantallas
	 * reales, así el diseño responde a su ancho como en un celular de verdad.
	 * `seek(t)` deja todo como corresponde al segundo t: los cuadros salen
	 * siempre iguales, se graben en orden o se mire uno suelto.
	 */
	type Pantalla = { mostrar: (estado: Estado) => Promise<boolean> };

	// El guion se elige una vez, al abrir: `/video?v=participante`.
	const guion = guiones[page.url.searchParams.get('v') ?? 'lider'] ?? guiones.lider;
	const { estados, desplazamientos, toques, resaltados, pasos, notas, apertura: APERTURA, cierre: CIERRE } = guion;
	type Caja = { x: number; y: number; w: number; h: number };

	let marco = $state<HTMLIFrameElement>();
	let barra = $state<HTMLElement>();
	let v = $state(-1);
	let textoDeBarra = $state('simunam.com');

	const lineal = (a: number, b: number, x: number) => Math.min(1, Math.max(0, (x - a) / (b - a)));
	const suave = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
	const salida = (p: number) => 1 - (1 - p) ** 3;

	const ventana = () => marco?.contentWindow as (Window & { pantalla?: Pantalla }) | null;
	const documento = () => marco?.contentDocument ?? null;

	/** Una caja del teléfono, en coordenadas del escenario. */
	function caja(sel: string): Caja | null {
		if (sel === 'url' && barra) {
			const r = barra.getBoundingClientRect();
			return { x: r.left, y: r.top, w: r.width, h: r.height };
		}
		const el = documento()?.querySelector(sel);
		if (!el || !marco) return null;
		const r = el.getBoundingClientRect();
		const m = marco.getBoundingClientRect();
		// Lo que quedó fuera de la pantalla del teléfono no se marca.
		const y0 = Math.max(r.top, 0);
		const y1 = Math.min(r.bottom, m.height);
		if (y1 <= y0) return null;
		return { x: m.left + r.left, y: m.top + y0, w: r.width, h: y1 - y0 };
	}

	// ── Estado del teléfono ───────────────────────────────────────────────
	let desdeEstado = 0;
	function estadoEn(t: number) {
		let i = 0;
		while (i + 1 < estados.length && estados[i + 1][0] <= t) i++;
		return { desde: estados[i][0], estado: estados[i][1] };
	}

	// ── Desplazamiento ────────────────────────────────────────────────────
	const resueltos = new Map<number, number>();
	function resolver(i: number): number {
		const d = desplazamientos[i];
		if (typeof d.y === 'number') return d.y;
		const doc = documento();
		const el = doc?.querySelector(d.y);
		const win = ventana();
		if (el && win && doc) {
			const maximo = doc.documentElement.scrollHeight - win.innerHeight;
			const y = el.getBoundingClientRect().top + win.scrollY - (d.margen ?? 0);
			const valor = Math.max(0, Math.min(maximo, y));
			resueltos.set(i, valor);
			return valor;
		}
		return resueltos.get(i) ?? 0;
	}
	function desplazamientoEn(t: number) {
		let i = 0;
		while (i + 1 < desplazamientos.length && desplazamientos[i + 1].v <= t) i++;
		const siguiente = desplazamientos[i + 1];
		if (siguiente?.desde !== undefined && t >= siguiente.desde) {
			const p = suave(lineal(siguiente.desde, siguiente.v, t));
			return resolver(i) + (resolver(i + 1) - resolver(i)) * p;
		}
		return resolver(i);
	}

	// ── Dedo ──────────────────────────────────────────────────────────────
	const ultimas = new Map<number, { x: number; y: number }>();
	function centro(i: number) {
		const c = caja(toques[i].sel);
		if (c) ultimas.set(i, { x: c.x + c.w / 2, y: c.y + c.h / 2 });
		return ultimas.get(i) ?? null;
	}
	const FUERA = { x: 470, y: 820 };
	/**
	 * El dedo va hacia el próximo toque y, si el anterior fue hace poco, sale de
	 * ahí en vez de entrar desde afuera. Después del último toque de una tanda se
	 * queda donde tocó y se desvanece.
	 */
	function medirDedo() {
		const j = toques.findIndex((toque) => v <= toque.v + 0.12);
		const i = j < 0 ? toques.length - 1 : j - 1;
		const encadenado = j >= 0 && i >= 0 && toques[j].v - toques[i].v < 1.6;
		if (j >= 0) {
			const toque = toques[j];
			const previa = encadenado ? toques[i].v : -Infinity;
			const viaje = Math.min(0.75, toque.v - previa - 0.16);
			if (v >= toque.v - viaje) {
				const destino = centro(j);
				const desde = encadenado ? (ultimas.get(i) ?? FUERA) : FUERA;
				if (destino) {
					const p = salida(lineal(toque.v - viaje, toque.v - 0.08, v));
					return {
						x: desde.x + (destino.x - desde.x) * p,
						y: desde.y + (destino.y - desde.y) * p,
						apretado: v >= toque.v - 0.05,
						onda: lineal(toque.v, toque.v + 0.45, v),
						opacidad: encadenado ? 1 : lineal(toque.v - viaje, toque.v - viaje + 0.25, v)
					};
				}
			}
		}
		if (i >= 0 && v <= toques[i].v + 0.55) {
			// La pantalla pudo cambiar con el toque: se queda donde tocó.
			const donde = ultimas.get(i) ?? centro(i);
			if (!donde) return null;
			return {
				...donde,
				apretado: v <= toques[i].v + 0.12,
				onda: lineal(toques[i].v, toques[i].v + 0.45, v),
				opacidad: 1 - lineal(toques[i].v + 0.3, toques[i].v + 0.55, v)
			};
		}
		return null;
	}

	// ── Anillos, pasos y tarjetas ─────────────────────────────────────────
	const medirAnillos = () =>
		resaltados
			.filter((r) => v >= r.v0 - 0.2 && v <= r.v1 + 0.2)
			.map((r) => {
				const c = caja(r.sel);
				const opacidad = Math.min(lineal(r.v0 - 0.2, r.v0, v), 1 - lineal(r.v1, r.v1 + 0.2, v));
				const pulso = 0.5 + 0.5 * Math.sin((v - r.v0) * Math.PI * 2.2);
				return c ? { ...c, opacidad, pulso } : null;
			})
			.filter((a) => a !== null);

	/**
	 * El dedo y los anillos se miden sobre el teléfono ya dibujado en este
	 * segundo: medidos antes, quedarían donde estaba todo en el cuadro anterior.
	 */
	let dedo = $state<ReturnType<typeof medirDedo>>(null);
	let anillos = $state<ReturnType<typeof medirAnillos>>([]);
	const paso = $derived(pasos.find((p) => v >= p.v0 && v < p.v1) ?? null);
	const pasoOpacidad = $derived(paso ? Math.min(lineal(paso.v0, paso.v0 + 0.25, v), 1 - lineal(paso.v1 - 0.2, paso.v1, v)) : 0);
	const nota = $derived(notas.find((n) => v >= n.v0 && v < n.v1) ?? null);
	const notaOpacidad = $derived(nota ? Math.min(lineal(nota.v0, nota.v0 + 0.25, v), 1 - lineal(nota.v1 - 0.2, nota.v1, v)) : 0);
	const apertura = $derived(1 - lineal(APERTURA.hasta, APERTURA.hasta + APERTURA.sale, v));
	const cierre = $derived(lineal(CIERRE.desde, CIERRE.desde + CIERRE.entra, v));
	const telefono = $derived(salida(lineal(APERTURA.hasta - 0.3, APERTURA.hasta + 0.5, v)));

	async function seek(t: number) {
		const win = ventana();
		if (!win?.pantalla) throw new Error('El teléfono todavía no cargó');
		const ahora = t - guion.demora;
		const { desde, estado } = estadoEn(ahora);
		if (await win.pantalla.mostrar(estado)) desdeEstado = desde;
		textoDeBarra = estado.barra ?? 'simunam.com';
		// La línea de la cámara baja y sube sola.
		const vaiven = (ahora % 1.6) / 1.6;
		documento()!.documentElement.style.setProperty('--escaneo', String(1 - Math.abs(1 - 2 * vaiven)));
		win.scrollTo(0, desplazamientoEn(ahora));

		// La hoja de confirmación sube desde abajo, como en el teléfono.
		const doc = documento()!;
		const velo = doc.querySelector<HTMLElement>('.mesa-velo');
		const hoja = doc.querySelector<HTMLElement>('.mesa-dialogo');
		if (velo && hoja) {
			const p = salida(lineal(desdeEstado, desdeEstado + 0.35, ahora));
			velo.style.opacity = String(p);
			hoja.style.transform = `translateY(${(1 - p) * 100}%)`;
		}

		v = ahora;
		await tick();
		dedo = medirDedo();
		anillos = medirAnillos();
		await tick();
		// Con la pestaña oculta no hay cuadros de animación: el plazo evita quedarse esperando.
		await new Promise((listo) => {
			requestAnimationFrame(() => requestAnimationFrame(listo));
			setTimeout(listo, 100);
		});
	}

	async function cargado() {
		// El iframe avisa que cargó antes de que la app termine de arrancar adentro.
		while (!ventana()?.pantalla) await new Promise((r) => setTimeout(r, 50));
		await ventana()?.document.fonts.ready;
		await document.fonts.ready;
		(window as unknown as { video: unknown }).video = {
			seek,
			duracion: guion.duracion,
			demora: guion.demora,
			voz: guion.voz,
			salida: guion.salida,
			toques: toques.map((toque) => toque.v + guion.demora)
		};
		await seek(0);
	}
</script>

<svelte:head>
	<title>Video · Líder de mesa</title>
	<style>
		html,
		body {
			margin: 0;
			overflow: hidden;
			background: #0e4d7a;
		}
	</style>
</svelte:head>

<div class="escenario">
	<div class="fondo" aria-hidden="true"></div>

	<header class="paso" style:opacity={pasoOpacidad}>
		{#if paso}
			<span class="paso-numero">{paso.numero}</span>
			<span class="paso-textos">
				<span class="paso-titulo">{paso.titulo}</span>
				<span class="nota" style:opacity={notaOpacidad}>{nota?.texto ?? ''}</span>
			</span>
		{/if}
	</header>

	<div class="telefono" style:transform="translateY({(1 - telefono) * 760}px)">
		<div class="barra-direccion" bind:this={barra}>
			{#if textoDeBarra === 'simunam.com'}
				<Icono nombre="candado" tamano={11} grosor={2.5} />
			{/if}
			{textoDeBarra}
		</div>
		<iframe bind:this={marco} src="/video/pantalla" title="Teléfono" onload={cargado}></iframe>
	</div>

	{#each anillos as anillo, i (i)}
		<div
			class="anillo"
			style:left="{anillo.x - 5}px"
			style:top="{anillo.y - 5}px"
			style:width="{anillo.w + 10}px"
			style:height="{anillo.h + 10}px"
			style:opacity={anillo.opacidad}
			style:box-shadow="0 0 0 {3 + anillo.pulso * 5}px rgba(153, 204, 51, {0.45 - anillo.pulso * 0.25})"
		></div>
	{/each}

	{#if dedo}
		<div class="dedo" style:left="{dedo.x}px" style:top="{dedo.y}px" style:opacity={dedo.opacidad}>
			{#if dedo.onda > 0 && dedo.onda < 1}
				<span class="onda" style:transform="scale({0.6 + dedo.onda * 1.6})" style:opacity={0.6 * (1 - dedo.onda)}></span>
			{/if}
			<span class="yema" style:transform="scale({dedo.apretado ? 0.82 : 1})"></span>
		</div>
	{/if}

	{#if apertura > 0}
		<section class="tarjeta-titulo" style:opacity={apertura}>
			<span class="logo" style:transform="translateY({(1 - salida(lineal(0, 0.6, v))) * 24}px)">
				<Marca alto={86} />
			</span>
			<h1>SIMUNaM</h1>
			<p class="subtitulo">Guía rápida<br />{guion.para}</p>
			<p class="institucion">Centro de Simulación · Escuela de Enfermería (UNaM)</p>
		</section>
	{/if}

	{#if cierre > 0}
		<section class="tarjeta-titulo" style:opacity={cierre}>
			<span class="logo"><Marca alto={70} /></span>
			<p class="direccion">simunam.com</p>
			<p class="subtitulo">¡Buena simulación!</p>
			<p class="institucion">Centro de Simulación · Escuela de Enfermería (UNaM)</p>
		</section>
	{/if}
</div>

<style>
	.escenario {
		position: relative;
		width: 432px;
		height: 768px;
		overflow: hidden;
		font-family: var(--fuente-texto);
	}
	.fondo {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(circle at 15% 8%, rgba(153, 204, 51, 0.35), transparent 42%),
			radial-gradient(circle at 90% 95%, rgba(18, 97, 153, 0.9), transparent 55%),
			linear-gradient(160deg, #126199, #0e4d7a 60%, #0b3d62);
	}

	.paso {
		position: absolute;
		left: 18px;
		right: 18px;
		top: 14px;
		height: 62px;
		display: flex;
		align-items: flex-start;
		gap: 12px;
		color: #fff;
	}
	.paso-numero {
		flex: 0 0 auto;
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: var(--verde);
		color: #12303f;
		font: 700 22px/1 var(--fuente-titulo);
	}
	.paso-titulo {
		font: 700 25px/1.1 var(--fuente-titulo);
		letter-spacing: -0.01em;
	}

	.telefono {
		position: absolute;
		left: 18px;
		top: 84px;
		width: 380px;
		height: 660px;
		padding: 8px;
		box-sizing: content-box;
		margin-left: -8px;
		border-radius: 34px;
		background: #0a1f2e;
		box-shadow:
			0 30px 60px rgba(0, 0, 0, 0.35),
			inset 0 0 0 1.5px rgba(255, 255, 255, 0.12);
	}
	.barra-direccion {
		height: 34px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		border-radius: 26px 26px 0 0;
		background: #eef2f5;
		color: #12303f;
		font: 500 13px/1 var(--fuente-texto);
	}
	iframe {
		display: block;
		width: 380px;
		height: 626px;
		border: 0;
		border-radius: 0 0 26px 26px;
		background: var(--fondo);
	}
	.paso-textos {
		padding-top: 6px;
		display: flex;
		flex-direction: column;
		gap: 5px;
	}
	.nota {
		min-height: 15px;
		color: #d9ecb3;
		font: 600 14.5px/1 var(--fuente-texto);
	}

	.anillo {
		position: absolute;
		border: 3px solid var(--verde);
		border-radius: 14px;
		pointer-events: none;
	}

	.dedo {
		position: absolute;
		width: 0;
		height: 0;
		pointer-events: none;
	}
	.yema,
	.onda {
		position: absolute;
		left: -19px;
		top: -19px;
		width: 38px;
		height: 38px;
		border-radius: 50%;
	}
	.yema {
		background: rgba(18, 97, 153, 0.32);
		border: 3px solid #fff;
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
		box-sizing: border-box;
	}
	.onda {
		background: rgba(153, 204, 51, 0.55);
	}

	.tarjeta-titulo {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 32px;
		text-align: center;
		color: #fff;
		background:
			radial-gradient(circle at 50% 30%, rgba(153, 204, 51, 0.25), transparent 50%),
			linear-gradient(160deg, #126199, #0e4d7a 60%, #0b3d62);
	}
	.logo {
		color: var(--verde);
		margin-bottom: 10px;
	}
	h1 {
		margin: 0;
		font: 700 52px/1 var(--fuente-titulo);
		letter-spacing: -0.02em;
		color: #fff;
	}
	.subtitulo {
		margin: 10px 0 0;
		font: 600 26px/1.25 var(--fuente-titulo);
	}
	.direccion {
		margin: 0;
		padding: 10px 22px;
		border-radius: 999px;
		background: #fff;
		color: #0e4d7a;
		font: 700 30px/1 var(--fuente-titulo);
	}
	.institucion {
		position: absolute;
		bottom: 40px;
		margin: 0;
		font: 500 13px/1.3 var(--fuente-texto);
		opacity: 0.8;
	}
</style>
