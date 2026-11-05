-- Entregarle a otra institucion una copia de un curso.
--
-- El caso que lo motiva: la RENaSIC dicta un curso en la Escuela de Enfermeria.
-- Se dicta desde la UNaM, con el padron, los escenarios y los checklists que ya
-- existen ahi, y al terminar la RENaSIC se lleva su copia para consultarla desde
-- su propio acceso. Las dos instituciones quedan con todo.
--
-- Es una copia y no una mudanza. Cambiarle `tenant_id` al curso no alcanzaria
-- —sus mesas apuntan a escenarios de la institucion de origen y el trigger
-- `mesas_tenant_coherente` lo rechazaria— y ademas dejaria sin registro a quien
-- presto la sede.
--
-- Lo que viaja, en una sola transaccion:
--
--   los checklists usados, con sus criterios;
--   los escenarios de las mesas, apuntando a esos checklists;
--   el padron, solo de quienes participaron;
--   el curso con sus mesas, ciclos, participaciones, evaluaciones y respuestas.
--
-- Lo que NO viaja en la funcion es el archivo de planificacion: vive en el
-- bucket y no en la base. La funcion devuelve que archivos habria que copiar y a
-- donde, y de eso se encarga el servidor, que es quien habla con el storage. Si
-- esa segunda parte falla, la copia queda sin planificacion, que es coherente
-- —`escenarios_planificacion_coherente` exige las cinco columnas o ninguna— y no
-- a medias.

-- --------------------------------------------------------------------------
-- Cuando un checklist del destino ya es el mismo
--
-- Si se copian dos cursos que compartian instrumento, el segundo tiene que
-- reusar lo que dejo el primero en vez de duplicarlo. «El mismo» se define por
-- lo que se ve: mismo rol, mismo nombre, misma ponderacion y exactamente los
-- mismos criterios, con su orden, su texto y su peso. Comparar por id seria
-- inutil —la copia tiene ids nuevos— y comparar solo por nombre, peligroso: las
-- respuestas quedarian colgadas de criterios que dicen otra cosa.
-- --------------------------------------------------------------------------
create or replace function public.plantilla_equivalente_en(
  p_plantilla_id uuid,
  p_tenant uuid
)
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select d.id
    from public.checklist_plantillas o
    join public.checklist_plantillas d
      on d.tenant_id = p_tenant
     and d.rol_codigo = o.rol_codigo
     and d.nombre = o.nombre
     and d.ponderado = o.ponderado
   where o.id = p_plantilla_id
     and (select count(*) from public.checklist_items a where a.plantilla_id = o.id)
       = (select count(*) from public.checklist_items b where b.plantilla_id = d.id)
     and not exists (
       select a.orden, a.texto, a.peso from public.checklist_items a where a.plantilla_id = o.id
       except
       select b.orden, b.texto, b.peso from public.checklist_items b where b.plantilla_id = d.id
     )
   limit 1;
$$;

comment on function public.plantilla_equivalente_en(uuid, uuid) is
  'El checklist de esa institucion que es el mismo que este —mismo rol, nombre, '
  'ponderacion y criterios— o null si no lo tiene. Para no duplicar al copiar.';

