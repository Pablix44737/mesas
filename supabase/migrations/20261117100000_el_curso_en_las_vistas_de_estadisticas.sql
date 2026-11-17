-- El curso en las vistas de estadisticas.
--
-- Hasta ahora se podia mirar un escenario y no una edicion. Son dos preguntas
-- distintas y las dos se hacen: «que le cuesta a la gente en esta tecnica»
-- —mirando el escenario, a traves de todas las cohortes— y «como le fue a este
-- curso» —mirando la edicion, a traves de todas sus tecnicas—.
--
-- Las tres vistas ya pasaban por `cursos` para sacar el tenant, asi que el curso
-- estaba ahi y no se exponia. Agregarlo al grano no cambia ningun numero: la
-- pantalla vuelve a sumar por criterio, y sumar primero por curso y despues por
-- criterio da lo mismo que sumar de una. Lo que habilita es poder filtrar antes
-- de esa suma.
--
-- `ciclos_de_la_institucion` ya lo tenia: no se toca.
--
-- Van con `drop` y no con `create or replace` porque el curso entra antes del
-- escenario, y reemplazar una vista solo deja agregar columnas al final. El
-- `drop` sin `cascade` es a proposito: si algo dependiera de estas vistas,
-- preferimos que falle la migracion a enterarnos despues.

drop view if exists public.criterios_evaluados;
drop view if exists public.concordancia_entre_observadores;
drop view if exists public.criterios_en_el_tiempo;

create view public.criterios_evaluados
with (security_invoker = true) as
select
  cu.tenant_id,
  cu.id     as curso_id,
  cu.nombre as curso,
  e.id      as escenario_id,
  e.nombre  as escenario,
  cp.id     as plantilla_id,
  cp.nombre as checklist,
  cp.rol_codigo,
  ro.nombre as rol,
  it.id     as item_id,
  it.orden  as item_orden,
  it.texto  as criterio,
  it.peso   as peso,
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
group by cu.tenant_id, cu.id, cu.nombre, e.id, e.nombre, cp.id, cp.nombre,
         cp.rol_codigo, ro.nombre, it.id, it.orden, it.texto, it.peso;

comment on view public.criterios_evaluados is
  'Cada criterio de cada checklist, por curso y escenario, con cuantas veces se '
  'respondio y cuantas no se cumplio. Solo evaluaciones enviadas. Base de los puntos criticos.';

create view public.concordancia_entre_observadores
with (security_invoker = true) as
with enviadas as (
  select i.id, i.plantilla_id, p.corrida_id, m.escenario_id, cu.id as curso_id, cu.tenant_id
  from public.checklist_instancias i
  join public.participaciones p on p.id = i.participacion_id
  join public.corridas co       on co.id = p.corrida_id
  join public.mesas m           on m.id = co.mesa_id
  join public.cursos cu         on cu.id = m.curso_id
  where i.enviada_en is not null
),
pares as (
  select a.id as instancia_a, b.id as instancia_b,
         a.plantilla_id, a.corrida_id, a.escenario_id, a.curso_id, a.tenant_id
  from enviadas a
  join enviadas b
    on b.corrida_id = a.corrida_id
   and b.plantilla_id = a.plantilla_id
   and b.id > a.id
),
comparados as (
  select pr.tenant_id, pr.curso_id, pr.escenario_id, pr.plantilla_id,
         ra.item_id,
         (ra.cumplido = rb.cumplido) as coinciden
  from pares pr
  join public.checklist_respuestas ra on ra.instancia_id = pr.instancia_a
  join public.checklist_respuestas rb on rb.instancia_id = pr.instancia_b
                                     and rb.item_id = ra.item_id
)
select
  c.tenant_id,
  c.curso_id,
  cu.nombre as curso,
  c.escenario_id,
  e.nombre  as escenario,
  c.plantilla_id,
  cp.nombre as checklist,
  cp.rol_codigo,
  ro.nombre as rol,
  it.id     as item_id,
  it.orden  as item_orden,
  it.texto  as criterio,
  count(*)                               as pares,
  count(*) filter (where not c.coinciden) as discrepan
from comparados c
join public.cursos cu               on cu.id = c.curso_id
join public.escenarios e            on e.id = c.escenario_id
join public.checklist_items it      on it.id = c.item_id
join public.checklist_plantillas cp on cp.id = c.plantilla_id
join public.roles ro                on ro.codigo = cp.rol_codigo
group by c.tenant_id, c.curso_id, cu.nombre, c.escenario_id, e.nombre,
         c.plantilla_id, cp.nombre, cp.rol_codigo, ro.nombre, it.id, it.orden, it.texto;

comment on view public.concordancia_entre_observadores is
  'Por criterio, curso y escenario, en cuantos pares de observadores del mismo '
  'ciclo se marco distinto. Mide el instrumento, no a los participantes. '
  'Coincidencia cruda, sin corregir por azar: por eso se lee por discrepancia.';

create view public.criterios_en_el_tiempo
with (security_invoker = true) as
select
  cu.tenant_id,
  cu.id     as curso_id,
  m.escenario_id,
  it.plantilla_id,
  it.id      as item_id,
  co.numero  as vuelta,
  (i.enviada_en at time zone 'America/Argentina/Buenos_Aires')::date as dia,
  count(*)                               as respondido,
  count(*) filter (where not r.cumplido) as fallos
from public.checklist_respuestas r
join public.checklist_instancias i  on i.id = r.instancia_id
join public.participaciones p       on p.id = i.participacion_id
join public.corridas co             on co.id = p.corrida_id
join public.mesas m                 on m.id = co.mesa_id
join public.cursos cu               on cu.id = m.curso_id
join public.checklist_items it      on it.id = r.item_id
where i.enviada_en is not null
group by cu.tenant_id, cu.id, m.escenario_id, it.plantilla_id, it.id, co.numero,
         (i.enviada_en at time zone 'America/Argentina/Buenos_Aires')::date;

comment on view public.criterios_en_el_tiempo is
  'Cada criterio por curso, vuelta de la mesa y dia de envio, con cuantas veces '
  'se respondio y cuantas no se cumplio. Sumar sobre dia da la serie por vuelta; '
  'sumar sobre vuelta, la serie por fecha.';
