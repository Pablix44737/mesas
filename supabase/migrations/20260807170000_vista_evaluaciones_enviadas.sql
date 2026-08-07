-- Una evaluacion, con quien la hizo, en que rol y con que resultado.
-- Solo las enviadas: un checklist que su observador todavia no envio no es una
-- evaluacion, y la mesa debe mostrarse sin ella.
create view public.evaluaciones_enviadas
with (security_invoker = true) as
select
  i.id                as instancia_id,
  i.enviada_en,
  pa.id               as participacion_id,
  pa.corrida_id,
  c.numero            as corrida_numero,
  m.id                as mesa_id,
  m.numero            as mesa_numero,
  pa.dni              as observador_dni,
  pa.participante_id  as observador_participante_id,
  pe.nombre || ' ' || pe.apellido as observador_nombre,
  pa.rol_codigo,
  r.nombre            as rol_nombre,
  r.orden             as rol_orden,
  p.id                as plantilla_id,
  p.nombre            as checklist,
  p.ponderado,
  v.resultado,
  v.maximo,
  v.items_cumplidos,
  v.items
from public.checklist_instancias i
join public.participaciones pa on pa.id = i.participacion_id
join public.corridas c         on c.id  = pa.corrida_id
join public.mesas m            on m.id  = c.mesa_id
join public.roles r            on r.codigo = pa.rol_codigo
join public.checklist_plantillas p on p.id = i.plantilla_id
join public.resultados_de_evaluacion v on v.instancia_id = i.id
left join public.participantes pe on pe.id = pa.participante_id
where i.enviada_en is not null;
