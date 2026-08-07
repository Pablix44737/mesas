-- Los roles son fijos: los define el modelo MESAS, no el usuario.
insert into public.roles (codigo, nombre, observador, orden) values
  ('observador_operacion', 'Observador de la operacion', true,  1),
  ('observador_tecnica',   'Observador de la tecnica',   true,  2),
  ('facilitador',          'Facilitador',                false, 3),
  ('operador',             'Operador',                   false, 4),
  ('asistente',            'Asistente',                  false, 5);

-- Plantilla de checklist asociada a un rol observador.
-- Se referencia el rol por su codigo: es estable y hace legibles las consultas.
create table public.checklist_plantillas (
  id uuid primary key default gen_random_uuid(),
  rol_codigo text not null references public.roles(codigo),
  nombre text not null,
  ponderado boolean not null default false,
  activa boolean not null default true,
  creada_en timestamptz not null default now()
);

-- El checklist de la operacion es comun a todos los escenarios: hay uno solo vigente.
create unique index checklist_plantillas_operacion_unica
  on public.checklist_plantillas (rol_codigo)
  where activa and rol_codigo = 'observador_operacion';

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  plantilla_id uuid not null references public.checklist_plantillas(id) on delete cascade,
  orden integer not null,
  texto text not null,
  peso numeric(6,2) not null default 1 check (peso >= 0),
  unique (plantilla_id, orden)
);

create index checklist_items_plantilla_idx on public.checklist_items (plantilla_id, orden);

-- Solo los roles observadores llevan checklist.
create or replace function public.validar_plantilla_de_rol_observador()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.roles r where r.codigo = new.rol_codigo and r.observador
  ) then
    raise exception 'El rol % no es un rol observador: no lleva checklist', new.rol_codigo
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger checklist_plantillas_rol_observador
  before insert or update of rol_codigo on public.checklist_plantillas
  for each row execute function public.validar_plantilla_de_rol_observador();

-- Escenario: la tecnica a practicar, su planificacion y el checklist con que se la evalua.
-- La planificacion se guarda en el bucket privado `planificaciones`.
create table public.escenarios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  checklist_tecnica_id uuid references public.checklist_plantillas(id),
  planificacion_ruta text unique,
  planificacion_archivo text,
  planificacion_tipo text,
  planificacion_tamano bigint check (planificacion_tamano > 0),
  planificacion_subida_en timestamptz,
  disponible boolean not null default true,
  creado_en timestamptz not null default now(),
  constraint escenarios_planificacion_coherente check (
    (planificacion_ruta is null and planificacion_archivo is null
      and planificacion_tipo is null and planificacion_tamano is null
      and planificacion_subida_en is null)
    or
    (planificacion_ruta is not null and planificacion_archivo is not null
      and planificacion_tipo is not null and planificacion_tamano is not null
      and planificacion_subida_en is not null)
  )
);

-- El checklist que se asocia a un escenario es el del observador de la tecnica.
create or replace function public.validar_checklist_de_tecnica()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rol text;
begin
  if new.checklist_tecnica_id is null then
    return new;
  end if;

  select p.rol_codigo into v_rol
    from public.checklist_plantillas p where p.id = new.checklist_tecnica_id;

  if v_rol is distinct from 'observador_tecnica' then
    raise exception 'Un escenario solo admite un checklist del observador de la tecnica'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger escenarios_checklist_de_tecnica
  before insert or update of checklist_tecnica_id on public.escenarios
  for each row execute function public.validar_checklist_de_tecnica();

-- Las mesas se crean sobre un escenario disponible.
alter table public.mesas add column escenario_id uuid not null references public.escenarios(id);
create index mesas_escenario_idx on public.mesas (escenario_id);

alter table public.checklist_plantillas enable row level security;
alter table public.checklist_items      enable row level security;
alter table public.escenarios           enable row level security;
