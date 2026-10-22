-- Multitenencia, cuarta parte: dar de alta una institucion sin SQL.
--
-- Hasta ahora una institucion nueva se creaba a mano —`insert into tenants` y
-- `fijar_clave_del_tenant`—, en dos pasos y por fuera de la aplicacion. Esta
-- migracion deja el alta en una sola funcion para que no exista el estado
-- intermedio, que no era inocente: una institucion sin clave la abria cualquiera
-- que conociera la clave de transicion, y esa estaba por defecto en el codigo.

-- --------------------------------------------------------------------------
-- La clave deja de poder faltar.
--
-- Era nula mientras una institucion todavia no fijaba la suya, y en ese caso el
-- ingreso aceptaba por unica vez la CLAVE_ADMIN del entorno y la adoptaba. Eso
-- existia para que el sistema en marcha no quedara afuera el dia que las claves
-- pasaron a ser por institucion; la UNaM ya adopto la suya, asi que la
-- transicion termino. Desde ahora toda institucion nace con clave y no hay
-- ningun estado en que una valga para entrar a otra.
-- --------------------------------------------------------------------------
alter table public.tenants alter column clave_hash set not null;

comment on column public.tenants.clave_hash is
  'Hash bcrypt de la clave de administracion de esta institucion. Se fija al '
  'crearla, en la misma transaccion: nunca hay una institucion sin clave.';

-- Sin la rama de transicion ya no hay tercer resultado posible: la clave es
-- correcta o no lo es. Que la institucion no exista sigue siendo una excepcion y
-- no un `false`, porque no es lo mismo y la pantalla lo dice distinto.
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

  return v_hash = extensions.crypt(p_clave, v_hash);
end;
$$;

-- --------------------------------------------------------------------------
-- El alta.
--
-- La fila y el hash de la clave en una sola transaccion. El codigo lo deriva del
-- nombre quien llama —como el de los cursos, numerando colisiones—, pero el
-- formato lo vuelve a exigir el `check` de la tabla: una institucion con un
-- codigo invalido no serviria para nada.
--
-- Los choques se informan uno por uno en vez de dejar salir el 23505 pelado,
-- para que la pantalla pueda decir cual de los dos campos repitio.
-- --------------------------------------------------------------------------
create or replace function public.crear_institucion(
  p_nombre text,
  p_codigo text,
  p_clave text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_nombre text := trim(coalesce(p_nombre, ''));
  v_codigo text := lower(trim(coalesce(p_codigo, '')));
  v_id uuid;
begin
  if length(v_nombre) < 4 then
    raise exception 'El nombre de la institucion es demasiado corto'
      using errcode = 'check_violation';
  end if;

  if length(coalesce(p_clave, '')) < 8 then
    raise exception 'La clave tiene que tener al menos 8 caracteres'
      using errcode = 'check_violation';
  end if;

  -- Sin distinguir mayusculas: dos instituciones que se diferencian solo en eso
  -- son la misma para cualquiera que las lea en un desplegable.
  if exists (select 1 from public.tenants t where lower(t.nombre) = lower(v_nombre)) then
    raise exception 'Ya hay una institucion con ese nombre'
      using errcode = 'unique_violation';
  end if;

  if exists (select 1 from public.tenants t where t.codigo = v_codigo) then
    raise exception 'Ya hay una institucion con ese codigo'
      using errcode = 'unique_violation';
  end if;

  insert into public.tenants (nombre, codigo, clave_hash)
  values (v_nombre, v_codigo, extensions.crypt(p_clave, extensions.gen_salt('bf')))
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'nombre', v_nombre, 'codigo', v_codigo);
end;
$$;

-- --------------------------------------------------------------------------
-- Lo que la pantalla de la plataforma necesita ver.
--
-- Cuanto tiene encima cada institucion, en una consulta. Es el unico lugar donde
-- el tenant se mira desde arriba, asi que los conteos van en una vista y no
-- rearmados en el servidor.
--
-- `clave_hash` no esta a proposito: el hash no sale de la base ni hacia el
-- servidor de la aplicacion. Que una institucion tenga clave ya no es
-- informacion —ahora todas la tienen—, asi que no hay nada que informar de ella.
-- --------------------------------------------------------------------------
create or replace view public.instituciones_resumen
with (security_invoker = true) as
select
  t.id,
  t.nombre,
  t.codigo,
  t.creado_en,
  (select count(*) from public.cursos c where c.tenant_id = t.id) as cursos,
  (select count(*)
     from public.mesas m
     join public.cursos c on c.id = m.curso_id
    where c.tenant_id = t.id) as mesas,
  (select count(*) from public.escenarios e where e.tenant_id = t.id) as escenarios,
  (select count(*) from public.participantes p where p.tenant_id = t.id) as padron
from public.tenants t;

comment on view public.instituciones_resumen is
  'Las instituciones con cuanto trabajo tiene cada una encima. Para la zona de '
  'plataforma, que es la unica que mira por encima de una institucion.';
