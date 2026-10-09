-- En un curso de alumnos el docente hace dos cosas a la vez: conduce la mesa y
-- facilita la simulacion. La planificacion ya la tenia —la pantalla del lider la
-- enlaza desde que existe—, pero le faltaba poder completar y enviar la lista de
-- cotejo de la tecnica, que en un curso de alumnos es la evaluacion que importa:
-- el docente calificando la tecnica del alumno.
--
-- Una evaluacion cuelga de una participacion, y una participacion necesita un
-- documento y una corrida. Asi que el docente se declara una vez por mesa y el
-- sistema le abre su lugar de facilitador en cada corrida que se habilite. No se
-- registra a los docentes aparte: van al mismo padron que el resto, porque
-- `participantes` guarda personas y "docente" es el rol que ocupa, no lo que es.
alter table public.mesas add column docente_dni text;

comment on column public.mesas.docente_dni is
  'Documento de quien conduce la mesa y facilita, solo en cursos de alumnos. '
  'Texto plano y sin clave foranea, igual que participaciones.dni: el padron lo '
  'resuelve si esta cargado y si no la pantalla lo avisa.';

-- --------------------------------------------------------------------------
-- Declarar quien conduce la mesa.
--
-- Deja el documento en la mesa y, si hay una corrida en curso, le abre ahi mismo
-- su lugar de facilitador: sin eso tendria que esperar a la corrida siguiente
-- para poder evaluar.
-- --------------------------------------------------------------------------
create or replace function public.asignar_docente_a_la_mesa(p_mesa_id uuid, p_dni text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_dni text := trim(coalesce(p_dni, ''));
  v_destinatario text;
  v_corrida public.corridas;
  v_rol_previo text;
  v_abrio boolean := false;
begin
  -- Serializa contra un lider que este habilitando la corrida siguiente: los dos
  -- insertan la participacion del facilitador y chocarian en (corrida_id, dni).
  perform 1 from public.mesas m where m.id = p_mesa_id for update;

  if not found then
    raise exception 'La mesa no existe' using errcode = 'no_data_found';
  end if;

  if v_dni = '' then
    raise exception 'Falta el documento del docente' using errcode = 'check_violation';
  end if;

  select cu.destinado_a into v_destinatario
    from public.mesas m
    join public.cursos cu on cu.id = m.curso_id
   where m.id = p_mesa_id;

  if v_destinatario <> 'alumnos' then
    raise exception 'En un curso destinado a % el facilitador lo elige cada participante',
      v_destinatario using errcode = 'check_violation';
  end if;

  update public.mesas set docente_dni = v_dni where id = p_mesa_id;

  select * into v_corrida
    from public.corridas c where c.mesa_id = p_mesa_id and c.habilitada;

  if found then
    -- Si ese documento ya esta en la corrida con otro rol, no se lo pisa: pudo
    -- haber evaluado con el. Lo saca el administrador y recien ahi se reintenta.
    select p.rol_codigo into v_rol_previo
      from public.participaciones p
     where p.corrida_id = v_corrida.id and p.dni = v_dni;

    if v_rol_previo is not null and v_rol_previo <> 'facilitador' then
      raise exception 'Ese documento ya esta en la corrida % como %',
        v_corrida.numero, v_rol_previo using errcode = 'unique_violation';
    end if;

    if v_rol_previo is null then
      insert into public.participaciones (corrida_id, dni, rol_codigo)
      values (v_corrida.id, v_dni, 'facilitador');
      v_abrio := true;
    end if;
  end if;

  return jsonb_build_object(
    'dni', v_dni,
    'nombre', (select pa.nombre || ' ' || pa.apellido
                 from public.participantes pa where pa.dni = v_dni),
    'corrida', v_corrida.numero,
    'abrio_participacion', v_abrio
  );
end;
$$;

-- Dejar la mesa sin docente declarado. No se tocan las participaciones ya
-- abiertas: lo que evaluo quedo hecho. Solo deja de abrirsele lugar en las
-- corridas que vengan.
create or replace function public.quitar_el_docente_de_la_mesa(p_mesa_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.mesas set docente_dni = null
   where id = p_mesa_id and docente_dni is not null;

  return jsonb_build_object('habia_docente', found);
end;
$$;

-- --------------------------------------------------------------------------
-- Al habilitar una corrida, el docente ya tiene su lugar esperandolo.
--
-- Es lo que convierte esto en una herramienta y no en un tramite: declara el
-- documento una vez por mesa, no una por corrida.
-- --------------------------------------------------------------------------
create or replace function public.habilitar_siguiente_corrida(p_mesa_id uuid)
returns public.corridas
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_corrida public.corridas;
begin
  perform 1 from public.mesas m where m.id = p_mesa_id for update;

  if not found then
    raise exception 'La mesa no existe' using errcode = 'no_data_found';
  end if;

  update public.corridas
     set habilitada = false
   where mesa_id = p_mesa_id and habilitada;

  insert into public.corridas (mesa_id, numero, habilitada)
  select p_mesa_id, coalesce(max(c.numero), 0) + 1, true
    from public.corridas c
   where c.mesa_id = p_mesa_id
  returning * into v_corrida;

  insert into public.participaciones (corrida_id, dni, rol_codigo)
  select v_corrida.id, m.docente_dni, 'facilitador'
    from public.mesas m
   where m.id = p_mesa_id and m.docente_dni is not null;

  return v_corrida;
end;
$$;

-- --------------------------------------------------------------------------
-- Corregir a quien esta destinado un curso.
--
-- Solo mientras nadie haya declarado un rol en el. Despues no: el destinatario
-- decide que roles se ocupan, y cambiarlo dejaria participaciones con roles que
-- su propio curso ya no admite. Misma regla con la que se deshace una corrida.
-- --------------------------------------------------------------------------
create or replace function public.cambiar_el_destinatario(p_curso_id uuid, p_destinatario text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_curso public.cursos;
  v_ocupados integer;
begin
  select * into v_curso from public.cursos c where c.id = p_curso_id for update;

  if not found then
    raise exception 'El curso ya no existe' using errcode = 'no_data_found';
  end if;

  if not exists (select 1 from public.destinatarios d where d.codigo = p_destinatario) then
    raise exception 'Ese destinatario no existe' using errcode = 'check_violation';
  end if;

  select count(*) into v_ocupados
    from public.participaciones p
    join public.corridas c on c.id = p.corrida_id
    join public.mesas m    on m.id = c.mesa_id
   where m.curso_id = p_curso_id;

  if v_ocupados > 0 and p_destinatario <> v_curso.destinado_a then
    raise exception 'El curso ya tiene % roles ocupados', v_ocupados
      using errcode = 'check_violation';
  end if;

  update public.cursos set destinado_a = p_destinatario where id = p_curso_id;

  -- Un curso de docentes no tiene docente declarado por mesa: ahi el facilitador
  -- lo elige cada participante desde el QR.
  if p_destinatario <> 'alumnos' then
    update public.mesas set docente_dni = null
     where curso_id = p_curso_id and docente_dni is not null;
  end if;

  return jsonb_build_object('nombre', v_curso.nombre, 'destinado_a', p_destinatario);
end;
$$;
