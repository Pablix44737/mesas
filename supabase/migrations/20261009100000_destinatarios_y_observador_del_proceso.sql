-- El modelo MESAS se corre con dos publicos distintos y no se juega igual.
--
-- Con DOCENTES/INSTRUCTORES se juega como hasta hoy: uno de ellos facilita y
-- otro lo evalua con el checklist del observador del facilitador.
--
-- Con ALUMNOS eso no tiene sentido: el que facilita es el docente que conduce la
-- mesa, no un alumno, y nadie lo evalua. En su lugar aparece el OBSERVADOR DEL
-- PROCESO, que mira como se desarrolla la simulacion.
--
-- El rol viejo no se borra: los dos conviven, cada uno en su tipo de curso. Y
-- todo lo que ya existe sigue valiendo, porque esto solo agrega.

-- --------------------------------------------------------------------------
-- A quien esta destinado un curso.
--
-- Es una tabla y no un check: cuando aparezca un tercer publico —residentes,
-- personal de enfermeria ya recibido— darlo de alta tiene que ser insertar
-- filas, no migrar dos tablas.
-- --------------------------------------------------------------------------
create table public.destinatarios (
  codigo text primary key,
  nombre text not null unique,
  descripcion text not null,
  orden integer not null default 0
);

insert into public.destinatarios (codigo, nombre, descripcion, orden) values
  ('alumnos',  'Alumnos',
   'El docente que conduce la mesa facilita; los alumnos observan el proceso y la tecnica.', 1),
  ('docentes', 'Docentes e instructores',
   'Los participantes rotan por todos los roles, incluido el de facilitador.', 2);

alter table public.destinatarios enable row level security;

-- Se agrega nullable, se completa y recien ahi se exige, igual que `curso_id` en
-- su momento. La Diplomatura que ya esta cargada es de docentes y no es una
-- eleccion: sus 9 mesas ocuparon `facilitador` 41 veces y `observador_operacion`
-- 50. Marcarla de alumnos dejaria su propia historia fuera de la regla nueva.
alter table public.cursos
  add column destinado_a text references public.destinatarios(codigo);

update public.cursos set destinado_a = 'docentes';

alter table public.cursos alter column destinado_a set not null;

-- --------------------------------------------------------------------------
-- Que instrumento completa cada rol.
--
-- Hasta hoy esto se preguntaba nombrando roles: `rol = 'observador_operacion'`
-- aparecia en dos funciones, un indice y diez puntos de la aplicacion. Mientras
-- hubo un solo rol con checklist comun se sostenia; con dos, copiar ese `if` en
-- trece lugares es la forma segura de que el tercero rompa algo.
--
--   comun          -> una plantilla propia del rol, la misma para todas las
--                     mesas, con una sola vigente a la vez
--   del_escenario  -> la lista de cotejo de la tecnica que trae el escenario
--   null           -> el rol no evalua
-- --------------------------------------------------------------------------
alter table public.roles
  add column checklist text check (checklist in ('comun', 'del_escenario'));

update public.roles set checklist = 'comun'
 where codigo = 'observador_operacion';

update public.roles set checklist = 'del_escenario'
 where codigo in ('observador_tecnica', 'facilitador');

-- Los dos observadores del facilitador y del proceso no conviven nunca, asi que
-- se intercalan en el orden en vez de empujarse: cada curso ve uno solo.
update public.roles set orden = orden + 1 where orden >= 2;

insert into public.roles (codigo, nombre, observador, orden, checklist)
values ('observador_proceso', 'Observador del proceso', true, 2, 'comun');

-- --------------------------------------------------------------------------
-- Que roles se ocupan en un curso segun su destinatario.
--
-- `lo_elige_el_participante` es la diferencia entre "no existe" y "no se elige
-- desde el QR": en un curso de alumnos el facilitador SI se ocupa —lo ocupa el
-- docente que conduce la mesa— pero ningun alumno lo ve en la lista de roles.
-- --------------------------------------------------------------------------
create table public.roles_por_destinatario (
  destinatario text not null references public.destinatarios(codigo),
  rol_codigo text not null references public.roles(codigo),
  lo_elige_el_participante boolean not null default true,
  primary key (destinatario, rol_codigo)
);

