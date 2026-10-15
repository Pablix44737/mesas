-- La vista es anterior a los cursos, asi que decia «Mesa 1» a secas. Desde que
-- los numeros de mesa vuelven a empezar en cada curso eso ya no identifica nada:
-- hay una mesa 1 por curso. Y sin el codigo del curso tampoco se puede armar el
-- enlace a la mesa, que es lo que convierte el aviso en algo que se puede atender.
--
-- `create or replace` conserva las columnas que ya estaban, en su orden, y suma
-- las nuevas al final: nada de lo que ya la consulta se entera.
create or replace view public.participaciones_sin_resolver
with (security_invoker = true) as
select
  pa.id        as participacion_id,
  pa.dni,
  pa.creada_en,
  pa.rol_codigo,
  r.nombre     as rol_nombre,
  r.orden      as rol_orden,
  c.id         as corrida_id,
  c.numero     as corrida_numero,
  m.id         as mesa_id,
  m.numero     as mesa_numero,
  cu.codigo    as curso_codigo,
  cu.nombre    as curso_nombre
from public.participaciones pa
join public.corridas c on c.id = pa.corrida_id
join public.mesas m    on m.id = c.mesa_id
join public.cursos cu  on cu.id = m.curso_id
join public.roles r    on r.codigo = pa.rol_codigo
where pa.participante_id is null;
