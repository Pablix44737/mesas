-- Como viene cambiando un criterio.
--
-- «En el tiempo» en este sistema son dos ejes distintos, y conviene no
-- confundirlos:
--
--   `vuelta` es el numero de ciclo dentro de la mesa. Es el eje pedagogico del
--   modelo MESAS: la misma tecnica se practica varias veces y la pregunta es si
--   la segunda sale mejor que la primera. Ojo con leerlo como mejora individual:
--   los roles rotan, asi que quien opera en la vuelta 3 no es quien opero en la
--   1. Lo que mide es la mesa, no a una persona.
--
--   `dia` es el calendario. Es el eje que contesta «¿la correccion que hicimos
--   funciono?», comparando antes y despues de una intervencion.
--
-- La vista agrupa por los dos a la vez. Sumando sobre `dia` queda la serie por
-- vuelta; sumando sobre `vuelta`, la serie por fecha. Una sola vista, los dos
-- ejes, y ninguno calculado dos veces.
--
-- Se agrupa por la fecha de envio y no por `creada_en` del ciclo: lo que fecha a
-- una evaluacion es cuando se cerro, no cuando se abrio el ciclo donde ocurrio.
create or replace view public.criterios_en_el_tiempo
with (security_invoker = true) as
select
  cu.tenant_id,
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
group by cu.tenant_id, m.escenario_id, it.plantilla_id, it.id, co.numero,
         (i.enviada_en at time zone 'America/Argentina/Buenos_Aires')::date;

comment on view public.criterios_en_el_tiempo is
  'Cada criterio por vuelta de la mesa y por dia de envio, con cuantas veces se '
  'respondio y cuantas no se cumplio. Sumar sobre dia da la serie por vuelta; '
  'sumar sobre vuelta, la serie por fecha.';
