-- Cuando dos observadores miraron el mismo ciclo con el mismo checklist,
-- ¿marcaron lo mismo?
--
-- Es la unica medida del sistema que no habla de los participantes sino del
-- instrumento. Un criterio en el que dos personas que vieron exactamente la
-- misma practica marcan distinto no esta midiendo la practica: o esta mal
-- redactado, o los observadores no estan calibrados. Las dos cosas se arreglan
-- antes de la proxima corrida, no despues.
--
-- El grano es el par: dos instancias enviadas de la misma plantilla en el mismo
-- ciclo. Si hubo tres observadores salen tres pares, que es lo correcto —cada
-- uno es una comparacion independiente— aunque haga que un ciclo pese mas.
--
-- Solo lo enviado, como en `criterios_evaluados`, y con la ventaja de que toda
-- instancia enviada tiene respondidos todos sus items: no hay que decidir que
-- hacer con un criterio que uno contesto y el otro no.
--
-- Una advertencia para leerla: esto es coincidencia cruda, sin corregir por
-- azar. En un criterio que casi siempre se cumple, dos observadores coinciden
-- de taquito. Eso infla la coincidencia, nunca la discrepancia, asi que la
-- pantalla ordena por discrepancia: lo que aparece arriba es real.
create or replace view public.concordancia_entre_observadores
with (security_invoker = true) as
with enviadas as (
  select i.id, i.plantilla_id, p.corrida_id, m.escenario_id, cu.tenant_id
  from public.checklist_instancias i
  join public.participaciones p on p.id = i.participacion_id
  join public.corridas co       on co.id = p.corrida_id
  join public.mesas m           on m.id = co.mesa_id
  join public.cursos cu         on cu.id = m.curso_id
  where i.enviada_en is not null
),
-- `a.id < b.id` arma cada par una sola vez y nunca contra si mismo.
pares as (
  select a.id as instancia_a, b.id as instancia_b,
         a.plantilla_id, a.corrida_id, a.escenario_id, a.tenant_id
  from enviadas a
  join enviadas b
    on b.corrida_id = a.corrida_id
   and b.plantilla_id = a.plantilla_id
   and b.id > a.id
),
comparados as (
  select pr.tenant_id, pr.escenario_id, pr.plantilla_id,
         ra.item_id,
         (ra.cumplido = rb.cumplido) as coinciden
  from pares pr
  join public.checklist_respuestas ra on ra.instancia_id = pr.instancia_a
  join public.checklist_respuestas rb on rb.instancia_id = pr.instancia_b
                                     and rb.item_id = ra.item_id
)
select
  c.tenant_id,
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
join public.escenarios e            on e.id = c.escenario_id
join public.checklist_items it      on it.id = c.item_id
join public.checklist_plantillas cp on cp.id = c.plantilla_id
join public.roles ro                on ro.codigo = cp.rol_codigo
group by c.tenant_id, c.escenario_id, e.nombre, c.plantilla_id, cp.nombre,
         cp.rol_codigo, ro.nombre, it.id, it.orden, it.texto;

comment on view public.concordancia_entre_observadores is
  'Por criterio y escenario, en cuantos pares de observadores del mismo ciclo se '
  'marco distinto. Mide el instrumento, no a los participantes. Coincidencia '
  'cruda, sin corregir por azar: por eso se lee por discrepancia.';
