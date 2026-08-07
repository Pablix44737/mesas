-- Que checklist le corresponde a una participacion: el comun para el observador
-- de la operacion, el del escenario de su mesa para el de la tecnica, ninguno
-- para los demas roles. Una sola definicion, usada por el trigger y por la app.
create or replace function public.plantilla_de_la_participacion(p_participacion_id uuid)
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when pa.rol_codigo = 'observador_operacion' then (
      select p.id from public.checklist_plantillas p
       where p.rol_codigo = 'observador_operacion' and p.activa
    )
    when pa.rol_codigo = 'observador_tecnica' then e.checklist_tecnica_id
    else null
  end
  from public.participaciones pa
  join public.corridas c   on c.id = pa.corrida_id
  join public.mesas m      on m.id = c.mesa_id
  join public.escenarios e on e.id = m.escenario_id
  where pa.id = p_participacion_id;
$$;

-- Checklist que un observador completa durante una corrida.
create table public.checklist_instancias (
  id uuid primary key default gen_random_uuid(),
  participacion_id uuid not null unique references public.participaciones(id) on delete cascade,
  plantilla_id uuid not null references public.checklist_plantillas(id),
  enviada_en timestamptz,
  creada_en timestamptz not null default now()
);

create table public.checklist_respuestas (
  id uuid primary key default gen_random_uuid(),
  instancia_id uuid not null references public.checklist_instancias(id) on delete cascade,
  item_id uuid not null references public.checklist_items(id),
  cumplido boolean not null default false,
  marcada_en timestamptz not null default now(),
  unique (instancia_id, item_id)
);

create index checklist_respuestas_instancia_idx on public.checklist_respuestas (instancia_id);

-- La instancia solo se abre con el checklist que ese rol debe completar.
create or replace function public.validar_instancia_de_checklist()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.plantilla_id is distinct from public.plantilla_de_la_participacion(new.participacion_id) then
    raise exception 'Ese no es el checklist que le corresponde a ese rol en esa mesa'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger checklist_instancias_coherente
  before insert or update of participacion_id, plantilla_id on public.checklist_instancias
  for each row execute function public.validar_instancia_de_checklist();

-- El envio cierra la evaluacion: una instancia enviada no vuelve a abrirse.
create or replace function public.impedir_reapertura_de_envio()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.enviada_en is not null and new.enviada_en is distinct from old.enviada_en then
    raise exception 'El checklist ya fue enviado: el envio no puede modificarse'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger checklist_instancias_envio_inmutable
  before update on public.checklist_instancias
  for each row execute function public.impedir_reapertura_de_envio();

-- Las marcas solo se registran mientras el checklist no fue enviado.
create or replace function public.impedir_cambios_post_envio()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_enviada timestamptz;
begin
  select i.enviada_en into v_enviada
    from public.checklist_instancias i
   where i.id = coalesce(new.instancia_id, old.instancia_id);

  if v_enviada is not null then
    raise exception 'El checklist ya fue enviado y no admite cambios'
      using errcode = 'check_violation';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger checklist_respuestas_bloqueo_post_envio
  before insert or update or delete on public.checklist_respuestas
  for each row execute function public.impedir_cambios_post_envio();

-- Una respuesta solo puede referirse a un item de la plantilla de su instancia.
create or replace function public.validar_item_de_la_plantilla()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1
      from public.checklist_instancias i
      join public.checklist_items it on it.plantilla_id = i.plantilla_id
     where i.id = new.instancia_id
       and it.id = new.item_id
  ) then
    raise exception 'El item no pertenece a la plantilla del checklist'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger checklist_respuestas_item_coherente
  before insert or update on public.checklist_respuestas
  for each row execute function public.validar_item_de_la_plantilla();

-- Abrir la instancia es idempotente: el observador puede entrar y salir del
-- checklist sin que se le abra uno nuevo cada vez.
create or replace function public.abrir_instancia_de_checklist(p_participacion_id uuid)
returns public.checklist_instancias
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_instancia public.checklist_instancias;
  v_plantilla uuid;
begin
  select * into v_instancia from public.checklist_instancias i
   where i.participacion_id = p_participacion_id;
  if found then
    return v_instancia;
  end if;

  v_plantilla := public.plantilla_de_la_participacion(p_participacion_id);
  if v_plantilla is null then
    raise exception 'Ese rol no lleva checklist en esta mesa'
      using errcode = 'check_violation';
  end if;

  insert into public.checklist_instancias (participacion_id, plantilla_id)
  values (p_participacion_id, v_plantilla)
  on conflict (participacion_id) do nothing
  returning * into v_instancia;

  if not found then
    select * into v_instancia from public.checklist_instancias i
     where i.participacion_id = p_participacion_id;
  end if;

  return v_instancia;
end;
$$;

alter table public.checklist_instancias enable row level security;
alter table public.checklist_respuestas enable row level security;
