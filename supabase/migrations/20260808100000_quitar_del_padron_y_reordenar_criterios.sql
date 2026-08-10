-- Quitar a alguien del padron no borra su participacion en las mesas: el DNI
-- sigue siendo el dato de base y el registro vuelve a quedar sin identificar,
-- como si nunca hubiera estado cargado. Si se lo vuelve a incorporar, el trigger
-- del padron lo resuelve solo.
alter table public.participaciones
  drop constraint participaciones_participante_id_fkey;

alter table public.participaciones
  add constraint participaciones_participante_id_fkey
  foreign key (participante_id) references public.participantes(id) on delete set null;

-- Mover un criterio dentro de su checklist.
--
-- (plantilla_id, orden) es unico, asi que no se pueden intercambiar dos ordenes
-- de una: el paso por un valor negativo evita la colision. Todo ocurre dentro de
-- la funcion, o sea en una sola transaccion, asi que ese valor intermedio nunca
-- queda a la vista.
create or replace function public.mover_criterio(p_item_id uuid, p_hacia text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_plantilla uuid;
  v_orden integer;
  v_vecino uuid;
  v_orden_vecino integer;
begin
  if p_hacia not in ('arriba', 'abajo') then
    raise exception 'Direccion invalida: %', p_hacia using errcode = 'check_violation';
  end if;

  select i.plantilla_id, i.orden into v_plantilla, v_orden
    from public.checklist_items i where i.id = p_item_id;

  if not found then
    raise exception 'El criterio no existe' using errcode = 'no_data_found';
  end if;

  if p_hacia = 'arriba' then
    select i.id, i.orden into v_vecino, v_orden_vecino
      from public.checklist_items i
     where i.plantilla_id = v_plantilla and i.orden < v_orden
     order by i.orden desc limit 1;
  else
    select i.id, i.orden into v_vecino, v_orden_vecino
      from public.checklist_items i
     where i.plantilla_id = v_plantilla and i.orden > v_orden
     order by i.orden asc limit 1;
  end if;

  -- Ya esta en el borde: mover no hace nada, y no es un error.
  if v_vecino is null then
    return;
  end if;

  update public.checklist_items set orden = -1 where id = p_item_id;
  update public.checklist_items set orden = v_orden where id = v_vecino;
  update public.checklist_items set orden = v_orden_vecino where id = p_item_id;
end;
$$;
