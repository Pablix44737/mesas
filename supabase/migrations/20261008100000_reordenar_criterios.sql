-- Reordenar todos los criterios de un checklist de una sola vez.
--
-- `mover_criterio()` intercambia un criterio con su vecino: para llevar el ultimo
-- al primer lugar hacen falta N-1 llamadas, una por flecha. Esta recibe el orden
-- completo y lo aplica entero, asi la pantalla puede reacomodar localmente y
-- guardar una sola vez, sin importar cuanto se haya movido nada.
--
-- El arreglo tiene que ser EXACTAMENTE el conjunto de criterios de la plantilla:
-- ni uno de otra, ni repetidos, ni faltando ninguno. Sin esa comprobacion, un
-- reordenamiento mandado desde una pantalla vieja —a la que alguien le agrego o
-- le quito un criterio mientras tanto— dejaria criterios sin orden o mezclados
-- con los de otro checklist.
create or replace function public.reordenar_criterios(p_plantilla_id uuid, p_items uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cuantos int;
  v_recibidos int;
begin
  select count(*) into v_cuantos
    from public.checklist_items
   where plantilla_id = p_plantilla_id;

  v_recibidos := coalesce(array_length(p_items, 1), 0);

  -- Un checklist sin criterios no tiene nada que reordenar.
  if v_cuantos = 0 and v_recibidos = 0 then
    return;
  end if;

  if v_cuantos <> v_recibidos
     or v_recibidos <> (select count(distinct x) from unnest(p_items) x)
     or exists (
       select 1 from unnest(p_items) x
        where not exists (
          select 1 from public.checklist_items i
           where i.id = x and i.plantilla_id = p_plantilla_id
        )
     )
  then
    raise exception 'La lista de criterios no coincide con la del checklist'
      using errcode = 'check_violation';
  end if;

  -- `(plantilla_id, orden)` es unico, asi que el orden final no se puede asignar
  -- de una sola pasada: dos criterios chocarian a mitad de camino. Se pasa por
  -- negativos, que ningun criterio usa, dentro de la misma transaccion.
  update public.checklist_items
     set orden = -orden
   where plantilla_id = p_plantilla_id;

  update public.checklist_items i
     set orden = n.posicion
    from (
      select x as id, ordinality::int as posicion
        from unnest(p_items) with ordinality as t(x, ordinality)
    ) n
   where i.id = n.id;
end;
$$;
