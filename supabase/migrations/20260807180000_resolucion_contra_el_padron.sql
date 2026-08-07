-- Hasta ahora el DNI se resolvia solo al registrarse la participacion. Si el
-- administrador incorporaba despues a esa persona, el registro quedaba pendiente
-- para siempre. Ahora el padron tambien empuja: al sumarse alguien, se resuelven
-- las participaciones que lo estaban esperando.
create or replace function public.resolver_participaciones_pendientes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Si a esta persona le cambiaron el DNI, los registros que la apuntaban con el
  -- DNI viejo dejan de corresponderle.
  if tg_op = 'UPDATE' and old.dni is distinct from new.dni then
    update public.participaciones
       set participante_id = null
     where participante_id = new.id
       and dni is distinct from new.dni;
  end if;

  update public.participaciones
     set participante_id = new.id
   where dni = new.dni
     and participante_id is distinct from new.id;

  return null;
end;
$$;

create trigger participantes_resolver_pendientes
  after insert or update of dni on public.participantes
  for each row execute function public.resolver_participaciones_pendientes();

-- Los roles ocupados por un DNI que el padron no reconoce.
create view public.participaciones_sin_resolver
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
  m.numero     as mesa_numero
from public.participaciones pa
join public.corridas c on c.id = pa.corrida_id
join public.mesas m    on m.id = c.mesa_id
join public.roles r    on r.codigo = pa.rol_codigo
where pa.participante_id is null;

create index participaciones_dni_idx on public.participaciones (dni);
