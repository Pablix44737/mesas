-- Los cursos, y la mesa como algo que pertenece a uno.
--
-- Hasta ahora las mesas colgaban de la nada: servian para un evento y listo. Al
-- querer usar el sistema para una cohorte nueva, las mesas de las dos ediciones
-- se mezclarian en la misma lista. Un curso agrupa sus mesas y las separa de las
-- de cualquier otro.
--
-- Lo que NO cuelga del curso son los escenarios, los checklists ni el padron.
-- Los dos primeros son instrumentos institucionales que se reusan tal cual en
-- cada edicion; separarlos obligaria a recargarlos cada vez. El padron es el
-- caso discutible y queda pendiente a proposito.
--
-- `codigo` todavia no se usa: es para la etapa siguiente, cuando el QR pase a ser
-- /m/<codigo>/<numero> y los numeros de mesa vuelvan a empezar en 1 en cada
-- curso. Se agrega ahora para no volver a migrar la tabla.
create table public.cursos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  codigo text not null unique,
  archivado boolean not null default false,
  creado_en timestamptz not null default now(),
  constraint cursos_codigo_formato check (codigo ~ '^[a-z0-9][a-z0-9-]{1,23}$')
);

alter table public.cursos enable row level security;

-- Todo lo que ya existe es de la Diplomatura: es el evento que se corrio.
insert into public.cursos (nombre, codigo)
values ('Diplomatura Superior Universitaria en Simulación', 'diplomatura');

-- Se agrega nullable, se completa, y recien ahi se exige. `restrict` y no
-- `cascade`: borrar un curso no puede llevarse por delante sus mesas sin que
-- alguien lo diga explicitamente. Para eso esta borrar_mesa(), una por una.
alter table public.mesas
  add column curso_id uuid references public.cursos(id) on delete restrict;

update public.mesas
   set curso_id = (select id from public.cursos where codigo = 'diplomatura');

alter table public.mesas
  alter column curso_id set not null;

create index mesas_curso_idx on public.mesas (curso_id);
