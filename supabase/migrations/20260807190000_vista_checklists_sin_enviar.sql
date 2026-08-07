-- Checklists abiertos que nadie envio todavia. Al avanzar la corrida, el
-- observador que los dejo a medias pierde el camino de vuelta: el QR lo lleva al
-- formulario de la corrida nueva. Esta vista es para no perderlos de vista.
create view public.checklists_sin_enviar
with (security_invoker = true) as
select
  i.id             as instancia_id,
  i.creada_en,
  pa.id            as participacion_id,
  pa.dni,
  pa.participante_id,
  pe.nombre || ' ' || pe.apellido as participante_nombre,
  pa.rol_codigo,
  r.nombre         as rol_nombre,
  c.id             as corrida_id,
  c.numero         as corrida_numero,
  c.habilitada     as corrida_habilitada,
  m.id             as mesa_id,
  m.numero         as mesa_numero,
  p.nombre         as checklist,
  (select count(*) from public.checklist_respuestas cr
    where cr.instancia_id = i.id and cr.cumplido)          as marcados,
  (select count(*) from public.checklist_items it
    where it.plantilla_id = i.plantilla_id)                as items
from public.checklist_instancias i
join public.participaciones pa on pa.id = i.participacion_id
join public.corridas c         on c.id  = pa.corrida_id
join public.mesas m            on m.id  = c.mesa_id
join public.roles r            on r.codigo = pa.rol_codigo
join public.checklist_plantillas p on p.id = i.plantilla_id
left join public.participantes pe on pe.id = pa.participante_id
where i.enviada_en is null;
