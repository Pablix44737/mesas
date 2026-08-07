-- El resultado nunca se guarda: se calcula contra los pesos vigentes, para que
-- un cambio de ponderacion se refleje tambien en las evaluaciones ya enviadas.
--
-- Se parte de los items de la plantilla y no de las respuestas: asi el maximo es
-- la suma de todos los pesos, y un item que el observador nunca toco cuenta como
-- no cumplido en vez de desaparecer del calculo.
create view public.resultados_de_evaluacion
with (security_invoker = true) as
select
  i.id                as instancia_id,
  i.participacion_id,
  i.plantilla_id,
  i.enviada_en,
  p.nombre            as checklist,
  p.ponderado,
  coalesce(sum(it.peso) filter (where r.cumplido), 0) as resultado,
  coalesce(sum(it.peso), 0)                          as maximo,
  count(*) filter (where r.cumplido)                 as items_cumplidos,
  count(it.id)                                       as items
from public.checklist_instancias i
join public.checklist_plantillas p on p.id = i.plantilla_id
left join public.checklist_items it on it.plantilla_id = i.plantilla_id
left join public.checklist_respuestas r
       on r.instancia_id = i.id and r.item_id = it.id
group by i.id, p.id;