insert into public.roles_por_destinatario (destinatario, rol_codigo, lo_elige_el_participante) values
  -- Docentes: los cinco de siempre, todos por el QR.
  ('docentes', 'observador_operacion', true),
  ('docentes', 'observador_tecnica',   true),
  ('docentes', 'facilitador',          true),
  ('docentes', 'operador',             true),
  ('docentes', 'asistente',            true),
  -- Alumnos: el del proceso reemplaza al del facilitador, y el facilitador
  -- queda reservado al docente que conduce la mesa.
  ('alumnos',  'observador_proceso',   true),
  ('alumnos',  'observador_tecnica',   true),
  ('alumnos',  'operador',             true),
  ('alumnos',  'asistente',            true),
  ('alumnos',  'facilitador',          false);

alter table public.roles_por_destinatario enable row level security;

-- Que el rol declarado sea uno de los que ese curso ocupa. La pantalla ya filtra
-- la lista, pero eso es una comodidad: la regla vive aca, donde no se puede
-- esquivar mandando otro `rol_codigo`.
create or replace function public.validar_rol_segun_el_destinatario()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_destinatario text;
begin
  select cu.destinado_a into v_destinatario
    from public.corridas c
    join public.mesas m   on m.id = c.mesa_id
    join public.cursos cu on cu.id = m.curso_id
   where c.id = new.corrida_id;

  if v_destinatario is null then
    raise exception 'Esa corrida no existe' using errcode = 'no_data_found';
  end if;

  if not exists (
    select 1 from public.roles_por_destinatario rd
     where rd.destinatario = v_destinatario
       and rd.rol_codigo = new.rol_codigo
  ) then
    raise exception 'El rol % no se ocupa en un curso destinado a %',
      new.rol_codigo, v_destinatario using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger participaciones_rol_del_destinatario
  before insert or update of rol_codigo, corrida_id on public.participaciones
  for each row execute function public.validar_rol_segun_el_destinatario();

-- --------------------------------------------------------------------------
-- Lo que deja de nombrar roles y pasa a preguntarle a `roles.checklist`.
-- --------------------------------------------------------------------------

-- Hay una sola plantilla vigente por cada rol de checklist comun. El predicado
-- enumera esos roles porque un indice no puede consultar otra tabla; es el unico
-- lugar que hay que tocar al aparecer un rol comun nuevo, y a cambio la
-- exclusion es declarativa y no se puede perder en una carrera.
drop index public.checklist_plantillas_operacion_unica;

create unique index checklist_plantillas_comun_unica
  on public.checklist_plantillas (rol_codigo)
  where estado = 'disponible'
    and rol_codigo in ('observador_operacion', 'observador_proceso');

create or replace function public.plantilla_de_la_participacion(p_participacion_id uuid)
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select case r.checklist
    when 'comun' then (
      select p.id from public.checklist_plantillas p
       where p.rol_codigo = pa.rol_codigo and p.estado = 'disponible'
    )
    when 'del_escenario' then e.checklist_tecnica_id
    else null
  end
  from public.participaciones pa
  join public.roles r      on r.codigo = pa.rol_codigo
  join public.corridas c   on c.id = pa.corrida_id
  join public.mesas m      on m.id = c.mesa_id
  join public.escenarios e on e.id = m.escenario_id
  where pa.id = p_participacion_id;
$$;

create or replace function public.dar_por_terminado_el_checklist(p_plantilla_id uuid)
returns public.checklist_plantillas
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_plantilla public.checklist_plantillas;
begin
  select * into v_plantilla from public.checklist_plantillas p where p.id = p_plantilla_id
   for update;

  if not found then
    raise exception 'El checklist no existe' using errcode = 'no_data_found';
  end if;

  if v_plantilla.estado = 'disponible' then
    return v_plantilla;
  end if;

  if not exists (select 1 from public.checklist_items i where i.plantilla_id = p_plantilla_id) then
    raise exception 'Un checklist sin criterios no puede darse por terminado'
      using errcode = 'check_violation';
  end if;

  -- Si el rol lleva checklist comun, el que estaba vigente queda reemplazado.
  if exists (
    select 1 from public.roles r
     where r.codigo = v_plantilla.rol_codigo and r.checklist = 'comun'
  ) then
    update public.checklist_plantillas
       set estado = 'reemplazada'
     where rol_codigo = v_plantilla.rol_codigo
       and estado = 'disponible'
       and id <> p_plantilla_id;
  end if;

  update public.checklist_plantillas
     set estado = 'disponible'
   where id = p_plantilla_id
  returning * into v_plantilla;

  return v_plantilla;
end;
$$;
