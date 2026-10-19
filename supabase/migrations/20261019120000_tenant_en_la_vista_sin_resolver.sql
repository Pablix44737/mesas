-- La vista ya traia el curso; ahora tambien la institucion, que es por donde la
-- pantalla del padron tiene que filtrar. Es el primer caso del criterio que
-- fijamos al meter `tenant_id`: en las tablas va solo donde no se deduce de nada
-- —para no romper la tercera forma normal—, y plano en las vistas, que no son
-- relaciones almacenadas y por lo tanto no normalizan nada.
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
  cu.nombre    as curso_nombre,
  cu.tenant_id
from public.participaciones pa
join public.corridas c on c.id = pa.corrida_id
join public.mesas m    on m.id = c.mesa_id
join public.cursos cu  on cu.id = m.curso_id
join public.roles r    on r.codigo = pa.rol_codigo
where pa.participante_id is null;
