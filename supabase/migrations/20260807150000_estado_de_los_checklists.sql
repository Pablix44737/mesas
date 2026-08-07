-- Un checklist en construccion todavia no se usa. `activa` no alcanzaba para
-- distinguir "a medio cargar" de "vigente", asi que pasa a ser un estado.
alter table public.checklist_plantillas
  add column estado text not null default 'en_construccion'
  check (estado in ('en_construccion', 'disponible', 'reemplazada'));

update public.checklist_plantillas
   set estado = case when activa then 'disponible' else 'reemplazada' end;

drop index public.checklist_plantillas_operacion_unica;
alter table public.checklist_plantillas drop column activa;

-- El checklist de la operacion es comun a todos los escenarios: hay uno solo
-- disponible a la vez. Al dar por terminado uno nuevo, el anterior se reemplaza.
create unique index checklist_plantillas_operacion_unica
  on public.checklist_plantillas (rol_codigo)
  where estado = 'disponible' and rol_codigo = 'observador_operacion';

create index checklist_plantillas_estado_idx on public.checklist_plantillas (estado, rol_codigo);

-- Sin ponderar, todos los items pesan lo mismo. Se sostiene en la base para que
-- el maximo alcanzable siga siendo la suma de los pesos en todos los casos.
create or replace function public.forzar_peso_sin_ponderar()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.checklist_plantillas p
     where p.id = new.plantilla_id and p.ponderado
  ) then
    new.peso := 1;
  end if;
  return new;
end;
$$;

create trigger checklist_items_peso_sin_ponderar
  before insert or update of peso, plantilla_id on public.checklist_items
  for each row execute function public.forzar_peso_sin_ponderar();

create or replace function public.normalizar_pesos_al_despoderar()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.ponderado and not new.ponderado then
    update public.checklist_items set peso = 1 where plantilla_id = new.id;
  end if;
  return new;
end;
$$;

create trigger checklist_plantillas_normalizar_pesos
  after update of ponderado on public.checklist_plantillas
  for each row execute function public.normalizar_pesos_al_despoderar();

-- Solo se usa lo que esta disponible.
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
       where p.rol_codigo = 'observador_operacion' and p.estado = 'disponible'
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

-- A un escenario solo se le asocia un checklist de la tecnica ya terminado.
create or replace function public.validar_checklist_de_tecnica()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rol text;
  v_estado text;
begin
  if new.checklist_tecnica_id is null then
    return new;
  end if;

  select p.rol_codigo, p.estado into v_rol, v_estado
    from public.checklist_plantillas p where p.id = new.checklist_tecnica_id;

  if v_rol is distinct from 'observador_tecnica' then
    raise exception 'Un escenario solo admite un checklist del observador de la tecnica'
      using errcode = 'check_violation';
  end if;

  if v_estado is distinct from 'disponible' then
    raise exception 'Ese checklist todavia no esta disponible para usarse'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- Dar por terminado un checklist: queda disponible y, si es el de la operacion,
-- reemplaza al que estaba vigente. Las dos cosas, de una sola vez.
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

  if v_plantilla.rol_codigo = 'observador_operacion' then
    update public.checklist_plantillas
       set estado = 'reemplazada'
     where rol_codigo = 'observador_operacion'
       and estado = 'disponible'
       and id <> p_plantilla_id;
  end if;

  update public.checklist_plantillas
     set estado = 'disponible'
   where id = p_plantilla_id
  returning * into v_plantilla;

  return v_plantilla;
end;
$$;
