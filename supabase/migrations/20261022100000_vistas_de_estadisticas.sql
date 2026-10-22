-- Las dos vistas sobre las que se arman las estadisticas.
--
-- Son vistas y no tablas nuevas: no agregan ningun dato, reagrupan los que ya
-- hay. Es tambien donde el tenant aparece plano —sale de `cursos`, que es quien
-- lo lleva—, que es justo lo que las vistas estan para hacer sin romper la
-- tercera forma normal del esquema almacenado.
--
-- Las dos miran solo lo enviado. Un checklist a medio marcar no es una medicion:
-- sus items sin tocar no son fallos, son cosas que el observador todavia no
-- miro, y contarlos hundiria la tasa de cumplimiento de cualquier escenario.

-- --------------------------------------------------------------------------
-- 1. Cada criterio, con cuantas veces se cumplio y cuantas no.
--
-- El grano es criterio x escenario y no criterio solo: el checklist de la
-- tecnica cuelga del escenario, pero el comun es el mismo para todos, asi que
-- sin el escenario sus criterios mezclarian practicas distintas.
--
-- `peso` se lee de `checklist_items` en el momento de la consulta, no de cuando
-- se evaluo: si alguien lo cambia, cambian hacia atras los puntos perdidos. Es
-- deliberado en el sistema —asi un peso corregido se refleja en lo ya enviado—
-- pero vuelve enganosa cualquier serie de tiempo armada sobre puntos. Por eso la
-- pantalla ordena por tasa de fallo, que no depende del peso, y muestra los
-- puntos al lado como lectura de impacto.
-- --------------------------------------------------------------------------
create or replace view public.criterios_evaluados
with (security_invoker = true) as
select
  cu.tenant_id,
  e.id     as escenario_id,
  e.nombre as escenario,
  cp.id    as plantilla_id,
  cp.nombre as checklist,
  cp.rol_codigo,
  ro.nombre as rol,
  it.id    as item_id,
  it.orden as item_orden,
  it.texto as criterio,
  it.peso  as peso,
  count(*)                               as respondido,
  count(*) filter (where not r.cumplido) as fallos,
  count(distinct co.id)                  as ciclos,
  max(r.marcada_en)                      as ultima_vez
from public.checklist_respuestas r
join public.checklist_instancias i  on i.id = r.instancia_id
join public.participaciones p       on p.id = i.participacion_id
join public.corridas co             on co.id = p.corrida_id
join public.mesas m                 on m.id = co.mesa_id
join public.cursos cu               on cu.id = m.curso_id
join public.escenarios e            on e.id = m.escenario_id
join public.checklist_items it      on it.id = r.item_id
join public.checklist_plantillas cp on cp.id = it.plantilla_id
join public.roles ro                on ro.codigo = cp.rol_codigo
where i.enviada_en is not null
group by cu.tenant_id, e.id, e.nombre, cp.id, cp.nombre, cp.rol_codigo, ro.nombre,
         it.id, it.orden, it.texto, it.peso;

comment on view public.criterios_evaluados is
  'Cada criterio de cada checklist, por escenario, con cuantas veces se respondio '
  'y cuantas no se cumplio. Solo evaluaciones enviadas. Base de los puntos criticos.';

-- --------------------------------------------------------------------------
-- 2. Cada ciclo con su contexto y cuanto se hizo en el.
--
-- Una fila por ciclo, que es la unidad de practica del modelo MESAS: de aca
-- salen el volumen, cuantas veces se repitio cada escenario, cuales no se
-- practicaron nunca y la serie en el tiempo, sin volver a escribir los mismos
-- cuatro joins en cada consulta.
-- --------------------------------------------------------------------------
create or replace view public.ciclos_de_la_institucion
with (security_invoker = true) as
select
  cu.tenant_id,
  cu.id     as curso_id,
  cu.nombre as curso,
  cu.destinado_a,
  cu.archivado,
  m.id      as mesa_id,
  m.numero  as mesa,
  e.id      as escenario_id,
  e.nombre  as escenario,
  co.id     as ciclo_id,
  co.numero as ciclo,
  co.habilitada,
  co.creada_en,
  (select count(*) from public.participaciones p where p.corrida_id = co.id) as personas,
  (select count(*)
     from public.participaciones p
     join public.checklist_instancias i on i.participacion_id = p.id
    where p.corrida_id = co.id and i.enviada_en is not null) as evaluaciones
from public.corridas co
join public.mesas m      on m.id = co.mesa_id
join public.cursos cu    on cu.id = m.curso_id
join public.escenarios e on e.id = m.escenario_id;

comment on view public.ciclos_de_la_institucion is
  'Una fila por ciclo, con su curso, mesa y escenario, cuanta gente lo ocupo y '
  'cuantas evaluaciones se enviaron. Base del panel operativo.';
