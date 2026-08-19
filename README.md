# SIMUNaM — Sistema de apoyo a escenarios de simulación clínica

> El sistema se llama **SIMUNaM**. «MESAS» aparece en el código sólo como el nombre
> del modelo pedagógico (Modelo de Entrenamiento con Simulación para el Aprendizaje
> Significativo), y «mesa» como la entidad del dominio: ninguno de los dos se
> renombra.

PWA con QR por mesa. SvelteKit + Supabase.

Estado: **todas las features del documento implementadas y verificadas.**

## Puesta en marcha

```bash
npm install
```

Copiá `.env.example` a `.env` y completá `SUPABASE_SERVICE_ROLE_KEY` con la clave
`service_role` del dashboard (Project Settings → API Keys). Es secreta: ignora RLS
y no debe commitearse.

```bash
npm run dev
```

La base está migrada en el proyecto Supabase `mesas` (`ihqirdjsrxqovxjwtoto`,
sa-east-1), con datos de prueba cargados.

> `.claude/launch.json` apunta a `C:\Program Files\nodejs\node.exe` con ruta
> absoluta, porque el proceso que lanza el server no tenía Node en el PATH cuando
> se instaló. Una vez reiniciado el entorno se puede volver a `npm` / `run dev`.

## Despliegue en Vercel

El proyecto ya está preparado: usa `@sveltejs/adapter-vercel` y lee las claves en
runtime, así que el build no las necesita.

1. Crear un repositorio vacío en GitHub y subir el que ya está acá:

   ```bash
   git remote add origin https://github.com/USUARIO/mesas.git
   git push -u origin main
   ```

