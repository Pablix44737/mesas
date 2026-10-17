<script lang="ts">
	import Icono from '$lib/Icono.svelte';
	import Marca from '$lib/Marca.svelte';
</script>

<svelte:head>
	<title>SIMUNaM</title>
</svelte:head>

<!-- Una columna en el teléfono, con el acceso del participante al alcance del
     pulgar; dos columnas en pantallas anchas, la identidad a un lado y los
     accesos al otro. -->
<div class="inicio">
	<header class="inicio-identidad">
		<div class="inicio-marca">
			<span class="inicio-isotipo"><Marca alto={40} /></span>
			<h1>SIMUNaM</h1>
		</div>
		<p class="inicio-frase">
			Apoyo a los escenarios de simulación clínica. Elegí desde dónde vas a trabajar.
		</p>
		<p class="inicio-institucion solo-ancho">Centro de Simulación · Escuela de Enfermería (UNaM)</p>
	</header>

	<nav class="inicio-accesos" aria-label="Elegí desde dónde vas a trabajar">
		<a class="inicio-participante" href="/participar">
			<span class="inicio-participante-icono"><Icono nombre="qr" tamano={34} grosor={2} /></span>
			<span class="inicio-participante-texto">
				<strong>Participante</strong>
				<span>Escaneá el QR de tu mesa</span>
			</span>
			<Icono nombre="avanzar" tamano={24} grosor={2.25} />
		</a>

		<div class="inicio-coordinacion">
			<p class="rotulo-chico">Quienes coordinan</p>
			<div class="inicio-coordinacion-lista">
				<a href="/mesas">
					<span class="inicio-icono"><Icono nombre="mesa" /></span>
					<span class="inicio-acceso-texto">
						<strong>Líder de mesa</strong>
						<span>Creá tu mesa y habilitá sus ciclos</span>
					</span>
					<Icono nombre="adelante" tamano={18} />
				</a>
				<a href="/admin">
					<span class="inicio-icono"><Icono nombre="escudo" /></span>
					<span class="inicio-acceso-texto">
						<span class="inicio-acceso-titulo">
							<strong>Administración</strong>
							<span class="inicio-pide-clave">
								<Icono nombre="candado" tamano={11} grosor={2.5} />
								Pide clave
							</span>
						</span>
						<span>Escenarios, checklists y padrón</span>
					</span>
					<Icono nombre="adelante" tamano={18} />
				</a>
			</div>
		</div>

		<p class="inicio-institucion solo-angosto">Centro de Simulación · Escuela de Enfermería (UNaM)</p>
	</nav>
</div>
