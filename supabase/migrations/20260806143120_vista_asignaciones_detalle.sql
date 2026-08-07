-- Asignacion con las identidades ya resueltas contra el padron.
-- El nombre queda en null cuando el DNI no esta en el padron.
create view public.asignaciones_detalle
with (security_invoker = true) as
select
  a.id,
  a.corrida_id,
  c.numero    as corrida_numero,
  m.id        as mesa_id,
  m.numero    as mesa_numero,
  m.escenario as mesa_escenario,
  a.evaluador_dni,
  a.evaluador_participante_id,
  pe.nombre || ' ' || pe.apellido as evaluador_nombre,
  rer.nombre  as evaluador_rol,
  a.evaluado_dni,
  a.evaluado_participante_id,
  pd.nombre || ' ' || pd.apellido as evaluado_nombre,
  red.id      as evaluado_rol_id,
  red.nombre  as evaluado_rol,
  a.creada_en
from public.asignaciones a
join public.corridas c   on c.id   = a.corrida_id
join public.mesas m      on m.id   = c.mesa_id
join public.roles rer    on rer.id = a.evaluador_rol_id
join public.roles red    on red.id = a.evaluado_rol_id
left join public.participantes pe on pe.id = a.evaluador_participante_id
left join public.participantes pd on pd.id = a.evaluado_participante_id;