-- --------------------------------------------------------------------------
-- La copia
-- --------------------------------------------------------------------------
create or replace function public.copiar_curso_a_institucion(
  p_curso_id uuid,
  p_tenant_destino uuid,
  p_con_padron boolean default true
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_curso    public.cursos;
  v_destino  text;
  v_nombre   text;
  v_codigo   text;
  v_base     text;
  v_n        int;
  v_curso_nuevo uuid;
  v_plantilla uuid;
  v_escenario uuid;
  -- Para la fila que se acaba de insertar, sea de la tabla que sea.
  v_id uuid;
  v_dni_del_docente text;
  r record;
begin
  select * into v_curso from public.cursos where id = p_curso_id;
  if not found then
    raise exception 'Ese curso ya no existe' using errcode = 'no_data_found';
  end if;

  select nombre into v_destino from public.tenants where id = p_tenant_destino;
  if not found then
    raise exception 'Esa institucion no existe' using errcode = 'no_data_found';
  end if;

  if v_curso.tenant_id = p_tenant_destino then
    raise exception 'El curso ya es de esa institucion' using errcode = 'check_violation';
  end if;

  -- Los mapas de ids viejo -> nuevo. Son temporales de la transaccion: lo que se
  -- esta copiando no le importa a nadie mas, ni sobrevive a un error.
  create temp table _plantillas (origen uuid primary key, copia uuid not null, nueva boolean not null) on commit drop;
  create temp table _items      (origen uuid primary key, copia uuid not null) on commit drop;
  create temp table _escenarios (origen uuid primary key, copia uuid not null, nuevo boolean not null) on commit drop;
  create temp table _personas   (dni text primary key, copia uuid not null, nueva boolean not null) on commit drop;
  create temp table _mesas      (origen uuid primary key, copia uuid not null) on commit drop;
  create temp table _ciclos     (origen uuid primary key, copia uuid not null) on commit drop;
  create temp table _roles      (origen uuid primary key, copia uuid not null) on commit drop;
  create temp table _instancias (origen uuid primary key, copia uuid not null) on commit drop;
  create temp table _planificaciones (
    escenario uuid primary key, ruta text not null, archivo text not null,
    tipo text not null, tamano bigint not null
  ) on commit drop;

  -- ------------------------------------------------------------------
  -- 1. Los checklists: los de la tecnica de cada escenario y los que de
  --    hecho uso alguna evaluacion, que incluye al comun del destinatario.
  -- ------------------------------------------------------------------
  for r in
    select pl.*
      from public.checklist_plantillas pl
     where pl.id in (
       select e.checklist_tecnica_id
         from public.mesas m
         join public.escenarios e on e.id = m.escenario_id
        where m.curso_id = p_curso_id and e.checklist_tecnica_id is not null
       union
       select i.plantilla_id
         from public.mesas m
         join public.corridas c on c.mesa_id = m.id
         join public.participaciones pa on pa.corrida_id = c.id
         join public.checklist_instancias i on i.participacion_id = pa.id
        where m.curso_id = p_curso_id
     )
  loop
    v_plantilla := public.plantilla_equivalente_en(r.id, p_tenant_destino);

    if v_plantilla is not null then
      -- Ya lo tiene, identico: se reusa y los criterios se emparejan por orden.
      insert into _plantillas values (r.id, v_plantilla, false);
      insert into _items (origen, copia)
      select a.id, b.id
        from public.checklist_items a
        join public.checklist_items b on b.plantilla_id = v_plantilla and b.orden = a.orden
       where a.plantilla_id = r.id;
    else
      /*
       * El comun es el unico que no se puede simplemente agregar.
       * `plantilla_de_la_participacion()` lo resuelve como el `disponible` de la
       * institucion, y hay un solo disponible por rol. Si el destino ya tiene
       * uno distinto, las evaluaciones copiadas tendrian que colgar de el, con
       * criterios que no son los que se marcaron. Antes que eso, no se copia.
       */
      if r.rol_codigo in ('observador_operacion', 'observador_proceso')
         and exists (
           select 1 from public.checklist_plantillas d
            where d.tenant_id = p_tenant_destino
              and d.rol_codigo = r.rol_codigo
              and d.estado = 'disponible'
         ) then
        raise exception
          'La institucion de destino ya tiene su propio checklist comun para ese rol, distinto de este'
          using errcode = 'unique_violation';
      end if;

      insert into public.checklist_plantillas (rol_codigo, nombre, ponderado, estado, tenant_id)
      values (r.rol_codigo, r.nombre, r.ponderado, r.estado, p_tenant_destino)
      returning id into v_plantilla;

      insert into _plantillas values (r.id, v_plantilla, true);

      insert into public.checklist_items (plantilla_id, orden, texto, peso)
      select v_plantilla, a.orden, a.texto, a.peso
        from public.checklist_items a
       where a.plantilla_id = r.id;

      -- El orden es unico dentro de la plantilla, asi que empareja uno a uno.
      insert into _items (origen, copia)
      select a.id, b.id
        from public.checklist_items a
        join public.checklist_items b on b.plantilla_id = v_plantilla and b.orden = a.orden
       where a.plantilla_id = r.id;
    end if;
  end loop;

  -- ------------------------------------------------------------------
  -- 2. Los escenarios de las mesas.
  -- ------------------------------------------------------------------
  for r in
    select distinct e.*
      from public.mesas m
      join public.escenarios e on e.id = m.escenario_id
     where m.curso_id = p_curso_id
  loop
    v_plantilla := (select copia from _plantillas where origen = r.checklist_tecnica_id);

    -- Si el destino ya tiene uno con ese nombre y el mismo checklist, es el mismo.
    select d.id into v_escenario
      from public.escenarios d
     where d.tenant_id = p_tenant_destino
       and d.nombre = r.nombre
       and d.checklist_tecnica_id is not distinct from v_plantilla
     limit 1;

    if v_escenario is not null then
      insert into _escenarios values (r.id, v_escenario, false);
    else
      -- Nombre libre: `escenarios_nombre_key` es por institucion.
      v_base := r.nombre;
      v_nombre := v_base;
      v_n := 2;
      while exists (
        select 1 from public.escenarios d
         where d.tenant_id = p_tenant_destino and d.nombre = v_nombre
      ) loop
        v_nombre := left(v_base, 180) || ' (' || v_n || ')';
        v_n := v_n + 1;
      end loop;

      -- Sin planificacion: el archivo lo copia el servidor y recien ahi se
      -- completan las cinco columnas, que van juntas o no van.
      insert into public.escenarios (nombre, checklist_tecnica_id, tenant_id)
      values (v_nombre, v_plantilla, p_tenant_destino)
      returning id into v_escenario;

      insert into _escenarios values (r.id, v_escenario, true);

      if r.planificacion_ruta is not null then
        insert into _planificaciones
        values (v_escenario, r.planificacion_ruta, r.planificacion_archivo,
                r.planificacion_tipo, r.planificacion_tamano);
      end if;
    end if;
  end loop;

  -- ------------------------------------------------------------------
  -- 3. El padron, solo de quienes participaron. Si el destino ya tiene ese
  --    documento, es la misma persona: se reusa su ficha.
  -- ------------------------------------------------------------------
  if p_con_padron then
    for r in
      select distinct pe.dni, pe.nombre, pe.apellido
        from public.mesas m
        join public.corridas c on c.mesa_id = m.id
        join public.participaciones pa on pa.corrida_id = c.id
        join public.participantes pe
          on pe.dni = pa.dni and pe.tenant_id = v_curso.tenant_id
       where m.curso_id = p_curso_id
    loop
      select d.id into v_id
        from public.participantes d
       where d.tenant_id = p_tenant_destino and d.dni = r.dni;

      if found then
        insert into _personas values (r.dni, v_id, false);
      else
        insert into public.participantes (dni, nombre, apellido, tenant_id)
        values (r.dni, r.nombre, r.apellido, p_tenant_destino)
        returning id into v_id;
        insert into _personas values (r.dni, v_id, true);
      end if;
    end loop;
  end if;

  -- ------------------------------------------------------------------
  -- 4. El curso. El nombre es unico por institucion y el codigo, global:
  --    el de la copia es propio, asi que sus QR apuntan a la copia.
  -- ------------------------------------------------------------------
  v_nombre := v_curso.nombre;
  v_n := 2;
  while exists (
    select 1 from public.cursos d
     where d.tenant_id = p_tenant_destino and d.nombre = v_nombre
  ) loop
    v_nombre := left(v_curso.nombre, 180) || ' (' || v_n || ')';
    v_n := v_n + 1;
  end loop;

  v_base := left(v_curso.codigo, 36);
  v_codigo := v_base;
  v_n := 2;
  while exists (select 1 from public.cursos d where d.codigo = v_codigo) loop
    v_codigo := left(v_base, 38 - length(v_n::text)) || '-' || v_n;
    v_n := v_n + 1;
  end loop;

  -- El docente que conduce se mantiene solo si su documento viajo con el padron.
  insert into public.cursos (nombre, codigo, destinado_a, archivado, tenant_id)
  values (v_nombre, v_codigo, v_curso.destinado_a, v_curso.archivado, p_tenant_destino)
  returning id into v_curso_nuevo;

  -- ------------------------------------------------------------------
  -- 5. Mesas, ciclos, roles ocupados, evaluaciones y respuestas.
  -- ------------------------------------------------------------------
  for r in select * from public.mesas where curso_id = p_curso_id order by numero loop
    v_dni_del_docente := case
      when r.docente_dni is null then null
      when exists (select 1 from _personas where dni = r.docente_dni) then r.docente_dni
      else null
    end;

    insert into public.mesas (numero, escenario_id, curso_id, docente_dni, creada_en)
    values (r.numero,
            (select copia from _escenarios where origen = r.escenario_id),
            v_curso_nuevo, v_dni_del_docente, r.creada_en)
    returning id into v_id;

    insert into _mesas values (r.id, v_id);
  end loop;

  for r in
    select c.* from public.corridas c
     join _mesas mm on mm.origen = c.mesa_id
     order by c.numero
  loop
    insert into public.corridas (mesa_id, numero, habilitada, creada_en)
    values ((select copia from _mesas where origen = r.mesa_id),
            r.numero, r.habilitada, r.creada_en)
    returning id into v_id;

    insert into _ciclos values (r.id, v_id);
  end loop;

  for r in
    select pa.* from public.participaciones pa
     join _ciclos cc on cc.origen = pa.corrida_id
  loop
    insert into public.participaciones (corrida_id, dni, rol_codigo, participante_id, creada_en)
    values ((select copia from _ciclos where origen = r.corrida_id),
            r.dni, r.rol_codigo,
            (select copia from _personas where dni = r.dni),
            r.creada_en)
    returning id into v_id;

    insert into _roles values (r.id, v_id);
  end loop;

  /*
   * Las evaluaciones entran sin fecha de envio y recien al final se fechan.
   *
   * No es un rodeo: `impedir_cambios_post_envio()` no deja agregarle respuestas
   * a un checklist ya enviado, que es exactamente lo que protege al sistema de
   * que alguien retoque lo que entrego. Copiar en dos pasos lo respeta en vez de
   * esquivarlo, y tiene un premio: al fechar, `exigir_checklist_completo()`
   * cuenta los items y falla si falta alguna respuesta. O sea que la copia no se
   * da por enviada hasta estar completa, y lo verifica la base y no esta funcion.
   */
  for r in
    select i.* from public.checklist_instancias i
     join _roles rr on rr.origen = i.participacion_id
  loop
    insert into public.checklist_instancias (participacion_id, plantilla_id, creada_en)
    values ((select copia from _roles where origen = r.participacion_id),
            (select copia from _plantillas where origen = r.plantilla_id),
            r.creada_en)
    returning id into v_id;

    insert into _instancias values (r.id, v_id);
  end loop;

  insert into public.checklist_respuestas (instancia_id, item_id, cumplido, marcada_en)
  select (select copia from _instancias where origen = re.instancia_id),
         (select copia from _items where origen = re.item_id),
         re.cumplido, re.marcada_en
    from public.checklist_respuestas re
    join _instancias ii on ii.origen = re.instancia_id;

  update public.checklist_instancias c
     set enviada_en = o.enviada_en
    from public.checklist_instancias o
    join _instancias ii on ii.origen = o.id
   where c.id = ii.copia
     and o.enviada_en is not null;

  return jsonb_build_object(
    'curso_id',    v_curso_nuevo,
    'nombre',      v_nombre,
    'codigo',      v_codigo,
    'institucion', v_destino,
    'checklists',  (select count(*) from _plantillas where nueva),
    'escenarios',  (select count(*) from _escenarios where nuevo),
    'padron',      (select count(*) from _personas where nueva),
    'mesas',       (select count(*) from _mesas),
    'ciclos',      (select count(*) from _ciclos),
    'roles',       (select count(*) from _roles),
    'evaluaciones',(select count(*) from _instancias where origen in
                      (select id from public.checklist_instancias where enviada_en is not null)),
    'planificaciones', coalesce(
      (select jsonb_agg(jsonb_build_object(
         'escenario_id', escenario, 'ruta', ruta, 'archivo', archivo,
         'tipo', tipo, 'tamano', tamano))
         from _planificaciones), '[]'::jsonb)
  );
end;
$$;

comment on function public.copiar_curso_a_institucion(uuid, uuid, boolean) is
  'Copia un curso entero a otra institucion: checklists, escenarios, padron de '
  'quienes participaron, mesas, ciclos, roles ocupados y evaluaciones con sus '
  'respuestas. Devuelve el resumen y que planificaciones faltan copiar en el bucket.';
