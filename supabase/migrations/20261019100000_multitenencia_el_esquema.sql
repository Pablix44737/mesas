-- Multitenencia, primera parte: el esquema.
--
-- El tenant va SOLO en las cuatro tablas donde no se deduce de ninguna otra:
-- cursos, escenarios, checklist_plantillas y participantes. En las demas ya esta
-- determinado por una clave foranea —una participacion sabe su tenant por
-- corrida → mesa → curso— y repetirlo ahi seria una dependencia transitiva, que
-- es justamente lo que la tercera forma normal no admite. Las estadisticas que
-- vienen despues lo van a necesitar plano: eso se resuelve en las vistas, que no
-- son relaciones almacenadas y por lo tanto no normalizan nada.
--
-- `roles`, `destinatarios` y `roles_por_destinatario` no llevan tenant: son el
-- modelo MESAS, que es el mismo para todas. Si alguna universidad necesitara los
-- suyos, el patron seria tenant_id nulo = comun, no nulo = propio.

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  codigo text not null unique,
  creado_en timestamptz not null default now(),
  constraint tenants_codigo_formato check (codigo ~ '^[a-z0-9][a-z0-9-]{1,23}$')
);

alter table public.tenants enable row level security;

insert into public.tenants (nombre, codigo)
values ('Universidad Nacional de Misiones', 'unam');

-- --------------------------------------------------------------------------
-- La columna, en las cuatro raices.
--
-- Nullable, backfill, y recien ahi not null: el mismo camino que `curso_id` en
-- las mesas y `destinado_a` en los cursos. Sin valor por defecto a proposito —
-- un default haria que una insercion que se olvido del tenant funcionara igual,
-- cayendo siempre en la UNaM, y eso es exactamente el error que no queremos que
-- pase inadvertido.
-- --------------------------------------------------------------------------
alter table public.cursos               add column tenant_id uuid references public.tenants(id) on delete restrict;
alter table public.escenarios           add column tenant_id uuid references public.tenants(id) on delete restrict;
alter table public.checklist_plantillas add column tenant_id uuid references public.tenants(id) on delete restrict;
alter table public.participantes        add column tenant_id uuid references public.tenants(id) on delete restrict;

update public.cursos               set tenant_id = (select id from public.tenants where codigo = 'unam');
update public.escenarios           set tenant_id = (select id from public.tenants where codigo = 'unam');
update public.checklist_plantillas set tenant_id = (select id from public.tenants where codigo = 'unam');
update public.participantes        set tenant_id = (select id from public.tenants where codigo = 'unam');

alter table public.cursos               alter column tenant_id set not null;
alter table public.escenarios           alter column tenant_id set not null;
alter table public.checklist_plantillas alter column tenant_id set not null;
alter table public.participantes        alter column tenant_id set not null;

-- Toda pantalla de lista filtra por tenant: es el indice que mas se va a usar.
create index cursos_tenant_idx               on public.cursos (tenant_id);
create index escenarios_tenant_idx           on public.escenarios (tenant_id);
create index checklist_plantillas_tenant_idx on public.checklist_plantillas (tenant_id);
create index participantes_tenant_idx        on public.participantes (tenant_id);

-- --------------------------------------------------------------------------
-- Las claves unicas que hay que reacotar.
--
-- De las doce que tiene el esquema rompen exactamente cuatro, y son las de estas
-- mismas cuatro tablas: las demas ya estaban acotadas por una clave foranea que
-- pertenece a un tenant —`mesas (curso_id, numero)`, `corridas (mesa_id, numero)`,
-- `participaciones (corrida_id, dni)`— y por eso no necesitan nada.
--
-- `cursos.codigo` queda global a proposito: va en la URL del QR (/m/<codigo>/<n>)
-- y el alta ya numera las colisiones. Meter el tenant en la direccion obligaria a
-- reimprimir todos los carteles para no ganar nada: un slug no es un secreto.
-- --------------------------------------------------------------------------
alter table public.participantes drop constraint participantes_dni_key;
alter table public.participantes add constraint participantes_dni_key unique (tenant_id, dni);

alter table public.cursos drop constraint cursos_nombre_key;
alter table public.cursos add constraint cursos_nombre_key unique (tenant_id, nombre);