2. En [vercel.com/new](https://vercel.com/new), importar ese repositorio. Vercel
   detecta SvelteKit solo; no hay que tocar los comandos de build.

3. Antes de la primera compilación, en **Environment Variables** cargar las dos:

   | Variable | Valor |
   | -------- | ----- |
   | `SUPABASE_URL` | `https://ihqirdjsrxqovxjwtoto.supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | la clave `service_role` del dashboard |
   | `CLAVE_ADMIN` | opcional: la clave de administración (por defecto `centrosimu123`) |

   La `service_role` es secreta y sólo se usa del lado del servidor. Si se cargan
   después del primer deploy, hay que volver a desplegar para que las funciones las
   tomen. Cambiar `CLAVE_ADMIN` invalida sola las sesiones abiertas con la anterior.

A partir de ahí, cada `git push` publica una versión nueva.

Los códigos QR se arman con el origen del pedido, así que en cuanto la app esté en
su dominio los QR van a apuntar solos a la URL correcta — no hay nada que configurar.

> **Sobre el padrón.** La administración —donde se ven todas las evaluaciones y se
> edita el padrón— pide clave. `/mesas` y `/m/<numero>` no: el líder y los
> participantes entran sin credenciales, como pasa en el aula. Quien tenga el número
> de una mesa puede ver su material y registrarse en ella.

## Lo que hay hoy

`/` — la pantalla de bienvenida. Antes de ver nada, cada quien elige desde dónde va
a trabajar: participante, líder de mesa o administración. Así nadie se topa con
funciones que no le tocan.

`/participar` — para quien ya tiene la app abierta y todavía no escaneó. Le presta
la cámara si el navegador sabe leer códigos, y en cualquier caso le deja escribir el
número de mesa, que se comprueba antes de llevarlo. Quien escanea el QR con la
cámara del teléfono no pasa por acá: va derecho a `/m/<numero>`.

`/ingresar` — la clave de administración. Es la única puerta con credenciales del
sistema.

`/admin/checklists` — el administrador crea un checklist indicando el rol
observador al que corresponde, le carga sus criterios, decide si ponderarlo y lo da
por terminado. Recién ahí queda disponible para asociarse a un escenario y
presentarse en las mesas.

`/admin/padron` — el administrador ve quiénes están cargados, los busca por apellido,
nombre o DNI, incorpora a los que falten, corrige los que estén mal y quita a los que
sobren. Los DNI que ocuparon un rol sin estar en el padrón aparecen arriba, con el rol
y la corrida donde se usaron; incorporarlos resuelve sus registros solo. Cada persona
muestra cuántos roles ocupó, que es lo que hay que saber antes de quitarla o de
cambiarle el DNI.

`/admin/mesas` — el administrador consulta cómo se desarrolló cada mesa: sus
corridas, quiénes ocuparon cada rol en cada una y quién llegó a enviar su checklist.
`/admin/mesas/<numero>/corridas/<numero>` muestra las evaluaciones de esa corrida
tal como sus observadores las completaron, ítem por ítem, con su resultado. Desde el
listado también puede **eliminar una mesa**, con todo lo que colgó de ella; hay que
escribir su número para confirmarlo.

`/admin/escenarios` — el administrador da de alta escenarios, les asocia el
checklist del observador de la técnica y les adjunta la planificación (PDF o Word,
hasta 20 MB). El checklist del observador de la operación es común a todos los
escenarios: se muestra, no se elige.

`/mesas` — el líder de mesa da de alta una mesa con su número y uno de los
escenarios disponibles. `/mesas/<numero>` le muestra quiénes se identificaron en la
corrida en curso y con qué rol —con marca de quién ya envió su checklist y qué roles
quedaron sin ocupar—, el material que la mesa hereda
de su escenario —la planificación para el facilitador y los dos checklists, cada
uno con su cantidad de ítems y su máximo alcanzable— y es donde el líder habilita
las corridas: la primera, y después cada siguiente, que cierra la anterior.

`/mesas/<numero>/cartel` — el QR en grande, con el número de mesa y el escenario
arriba, para proyectar o imprimir. Trae su propio botón de impresión, así que sirve
también desde el teléfono, donde no hay Ctrl+P. En papel se van los botones y el
marco: quedan el número, el código a 11 cm y la firma del sistema.

`/m/<numero>` — adonde lleva el código QR de la mesa (`/m/<numero>/qr`). El
participante ingresa su DNI, elige el rol que va a ocupar en la corrida habilitada
y recibe lo que ese rol necesita: el observador de la operación, el checklist común;
el de la técnica, el del escenario de su mesa; el facilitador, **las dos cosas** —la
planificación (o el aviso de que no está cargada) y el mismo checklist de la técnica,
que completa y envía como cualquier observador—; el operador y el asistente quedan
registrados sin material. Los observadores marcan sus ítems durante la corrida —cada marca viaja al
servidor en el momento— y al enviar cierran la evaluación, que queda registrada con
el observador, su rol, la corrida y la mesa. El resultado se muestra siempre contra
el máximo alcanzable del checklist: «6 de 11 · 55% de los criterios».

`/m/<numero>/consulta` — quien practicó la técnica se identifica con su DNI una vez
terminada la corrida y accede a los checklists que enviaron sus observadores, ítem
por ítem y con su resultado. Solo para quien ocupó el rol de operador o de asistente.

La planificación va a un bucket privado y se sirve por endpoints del servidor
(`/admin/escenarios/<id>/planificacion` y `/mesas/<numero>/planificacion`), nunca
por URL directa.

### Datos de prueba

Dos escenarios preparados, cada uno con su checklist de técnica:

| Escenario | Checklist de la técnica |
| --------- | ----------------------- |
| Manejo inicial del paciente politraumatizado | 5 ítems, ponderado (máximo 11) |
| Reanimación cardiopulmonar avanzada | 5 ítems, sin ponderar |

Checklist de la operación: 6 ítems, sin ponderar. Padrón: 6 participantes
(DNI 30111222 a 30666777).

Además, cargado por la interfaz y no por `seed.sql`: una planificación adjunta al
escenario del politraumatizado; la Mesa 1 sobre ese escenario, con la corrida 1
cerrada y la 2 en curso y cinco participantes identificados en los cinco roles; y
la Mesa 2 sobre el escenario de RCP —que no tiene planificación— con su corrida 1
en curso, útil para ejercitar el aviso al facilitador. En la corrida 2 de la Mesa 1
hay tres evaluaciones enviadas: Ana 6/11, Bruno 10/11 (los dos de la técnica, con
los mismos criterios y resultados distintos) y Carla 3/6 (la de la operación). En la
Mesa 2 hay un checklist abierto con ítems marcados y **sin enviar**, para poder
distinguir «evaluación en curso» de «evaluación registrada», y una séptima persona
(Gabriela Nunez, DNI 45123456) que se registró y evaluó antes de estar en el padrón
y fue incorporada después.

## Decisiones de diseño

**Paleta de la Escuela de Enfermería (UNaM).** Azul `#126199` y verde `#99cc33`,
tomados del sitio de la institución. El verde de marca sobre blanco da 1.9:1, muy
por debajo del mínimo legible, así que se usa como superficie y acento (chip del
número de mesa, ítems cumplidos, botón de confirmación con tinta encima) y para
texto va `--verde-oscuro` `#4d7c0f`, que llega a 4.9:1.

**La clave protege la administración en el servidor, no en la pantalla.** Sacar la
administración de la bienvenida sólo esconde el enlace: sin guardián alcanzaba con
escribir `/admin` en la barra del navegador. La comprobación vive en
`hooks.server.ts`, en un solo lugar, así una sección nueva de administración queda
protegida sin que haya que acordarse. La sesión viaja firmada (HMAC) en la propia
cookie y no se guarda nada en memoria: en Vercel cada pedido puede caer en una
instancia distinta y un registro en memoria se perdería entre pedido y pedido. La
firma se deriva de la clave, así que cambiarla invalida las cookies viejas sin
lista de revocación. El `?volverA=` sólo acepta rutas que empiecen con `/admin`,
para que la pantalla de ingreso no sirva de trampolín a otro sitio.

**El lector de QR es opcional, el número de mesa no.** `BarcodeDetector` está en
Chrome sobre Android —el teléfono más común en el aula— pero no en Safari/iOS, y la
cámara se puede denegar. Por eso el botón de cámara aparece sólo si el navegador lo
soporta y la entrada por número está siempre a la vista, comprobando contra la base
para poder decir «no existe la mesa 7» en la misma pantalla en vez de mandar a la
persona a una página de error. De todos modos el camino habitual sigue siendo
escanear con la cámara del teléfono, que abre la mesa sin pasar por la app.

**El sistema visual viene de una propuesta de Stitch, adaptada.** Se tomó su
estructura —barra superior fija con el contexto, progreso pegajoso, barra de acción
fija abajo, sidebar de administración, tablas con chips de estado, tarjetas de rol—
y su escala tipográfica, espaciado y radios chicos. No se tomó su paleta: Stitch
proponía `#004977` como primario y mandaba el azul institucional a un rol
secundario; acá se hace al revés. Tampoco su `user-scalable=no`, que bloquea el
zoom. Ni las pantallas que suponían features inexistentes (timer de corrida, notas
libres, secciones dentro de un checklist, métricas de dashboard, búsqueda).

**La marca es la silueta de perfil del Centro de Simulación** (`Marca.svelte`), con
el `viewBox` recortado al trazo real para que no arrastre aire vacío y se alinee con
el texto. Se usa en la barra superior, en la insignia del sidebar y en los iconos de
la PWA. Toma el color de donde esté, así que va en azul sobre blanco y en blanco
sobre azul sin necesidad de dos archivos.

**Sin dependencias externas de tipografía ni iconos.** Hanken Grotesk (títulos) e
Inter (texto) se sirven desde el propio proyecto vía Fontsource. Los ~28 iconos son
trazos SVG inline en `iconos.ts`, no una fuente de iconos. Nada de esto se pide a un
servidor de terceros: en un aula con wifi flojo la app no se queda sin tipografía ni
sin iconos, y no hay parpadeo de texto sin estilo. Se descartó JetBrains Mono, que
la propuesta usaba sólo para micro-etiquetas: no justificaba una tercera descarga.

**Un checklist a medias no se pierde cuando avanza la corrida.** Cerrar una corrida
no corta las evaluaciones en vuelo, pero el QR lleva al formulario de la corrida
nueva y el checklist sin enviar quedaba fuera de vista. La vista
`checklists_sin_enviar` lo hace visible en los tres puntos donde importa: al
identificarse se le ofrece terminarlo antes de entrar a la corrida nueva; si elige
seguir, su pantalla lo sigue ofreciendo —y a esa pantalla se vuelve escaneando el
QR, así que el camino nunca se corta—; y el líder ve, antes de habilitar la corrida
siguiente, quiénes están observando y todavía no enviaron. Nada de esto usa un flag:
sale de que la instancia tenga `enviada_en` en null, así que el aviso desaparece solo
al enviarse.

**La devolución no espera a que el líder cierre la corrida.** El Gherkin dice «una
vez finalizada», pero condicionarla a que la corrida deje de estar habilitada tiene
un mal final: en la última corrida del día el líder no avanza más, y quien practicó
nunca vería nada. Así que se muestra lo que haya enviado, avisando cuando la corrida
sigue en curso. El riesgo de que el operador espíe es bajo: por definición de su rol
no usa el sistema mientras ejecuta.

**La rotación de roles no necesitó nada propio.** Cae sola de que la participación
sea `(corrida, dni) → rol`: al habilitarse la corrida siguiente, quien escanea el QR
recibe el formulario de la corrida nueva —no su registro anterior, porque la
búsqueda de «ya me identifiqué» está acotada a la corrida habilitada— y puede
declarar otro rol. Los registros de las corridas previas quedan intactos y cada
evaluación cuelga de su corrida. Verificado en la Mesa 1: Ana pasó de observadora
de la técnica (corrida 2) a operadora (corrida 3), y Elena hizo el camino inverso.

**Quitar a alguien del padrón no borra lo que hizo.** La clave está en el FK:
`participaciones.participante_id` tiene `on delete set null`, así que al quitar a
una persona sus participaciones y evaluaciones quedan intactas —con el DNI, que es
el dato de base— y sólo pierden el nombre. Vuelven a resolverse solas si esa persona
se reincorpora. Bloquear el borrado habría sido peor: dejaría el padrón sin forma de
arreglar una carga equivocada.

**Eliminar una mesa se lleva puesta su rama entera, y nada más.** La cascada ya
estaba en el esquema base: `mesas → corridas → participaciones → checklist_instancias
→ checklist_respuestas`, las cuatro con `on delete cascade`. Un `delete from mesas`
las arrastra sin dejar nada suelto —verificado contando huérfanos en los cuatro
niveles— y no toca el padrón ni el material: los participantes, el escenario y los
checklists existen con independencia de la mesa que los usó.

Sorprende que la cascada no choque contra `checklist_respuestas_bloqueo_post_envio`,
que impide tocar las respuestas de un checklist ya enviado. No choca porque el
borrado en cascada corre como trigger AFTER sobre la tabla padre: cuando le llega el
turno a las respuestas, la fila de `checklist_instancias` ya no está, el guardia
busca su `enviada_en` y no encuentra nada que proteger. Es comportamiento definido de
Postgres, no suerte, pero conviene decirlo porque leyendo el trigger solo se supondría
lo contrario.

Aun así el borrado pasa por `borrar_mesa()`, para que contar y borrar ocurran en la
misma transacción: lo que se informa después es lo que de verdad se destruyó y no una
foto sacada al dibujar la confirmación. Toma el mismo `for update` sobre la mesa que
`habilitar_siguiente_corrida()`, así los dos se serializan en vez de cruzarse. Y el
número contra el que se confirma sale de la base y no del formulario: si viniera del
cliente, quien manda el pedido elegiría a la vez qué borrar y contra qué se comprueba,
y la traba no trabaría nada.

**El padrón se busca sin tildes y por palabras sueltas.** Los apellidos reales traen
Acuña, Benítez, Florentín, y el mismo apellido aparece cargado con tilde y sin ella
(Ruiz Diaz / Ruiz Díaz): buscar «ruiz diaz» tiene que encontrar a los dos, y nadie
debería pelearse con la ñ en el teclado del teléfono. Por eso el término se aplana
—minúsculas y sin diacríticos— antes de comparar. Y se parte en palabras que se
exigen todas por separado, en cualquier orden, porque casi todo el mundo tiene dos
nombres: «miriam acuña» no es un tramo seguido de «Acuña, Miriam Elizabeth» ni al
derecho ni al revés. Los dígitos van contra el DNI tolerando los puntos. El filtro
corre en el navegador sobre las filas que la página ya trajo: son decenas, no hace
falta molestar al servidor por cada tecla, y como la tabla se sigue armando entera
del lado del servidor, sin JavaScript no falta nada — sólo el filtro.

**Corregir un DNI mueve registros, y eso se dice antes y después.** El nombre y el
apellido son cosméticos, pero el DNI es la llave con que las mesas identifican a la
persona: cambiarlo dispara el trigger del padrón, que suelta los registros que la
apuntaban con el DNI viejo y adopta los que estaban esperando el nuevo. Nada se
borra —los registros quedan con su DNI, sin identificar—, pero el administrador
vería aparecer y desaparecer filas sin explicación. Así que la fila de edición avisa
en vivo qué va a pasar, calculándolo de lo que ya está en pantalla, y el mensaje de
después informa los números reales, contados antes del update: una vez que el
trigger corrió, son imposibles de reconstruir. El DNI se manda a la base sólo si
cambió, porque el trigger escucha esa columna y no hay motivo para despertarlo al
corregir un acento.

**Reordenar criterios no toca las evaluaciones.** Las respuestas apuntan al criterio
por su id, no por su posición, así que mover un criterio es puramente presentación:
una evaluación ya enviada sigue mostrando lo que su observador marcó. El intercambio
de órdenes lo hace `mover_criterio()` en la base y no la app, porque
`(plantilla_id, orden)` es único y dos updates sueltos chocarían; la función pasa por
un valor negativo dentro de la misma transacción, así que nunca queda a la vista.
En pantalla la posición se cuenta sobre la lista y no se lee de `orden`: al quitar
criterios el orden guardado deja huecos, y mostrarlos confundiría.

**El padrón resuelve en las dos direcciones.** Un trigger sobre `participaciones`
busca el DNI al registrarse, y otro sobre `participantes` resuelve, al incorporarse
alguien, todas las participaciones que lo estaban esperando —en cualquier mesa y
cualquier corrida—. Sin el segundo, un registro hecho antes de que la persona
existiera en el padrón quedaba pendiente para siempre. El mismo trigger suelta los
registros viejos si a alguien le corrigen el DNI.

**Un DNI desconocido nunca frena a nadie.** El registro se hace igual y la
advertencia aparece en la pantalla siguiente, no como un paso previo que haya que
confirmar. Quien no está en el padrón declara su rol, recibe su material, evalúa y
envía como cualquiera; lo único que falta es el nombre, y lo completa el
administrador después. El Gherkin admite ambas lecturas —advertir antes o
después—; elegí la que no interrumpe la mesa, que es lo que la feature pide.

**Una evaluación es un checklist enviado, no uno abierto.** La vista
`evaluaciones_enviadas` filtra por `enviada_en is not null`. Un observador que abrió
su checklist y marcó ítems pero no lo envió aparece en la composición de la mesa,
sin la marca de que evaluó, y su corrida se muestra sin evaluaciones asociadas.

**El resultado no se guarda en ningún lado.** Sale de la vista
`resultados_de_evaluacion`, que suma los pesos vigentes de los ítems cumplidos cada
vez que se la consulta. Guardarlo como columna sería más rápido y estaría mal: el
Gherkin pide que cambiar el peso de un ítem cambie también el resultado de las
evaluaciones ya enviadas. La vista parte de los ítems de la plantilla, no de las
respuestas, para que el máximo sea la suma de todos los pesos y un ítem que el
observador nunca tocó cuente como no cumplido en vez de desaparecer del cálculo.

**Un checklist tiene estado, no un `activa` booleano.** `en_construccion` mientras
el administrador lo carga, `disponible` cuando lo da por terminado, `reemplazada`
cuando otro checklist de la operación lo sustituye. Un booleano no alcanzaba para
distinguir «a medio cargar» de «vigente». Un trigger impide asociar a un escenario
un checklist que todavía no está disponible, y `dar_por_terminado_el_checklist()`
hace de una sola vez el reemplazo del de la operación —que es único por definición—
sin dejar a las mesas sin checklist en el medio.

**Sin ponderar, todos los criterios pesan 1 en la base, no sólo en el cálculo.** Un
trigger fuerza `peso = 1` en cualquier ítem de un checklist sin ponderar, y otro
iguala los pesos existentes cuando el administrador deja de ponderarlo. Así el
máximo alcanzable sigue siendo la suma de los pesos en todos los casos, sin que cada
consulta tenga que acordarse de la excepción.

**El facilitador evalúa la técnica, pero no es un rol observador.** Cambio de
requerimiento posterior: además de la planificación que ya recibía, completa y envía
el mismo checklist de la técnica que su observador. El de la operación no le
corresponde. Todo el cambio cabe en una línea de
`plantilla_de_la_participacion()` —el `case` del rol— porque el resto del sistema
nunca filtró por rol: el trigger que valida la instancia y la función que la abre
consultan esa misma función, y las vistas de evaluaciones enviadas y sin enviar
salen de un join con `roles`, no de una lista de roles permitidos.

Lo que **no** se tocó es `roles.observador`. Ese flag decide de qué rol puede ser
una plantilla, y el facilitador no tiene una propia: usa prestada la del escenario.
Marcarlo como observador habilitaría a crear «checklists del facilitador», que es
justo lo que no se pidió. Por eso en la app conviven `esObservador()` y
`llevaChecklist()`: la segunda incluye al facilitador, la primera no.

**Qué checklist le toca a cada rol se define una sola vez, en la base.**
`plantilla_de_la_participacion()` resuelve el checklist común para el observador de
la operación, y el del escenario para el de la técnica y el facilitador; devuelve
null para los roles que sólo practican. La usan el trigger que valida la instancia y la función que
la abre, así que la app no puede abrir un checklist que no corresponda ni aunque
quisiera. `abrir_instancia_de_checklist()` es idempotente: el observador entra y
sale sin que se le abra uno nuevo.

**El envío es irreversible, y no depende de que la UI se porte bien.** Dos triggers
lo sostienen: uno impide modificar `enviada_en` una vez puesto, otro rechaza
cualquier alta, baja o cambio de respuestas sobre una instancia enviada. Verificado
mandando POST directo a las acciones con el checklist ya enviado: 409 en ambas.

**Un rol por participante y por corrida, pero varios en el mismo rol.**
`unique (corrida_id, dni)` impide que alguien ocupe dos roles a la vez; nada impide
que dos personas sean observadores de la técnica en la misma corrida, que es lo
habitual. Si alguien vuelve a escanear el QR con su mismo DNI, el sistema lo lleva
al registro que ya tiene en lugar de duplicarlo.

**El material sale del rol, no de una copia.** La pantalla del participante resuelve
qué mostrar según `rol_codigo`: el checklist de la operación se busca por rol
(es único y común), el de la técnica sale del escenario de la mesa, y la
planificación también. Nada se copia al identificarse, así que un cambio en el
escenario se ve en el acto.

**Habilitar una corrida es un solo movimiento.** Cerrar la que está en curso y
abrir la siguiente pasan dentro de `habilitar_siguiente_corrida()`, una función de
base, no dos llamadas seguidas desde la app: si quedara a medias, la mesa se
quedaría sin corrida habilitada en plena práctica. La función toma un `for update`
sobre la mesa, así dos líderes que habiliten a la vez se serializan en lugar de
calcular el mismo número y chocar. Un índice único parcial sobre `corridas(mesa_id)
where habilitada` sostiene la regla aunque alguien escriba por fuera.

**La mesa no guarda copia del material.** Guarda `escenario_id` y lee de ahí la
planificación y el checklist de la técnica. Si el administrador cambia el material
del escenario, las mesas que lo practican lo ven cambiado — que es lo que quiere
decir «hereda».


**Los roles son fijos.** Los define el modelo MESAS, no el usuario, así que se
cargan en la migración y no en el seed: `observador_operacion`,
`observador_tecnica`, `facilitador`, `operador`, `asistente`. Los dos primeros
tienen `observador = true` y son los únicos de los que puede *ser* un checklist —
lo sostiene un trigger, no la UI—. Quién *completa* uno es otra cosa: ahí también
entra el facilitador, con el de la técnica prestado del escenario.

**Un solo checklist de operación vigente.** Un índice único parcial sobre
`rol_codigo` filtrado por `activa and rol_codigo = 'observador_operacion'`
garantiza que sea uno solo. Los de técnica no tienen ese límite: hay uno por
escenario. Por eso los checklists referencian el rol por su código y no por su id.

**La planificación se guarda entera o no se guarda.** Un CHECK exige que las cinco
columnas `planificacion_*` estén todas en null o todas cargadas, para que no quede
un registro apuntando a un archivo que no existe.

**Ninguna tabla se expone al navegador.** Todas tienen RLS activo y ninguna
política, lo que las deja inaccesibles para las claves publicables. Todo el acceso
pasa por los endpoints de servidor de SvelteKit con la `service_role` key, que
nunca sale del servidor. El bucket `planificaciones` es privado por el mismo motivo.

## Estructura

```
src/
  app.css                 sistema visual completo: tokens y componentes
  lib/
    Icono.svelte          icono SVG inline
    iconos.ts             los ~28 trazos que la app usa
    BarraSuperior.svelte  barra fija con contexto (mesa · corrida · rol)
    roles.ts              icono y descripción de cada rol
    database.types.ts     tipos generados desde la base (regenerar tras migrar)
    planificacion.ts      formatos y tamaños aceptados
    tipos.ts              tipos de dominio
    server/supabase.ts    cliente de servidor (service_role)
    server/sesion.ts      clave y cookie firmada de administración
  hooks.server.ts         guardián: /admin pide sesión
  routes/
    +page.svelte                                  bienvenida: por dónde entra cada quien
    ingresar/                                     clave de administración
    salir/                                        cierre de sesión (POST)
    participar/                                   lector de QR y entrada por número de mesa
    admin/checklists/                             alta y listado de checklists
    admin/checklists/[id]/                        criterios, ponderación y cierre
    admin/padron/                                 padrón y DNI sin resolver
    admin/mesas/                                  consulta de mesas
    admin/mesas/[numero]/                         corridas y quién ocupó cada rol
    admin/mesas/[numero]/corridas/[corrida]/      evaluaciones de esa corrida
    admin/escenarios/                             alta y listado de escenarios
    admin/escenarios/[id]/                        checklist de técnica y planificación
    admin/escenarios/[id]/planificacion/          descarga del archivo
    mesas/                                        alta y listado de mesas
    mesas/[numero]/                               material heredado y habilitación de corridas
    mesas/[numero]/cartel/                        el QR grande, para proyectar o imprimir
    mesas/[numero]/planificacion/                 la misma, por la ruta de la mesa
    m/[numero]/                                   identificación del participante (destino del QR)
    m/[numero]/qr/                                SVG del código QR de la mesa
    m/[numero]/planificacion/                     la planificación, para el facilitador
    m/[numero]/participacion/[id]/                material, checklist y resultado
    m/[numero]/consulta/                          devolución a quien practicó la técnica
    favicon.ico/                                  redirige al icono real
supabase/
  migrations/             historial completo, incluida la baja del modelo anterior
  seed.sql                datos de prueba
```

## Pendiente

- **`/mesas` no pide credenciales.** Cualquiera que llegue puede crear una mesa o
  habilitar corridas. Es deliberado —el líder no tiene por qué recordar una clave
  en medio de la práctica— pero conviene revisarlo si el sistema se usa fuera del
  aula.
- **La clave de administración es una sola y compartida.** No hay usuarios ni
  registro de quién hizo qué en la administración. Alcanza para un evento; no para
  auditar.
- **Nada limita los intentos de clave.** Un ataque por fuerza bruta contra
  `/ingresar` no encuentra freno más que la latencia de la red.
- **Cambiar de rol dentro de una corrida no es posible.** Quien se equivoca al
  elegir vuelve siempre a su registro original. El Gherkin no lo contempla, así que
  no inventé un flujo; si en la práctica pasa seguido, hay que resolverlo.
- **Los criterios siguen siendo editables después de terminado el checklist.** Es
  a propósito: la feature «Resultado de una evaluación» pide que un cambio de peso
  se refleje en las evaluaciones ya enviadas. Pero agregar o quitar criterios de un
  checklist ya usado también corre su máximo alcanzable, y eso el Gherkin no lo
  define.
- Reconocimiento del participante contra el padrón.
- Resultado de la evaluación, consulta de mesa y acceso del operador a su corrida.

## Historia

La primera versión implementaba **evaluación entre pares**: cada participante
evaluaba a otro y el checklist salía del rol del evaluado. El requerimiento cambió:
los observadores evalúan **el desarrollo de la corrida**, no a una persona. La
migración `baja_modelo_evaluacion_entre_pares` da de baja `asignaciones`,
`checklist_instancias`, `checklist_respuestas` y la vista `asignaciones_detalle`.
