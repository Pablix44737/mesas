-- Dar de baja un escenario o un checklist cargados por error.
--
-- Las dos reglas no las invento: ya estaban en el esquema, como claves foraneas
-- sin cascada. Lo que faltaba era preguntarlas antes y decir por que no se puede,
-- en vez de dejar que el borrado explote con un error de integridad.
--
-- Un escenario se borra si NINGUNA mesa lo practica (mesas.escenario_id). Si lo
-- usa alguna, borrarlo dejaria a esas mesas sin material, y con el a sus corridas
-- y evaluaciones colgando de la nada.
--
-- Un checklist se borra si no esta asociado a ningun escenario
-- (escenarios.checklist_tecnica_id) y si NADIE lo abrio nunca
-- (checklist_instancias.plantilla_id). La segunda es la que importa: una
-- instancia es el trabajo de alguien, aunque no lo haya enviado. Sus criterios
-- caen por cascada, que para eso la tienen.
--
-- La planificacion del escenario vive en un bucket, no en la base, asi que la
-- funcion devuelve su ruta para que la app borre el archivo. Si no, quedaria
-- ocupando lugar sin nada que lo referencie.
create or replace function public.borrar_escenario(p_escenario_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_nombre text;
  v_ruta text;
  v_mesas int;
begin
  select e.nombre, e.planificacion_ruta into v_nombre, v_ruta
    from public.escenarios e
   where e.id = p_escenario_id
     for update;

  if not found then
    raise exception 'Ese escenario ya no existe' using errcode = 'no_data_found';
  end if;

  select count(*) into v_mesas from public.mesas m where m.escenario_id = p_escenario_id;

  if v_mesas > 0 then
    raise exception 'El escenario lo practican % mesas', v_mesas
      using errcode = 'check_violation';
  end if;

  delete from public.escenarios where id = p_escenario_id;

  return jsonb_build_object('nombre', v_nombre, 'planificacion_ruta', v_ruta);
end;
$$;

create or replace function public.borrar_checklist(p_plantilla_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_nombre text;
  v_criterios int;
  v_escenarios int;
  v_instancias int;
begin
  select p.nombre into v_nombre
    from public.checklist_plantillas p
   where p.id = p_plantilla_id
     for update;

  if not found then
    raise exception 'Ese checklist ya no existe' using errcode = 'no_data_found';
  end if;

  select count(*) into v_escenarios
    from public.escenarios e where e.checklist_tecnica_id = p_plantilla_id;

  if v_escenarios > 0 then
    raise exception 'El checklist esta asociado a % escenarios', v_escenarios
      using errcode = 'check_violation';
  end if;

  select count(*) into v_instancias
    from public.checklist_instancias i where i.plantilla_id = p_plantilla_id;

  if v_instancias > 0 then
    raise exception 'El checklist se uso en % evaluaciones', v_instancias
      using errcode = 'check_violation';
  end if;

  select count(*) into v_criterios
    from public.checklist_items it where it.plantilla_id = p_plantilla_id;

  -- Los criterios caen por cascada desde la plantilla.
  delete from public.checklist_plantillas where id = p_plantilla_id;

  return jsonb_build_object('nombre', v_nombre, 'criterios', v_criterios);
end;
$$;