alter table public.escenarios drop constraint escenarios_nombre_key;
alter table public.escenarios add constraint escenarios_nombre_key unique (tenant_id, nombre);

-- Sin esto, una sola universidad en todo el sistema podria tener un checklist
-- vigente del observador del facilitador o del proceso. Es la que rompe peor.
drop index public.checklist_plantillas_comun_unica;

create unique index checklist_plantillas_comun_unica
  on public.checklist_plantillas (tenant_id, rol_codigo)
  where estado = 'disponible'
    and rol_codigo in ('observador_operacion', 'observador_proceso');

-- --------------------------------------------------------------------------
-- Que nada de un tenant apunte a algo de otro.
--
-- La clave foranea compuesta clasica exigiria repetir `tenant_id` en `mesas`,
-- que es la desnormalizacion que venimos evitando. Va por trigger, que ademas es
-- como este esquema cuida el resto de sus invariantes.
-- --------------------------------------------------------------------------
create or replace function public.validar_tenant_de_la_mesa()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tenant_curso uuid;
  v_tenant_escenario uuid;
begin
  select tenant_id into v_tenant_curso     from public.cursos     where id = new.curso_id;
  select tenant_id into v_tenant_escenario from public.escenarios where id = new.escenario_id;

  if v_tenant_curso is distinct from v_tenant_escenario then
    raise exception 'El escenario es de otra institucion que el curso de esta mesa'
      using errcode = 'foreign_key_violation';
  end if;

  return new;
end;
$$;

create trigger mesas_tenant_coherente
  before insert or update of curso_id, escenario_id on public.mesas
  for each row execute function public.validar_tenant_de_la_mesa();

create or replace function public.validar_tenant_del_checklist_de_tecnica()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tenant_plantilla uuid;
begin
  if new.checklist_tecnica_id is null then
    return new;
  end if;

  select tenant_id into v_tenant_plantilla
    from public.checklist_plantillas where id = new.checklist_tecnica_id;

  if v_tenant_plantilla is distinct from new.tenant_id then
    raise exception 'Ese checklist es de otra institucion'
      using errcode = 'foreign_key_violation';
  end if;

  return new;
end;
$$;

create trigger escenarios_tenant_del_checklist
  before insert or update of checklist_tecnica_id, tenant_id on public.escenarios
  for each row execute function public.validar_tenant_del_checklist_de_tecnica();

-- --------------------------------------------------------------------------
-- Las cuatro funciones que buscaban en estas tablas sin saber de que tenant.
--
-- Todas funcionan hoy porque hay una sola universidad. Con dos, dos de ellas
-- cortan con error y las otras dos hacen algo peor: eligen cualquier fila y
-- siguen como si nada.
-- --------------------------------------------------------------------------

-- Resolvia el DNI contra el padron entero. Con dos padrones, `select into` se
-- queda con una fila cualquiera: le colgaria a una participacion el nombre de
-- una persona de otra universidad, sin error y sin aviso.
create or replace function public.resolver_identidad_de_participacion()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tenant uuid;
begin
  new.dni := trim(new.dni);

  select cu.tenant_id into v_tenant
    from public.corridas c
    join public.mesas m   on m.id = c.mesa_id
    join public.cursos cu on cu.id = m.curso_id
   where c.id = new.corrida_id;

  select p.id into new.participante_id
    from public.participantes p
   where p.dni = new.dni and p.tenant_id = v_tenant;

  return new;
end;
$$;

-- El checklist comun se buscaba por rol y estado nada mas. Con dos vigentes
-- —uno por universidad— la subconsulta devuelve dos filas y revienta.
create or replace function public.plantilla_de_la_participacion(p_participacion_id uuid)
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select case r.checklist
    when 'comun' then (
      select p.id from public.checklist_plantillas p
       where p.rol_codigo = pa.rol_codigo
         and p.estado = 'disponible'
         and p.tenant_id = cu.tenant_id
    )
    when 'del_escenario' then e.checklist_tecnica_id
    else null
  end
  from public.participaciones pa
  join public.roles r      on r.codigo = pa.rol_codigo
  join public.corridas c   on c.id = pa.corrida_id
  join public.mesas m      on m.id = c.mesa_id
  join public.cursos cu    on cu.id = m.curso_id
  join public.escenarios e on e.id = m.escenario_id
  where pa.id = p_participacion_id;
