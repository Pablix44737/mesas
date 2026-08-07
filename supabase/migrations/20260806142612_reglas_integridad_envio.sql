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

-- El checklist presentado es el del rol del evaluado.
create or replace function public.validar_plantilla_del_rol_evaluado()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rol_evaluado uuid;
  v_rol_plantilla uuid;
begin
  select a.evaluado_rol_id into v_rol_evaluado
    from public.asignaciones a where a.id = new.asignacion_id;

  select p.rol_id into v_rol_plantilla
    from public.checklist_plantillas p where p.id = new.plantilla_id;

  if v_rol_evaluado is distinct from v_rol_plantilla then
    raise exception 'La plantilla no corresponde al rol del evaluado'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger checklist_instancias_plantilla_coherente
  before insert or update on public.checklist_instancias
  for each row execute function public.validar_plantilla_del_rol_evaluado();

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
