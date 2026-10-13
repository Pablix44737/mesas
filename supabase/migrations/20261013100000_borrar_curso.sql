-- Eliminar un curso con todas sus mesas y lo que colgo de ellas.
--
-- `mesas.curso_id` es `on delete restrict` a proposito: borrar un curso no puede
-- llevarse por delante sus mesas sin que alguien lo pida. Esta funcion es ese
-- pedido explicito. Borra primero las mesas —su cascada ya arrastra corridas,
-- participaciones, checklist_instancias y checklist_respuestas, como en
-- `borrar_mesa()`— y recien despues el curso, que para entonces ya no tiene nada
-- que lo restrinja. No se toca el padron ni el material: participantes,
-- escenarios y checklists son de la institucion, no del curso.
--
-- Contar y borrar pasan en la misma transaccion, asi lo que se informa es lo que
-- de verdad se destruyo.
create or replace function public.borrar_curso(p_curso_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_nombre text;
  v_resumen jsonb;
begin
  -- Bloquear el curso frena a quien quiera crearle una mesa nueva mientras tanto:
  -- el alta de una mesa toma un `for key share` sobre su curso.
  select c.nombre into v_nombre
    from public.cursos c
   where c.id = p_curso_id
     for update;

  if not found then
    raise exception 'Ese curso ya no existe' using errcode = 'no_data_found';
  end if;

  -- Y bloquear sus mesas, con el mismo `for update` que toma
  -- `habilitar_siguiente_corrida()`: si un lider esta habilitando una corrida, los
  -- dos se serializan en vez de cruzarse.
  perform 1 from public.mesas m where m.curso_id = p_curso_id for update;

  select jsonb_build_object(
    'nombre', v_nombre,
    'mesas', (
      select count(*) from public.mesas m where m.curso_id = p_curso_id
    ),
    'corridas', (
      select count(*)
        from public.corridas co
        join public.mesas m on m.id = co.mesa_id
       where m.curso_id = p_curso_id
    ),
    'participaciones', (
      select count(*)
        from public.participaciones pa
        join public.corridas co on co.id = pa.corrida_id
        join public.mesas m on m.id = co.mesa_id
       where m.curso_id = p_curso_id
    ),
    'enviadas', (
      select count(*)
        from public.checklist_instancias i
        join public.participaciones pa on pa.id = i.participacion_id
        join public.corridas co on co.id = pa.corrida_id
        join public.mesas m on m.id = co.mesa_id
       where m.curso_id = p_curso_id
         and i.enviada_en is not null
    )
  ) into v_resumen;

  delete from public.mesas where curso_id = p_curso_id;
  delete from public.cursos where id = p_curso_id;

  return v_resumen;
end;
$$;
