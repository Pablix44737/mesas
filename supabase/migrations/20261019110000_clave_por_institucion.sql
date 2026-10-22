-- Multitenencia, segunda parte: que la sesion sepa de que institucion es.
--
-- Hasta ahora habia una sola clave compartida (CLAVE_ADMIN) para toda la
-- administracion. Con dos universidades eso significa que quien la tenga las
-- administra a las dos, asi que la clave pasa a ser de cada institucion.
--
-- Se guarda hasheada con bcrypt y la comparacion ocurre acá: el hash nunca sale
-- de la base, ni siquiera hacia el servidor de la aplicacion.
alter table public.tenants add column clave_hash text;

comment on column public.tenants.clave_hash is
  'Hash bcrypt de la clave de administracion de esta institucion. Nulo mientras '
  'todavia no se fijo: en ese caso el ingreso acepta por unica vez la CLAVE_ADMIN '
  'del entorno y la adopta, para que el sistema en marcha no quede afuera.';

-- Verifica sin revelar nada: devuelve true, false, o null si todavia no hay
-- clave fijada —que es lo que le dice a la aplicacion que use la de transicion—.
create or replace function public.verificar_clave_del_tenant(p_tenant_id uuid, p_clave text)
returns boolean
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_hash text;
begin
  select clave_hash into v_hash from public.tenants where id = p_tenant_id;

  if not found then
    raise exception 'Esa institucion no existe' using errcode = 'no_data_found';
  end if;

  if v_hash is null then
    return null;
  end if;

  return v_hash = extensions.crypt(p_clave, v_hash);
end;
$$;

create or replace function public.fijar_clave_del_tenant(p_tenant_id uuid, p_clave text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if length(coalesce(p_clave, '')) < 8 then
    raise exception 'La clave tiene que tener al menos 8 caracteres'
      using errcode = 'check_violation';
  end if;

  update public.tenants
     set clave_hash = extensions.crypt(p_clave, extensions.gen_salt('bf'))
   where id = p_tenant_id;

  if not found then
    raise exception 'Esa institucion no existe' using errcode = 'no_data_found';
  end if;
end;
$$;
