-- Cambio de requerimiento: el facilitador tambien completa la lista de cotejo de
-- la tecnica, ademas de recibir la planificacion que ya tenia. La de la operacion
-- no le corresponde: esa sigue siendo solo del observador de la operacion.
--
-- No se toca `roles.observador`. Ese flag decide de que rol puede ser una
-- plantilla (`checklist_plantillas.rol_codigo`), y el facilitador no tiene
-- plantilla propia: usa la misma del escenario que usa el observador de la
-- tecnica. Marcarlo como observador habilitaria a crear "checklists del
-- facilitador", que es justamente lo que no se pidio.
--
-- Todo lo demas cae solo de esta funcion: el trigger que valida la instancia, la
-- funcion que la abre, y las vistas de evaluaciones enviadas y sin enviar, que
-- nunca filtraron por rol.
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
    when pa.rol_codigo in ('observador_tecnica', 'facilitador') then e.checklist_tecnica_id
    else null
  end
  from public.participaciones pa
  join public.corridas c   on c.id = pa.corrida_id
  join public.mesas m      on m.id = c.mesa_id
  join public.escenarios e on e.id = m.escenario_id
  where pa.id = p_participacion_id;
$$;
