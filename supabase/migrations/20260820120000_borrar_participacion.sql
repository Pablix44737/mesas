-- Dar de baja el registro de alguien que entro con el rol equivocado.
--
-- Pasa seguido: la persona escanea el QR, elige mal el rol y queda registrada
-- asi. `unique (corrida_id, dni)` impide que se registre de nuevo en la misma
-- corrida, y el sistema la lleva siempre al registro que ya tiene, asi que sin
-- esto no habia forma de corregirlo. Al borrar su participacion, ese DNI vuelve
-- a estar libre en la corrida y la persona puede escanear otra vez y elegir bien.
--
-- Una sola regla, y vive aca: si esa persona YA ENVIO su checklist, no se borra.
-- Un checklist enviado es un registro cerrado del trabajo de alguien; que se
-- pierda por un clic del administrador es peor que el rol mal elegido, que
-- ademas se ve en la pantalla de la corrida y se puede explicar. Mientras no
-- haya envio, lo unico que se pierde son las marcas que hizo con el rol
-- equivocado, que no le sirven a nadie.
--
-- Las instancias de checklist y sus respuestas caen por cascada desde
-- `participaciones`, igual que al borrar una mesa o una corrida.
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

  -- Serializa contra el propio participante: si esta enviando su checklist en
  -- este momento, una de las dos operaciones espera a la otra.
  perform 1 from public.corridas c where c.id = v_corrida for update;

  select i.enviada_en,
         (select count(*) from public.checklist_respuestas cr
           where cr.instancia_id = i.id and cr.cumplido)
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
