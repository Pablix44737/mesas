-- La lista de cotejo distingue «Hizo» de «No hizo». Hasta ahora solo se marcaba
-- lo que se hizo, y un item sin marcar no decia si no se hizo o si el observador
-- se olvido de marcarlo. Desde ahora cada respuesta guardada es una decision:
-- `cumplido = true` es «Hizo», `false` es «No hizo», y un item sin fila esta sin
-- marcar. Un checklist no se envia con items sin marcar.

-- Las evaluaciones ya enviadas: lo que el observador dejo sin marcar pasa a «No
-- hizo», porque al enviar dio la lista por terminada. El resultado no cambia: el
-- calculo ya contaba esos items como no cumplidos. El bloqueo de cambios
-- posteriores al envio se suspende solo para esta correccion.
alter table public.checklist_respuestas disable trigger checklist_respuestas_bloqueo_post_envio;

insert into public.checklist_respuestas (instancia_id, item_id, cumplido, marcada_en)
select i.id, it.id, false, i.enviada_en
  from public.checklist_instancias i
  join public.checklist_items it on it.plantilla_id = i.plantilla_id
 where i.enviada_en is not null
on conflict (instancia_id, item_id) do nothing;

alter table public.checklist_respuestas enable trigger checklist_respuestas_bloqueo_post_envio;

-- En un checklist abierto, un `false` venia de desmarcar un item: era «sin
-- marcar», no «No hizo».
delete from public.checklist_respuestas r
 using public.checklist_instancias i
 where i.id = r.instancia_id
   and i.enviada_en is null
   and not r.cumplido;

-- Que nunca se guarde un «No hizo» que nadie eligio.
alter table public.checklist_respuestas alter column cumplido drop default;

-- No se envia con items sin marcar.
create or replace function public.exigir_checklist_completo()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_faltan int;
begin
  if old.enviada_en is null and new.enviada_en is not null then
    select count(*) into v_faltan
      from public.checklist_items it
      left join public.checklist_respuestas r
             on r.instancia_id = new.id and r.item_id = it.id
     where it.plantilla_id = new.plantilla_id
       and r.id is null;

    if v_faltan > 0 then
      raise exception 'Faltan % items por marcar', v_faltan
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger checklist_instancias_envio_completo
  before update of enviada_en on public.checklist_instancias
  for each row execute function public.exigir_checklist_completo();

-- Una marca y el envio del mismo checklist se serializan: la marca toma un
-- `for share` sobre la instancia, que espera al envio en curso y despues ve que
-- ya esta enviada. Sin esto, desmarcar un item justo mientras se envia podia
-- dejar una evaluacion enviada con un item sin marcar.
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
   where i.id = coalesce(new.instancia_id, old.instancia_id)
     for share;

  if v_enviada is not null then
    raise exception 'El checklist ya fue enviado y no admite cambios'
      using errcode = 'check_violation';
  end if;

  return coalesce(new, old);
end;
$$;

-- Lo que se lleva marcado de un checklist abierto cuenta las dos respuestas, no
-- solo los «Hizo».
create or replace view public.checklists_sin_enviar
with (security_invoker = true) as
select
  i.id             as instancia_id,
  i.creada_en,
  pa.id            as participacion_id,
  pa.dni,
  pa.participante_id,
  pe.nombre || ' ' || pe.apellido as participante_nombre,
  pa.rol_codigo,
  r.nombre         as rol_nombre,
  c.id             as corrida_id,
  c.numero         as corrida_numero,
  c.habilitada     as corrida_habilitada,
  m.id             as mesa_id,
  m.numero         as mesa_numero,
  p.nombre         as checklist,
  (select count(*) from public.checklist_respuestas cr
    where cr.instancia_id = i.id)                          as marcados,
  (select count(*) from public.checklist_items it
    where it.plantilla_id = i.plantilla_id)                as items
from public.checklist_instancias i
join public.participaciones pa on pa.id = i.participacion_id
join public.corridas c         on c.id  = pa.corrida_id
join public.mesas m            on m.id  = c.mesa_id
join public.roles r            on r.codigo = pa.rol_codigo
join public.checklist_plantillas p on p.id = i.plantilla_id
left join public.participantes pe on pe.id = pa.participante_id
where i.enviada_en is null;

-- Al dar de baja un registro se informan todas las marcas que se pierden.
create or replace function public.borrar_participacion(p_participacion_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_corrida uuid;
  v_dni text;
  v_rol text;
  v_numero int;
  v_enviada timestamptz;
  v_marcas int;
begin
  select pa.corrida_id, pa.dni, r.nombre, c.numero
    into v_corrida, v_dni, v_rol, v_numero
    from public.participaciones pa
    join public.corridas c on c.id = pa.corrida_id
    join public.roles r    on r.codigo = pa.rol_codigo
   where pa.id = p_participacion_id;

  if not found then
    raise exception 'Ese registro ya no existe' using errcode = 'no_data_found';
  end if;

  perform 1 from public.corridas c where c.id = v_corrida for update;

  select i.enviada_en,
         (select count(*) from public.checklist_respuestas cr
           where cr.instancia_id = i.id)
    into v_enviada, v_marcas
    from public.checklist_instancias i
   where i.participacion_id = p_participacion_id;

  if v_enviada is not null then
    raise exception 'Esa persona ya envio su checklist'
      using errcode = 'check_violation';
  end if;

  delete from public.participaciones where id = p_participacion_id;

  return jsonb_build_object(
    'dni', v_dni,
    'rol', v_rol,
    'corrida', v_numero,
    'marcas', coalesce(v_marcas, 0)
  );
end;
$$;
