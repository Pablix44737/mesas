-- Eliminar una mesa con todo lo que colgo de ella.
--
-- La cascada ya estaba puesta desde el esquema base:
--   mesas -> corridas -> participaciones -> checklist_instancias -> checklist_respuestas
-- Un `delete from mesas` arrastra las cuatro tablas y no deja nada suelto. Lo que
-- NO se toca es el padron ni el material: los participantes, el escenario y los
-- checklists existen con independencia de la mesa que los uso.
--
-- Podria sorprender que la cascada no choque contra
-- `checklist_respuestas_bloqueo_post_envio`, que impide tocar las respuestas de un
-- checklist ya enviado. No choca porque el borrado en cascada corre como trigger
-- AFTER sobre la tabla padre: cuando le toca el turno a las respuestas, la fila de
-- `checklist_instancias` ya no esta, el guardia busca su `enviada_en` y no encuentra
-- nada que proteger. Es comportamiento definido de Postgres, no suerte, pero
-- conviene decirlo porque leyendo el trigger solo se supondria lo contrario.
--
-- La funcion existe para que contar y borrar pasen en la misma transaccion: lo que
-- se le informa al administrador es lo que realmente se destruyo, y no una foto
-- sacada al dibujar la pantalla de confirmacion.
create or replace function public.borrar_mesa(p_mesa_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_numero int;
  v_resumen jsonb;
begin
  -- El mismo `for update` que toma `habilitar_siguiente_corrida`: si alguien esta
  -- habilitando una corrida en esta mesa, los dos se serializan en vez de cruzarse.
  select m.numero into v_numero
    from public.mesas m
   where m.id = p_mesa_id
     for update;

  if not found then
    raise exception 'Esa mesa ya no existe' using errcode = 'no_data_found';
  end if;

  select jsonb_build_object(
    'numero', v_numero,
    'corridas', (
      select count(*) from public.corridas c where c.mesa_id = p_mesa_id
    ),
    'participaciones', (
      select count(*)
        from public.participaciones pa
        join public.corridas c on c.id = pa.corrida_id
       where c.mesa_id = p_mesa_id
    ),
    'evaluaciones', (
      select count(*)
        from public.checklist_instancias i
        join public.participaciones pa on pa.id = i.participacion_id
        join public.corridas c on c.id = pa.corrida_id
       where c.mesa_id = p_mesa_id
    ),
    'enviadas', (
      select count(*)
        from public.checklist_instancias i
        join public.participaciones pa on pa.id = i.participacion_id
        join public.corridas c on c.id = pa.corrida_id
       where c.mesa_id = p_mesa_id
         and i.enviada_en is not null
    )
  ) into v_resumen;

  delete from public.mesas where id = p_mesa_id;

  return v_resumen;
end;
$$;