$$;

-- Al dar por terminado un checklist comun se reemplazaba al vigente de ese rol,
-- en todo el sistema: una universidad le dejaba sin checklist a la otra.
create or replace function public.dar_por_terminado_el_checklist(p_plantilla_id uuid)
returns public.checklist_plantillas
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_plantilla public.checklist_plantillas;
begin
  select * into v_plantilla from public.checklist_plantillas p where p.id = p_plantilla_id
   for update;

  if not found then
    raise exception 'El checklist no existe' using errcode = 'no_data_found';
  end if;

  if v_plantilla.estado = 'disponible' then
    return v_plantilla;
  end if;

  if not exists (select 1 from public.checklist_items i where i.plantilla_id = p_plantilla_id) then
    raise exception 'Un checklist sin criterios no puede darse por terminado'
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from public.roles r
     where r.codigo = v_plantilla.rol_codigo and r.checklist = 'comun'
  ) then
    update public.checklist_plantillas
       set estado = 'reemplazada'
     where rol_codigo = v_plantilla.rol_codigo
       and estado = 'disponible'
       and tenant_id = v_plantilla.tenant_id
       and id <> p_plantilla_id;
  end if;

  update public.checklist_plantillas
     set estado = 'disponible'
   where id = p_plantilla_id
  returning * into v_plantilla;

  return v_plantilla;
end;
$$;

-- Buscaba el nombre del docente en el padron entero: misma subconsulta de dos
-- filas, mismo error.
create or replace function public.asignar_docente_a_la_mesa(p_mesa_id uuid, p_dni text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_dni text := trim(coalesce(p_dni, ''));
  v_destinatario text;
  v_tenant uuid;
  v_corrida public.corridas;
  v_rol_previo text;
  v_abrio boolean := false;
begin
  perform 1 from public.mesas m where m.id = p_mesa_id for update;

  if not found then
    raise exception 'La mesa no existe' using errcode = 'no_data_found';
  end if;

  if v_dni = '' then
    raise exception 'Falta el documento del docente' using errcode = 'check_violation';
  end if;

  select cu.destinado_a, cu.tenant_id into v_destinatario, v_tenant
    from public.mesas m
    join public.cursos cu on cu.id = m.curso_id
   where m.id = p_mesa_id;

  if v_destinatario <> 'alumnos' then
    raise exception 'En un curso destinado a % el facilitador lo elige cada participante',
      v_destinatario using errcode = 'check_violation';
  end if;

  update public.mesas set docente_dni = v_dni where id = p_mesa_id;

  select * into v_corrida
    from public.corridas c where c.mesa_id = p_mesa_id and c.habilitada;

  if found then
    select p.rol_codigo into v_rol_previo
      from public.participaciones p
     where p.corrida_id = v_corrida.id and p.dni = v_dni;

    if v_rol_previo is not null and v_rol_previo <> 'facilitador' then
      raise exception 'Ese documento ya esta en la corrida % como %',
        v_corrida.numero, v_rol_previo using errcode = 'unique_violation';
    end if;

    if v_rol_previo is null then
      insert into public.participaciones (corrida_id, dni, rol_codigo)
      values (v_corrida.id, v_dni, 'facilitador');
      v_abrio := true;
    end if;
  end if;

  return jsonb_build_object(
    'dni', v_dni,
    'nombre', (select pa.nombre || ' ' || pa.apellido
                 from public.participantes pa
                where pa.dni = v_dni and pa.tenant_id = v_tenant),
    'corrida', v_corrida.numero,
    'abrio_participacion', v_abrio
  );
end;
$$;

-- Las vistas no se tocan todavia. Van a querer el tenant plano para no subir la
-- cadena de claves foraneas en cada consulta de estadistica, y ahi no cuesta
-- nada ni normaliza nada —no son relaciones almacenadas—, pero que columnas
-- hagan falta se sabe recien cuando sepamos que se va a medir.
