create extension if not exists "pgcrypto";

-- Roles que un participante puede ocupar durante una corrida.
create table roles (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  evaluable boolean not null default true,
  creado_en timestamptz not null default now()
);

-- Padron de participantes, cargado con anterioridad al evento.
create table participantes (
  id uuid primary key default gen_random_uuid(),
  dni text not null unique,
  nombre text not null,
  apellido text not null,
  creado_en timestamptz not null default now()
);

create table mesas (
  id uuid primary key default gen_random_uuid(),
  numero integer not null unique,
  escenario text not null,
  creada_en timestamptz not null default now()
);

create table corridas (
  id uuid primary key default gen_random_uuid(),
  mesa_id uuid not null references mesas(id) on delete cascade,
  numero integer not null check (numero > 0),
  habilitada boolean not null default false,
  creada_en timestamptz not null default now(),
  unique (mesa_id, numero)
);

-- Una mesa tiene a lo sumo una corrida habilitada a la vez.
create unique index corridas_una_habilitada_por_mesa
  on corridas (mesa_id) where habilitada;

-- Plantilla de checklist asociada al rol que evalua.
create table checklist_plantillas (
  id uuid primary key default gen_random_uuid(),
  rol_id uuid not null references roles(id),
  nombre text not null,
  ponderado boolean not null default false,
  activa boolean not null default true,
  creada_en timestamptz not null default now()
);

create unique index checklist_plantillas_una_activa_por_rol
  on checklist_plantillas (rol_id) where activa;

create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  plantilla_id uuid not null references checklist_plantillas(id) on delete cascade,
  orden integer not null,
  texto text not null,
  peso numeric(6,2) not null default 1 check (peso >= 0),
  unique (plantilla_id, orden)
);

-- Vinculo entre evaluador y evaluado para una corrida.
-- Se guarda el DNI tal como fue ingresado y, si el padron lo resuelve,
-- tambien el participante correspondiente.
create table asignaciones (
  id uuid primary key default gen_random_uuid(),
  corrida_id uuid not null references corridas(id) on delete cascade,
  evaluador_dni text not null,
  evaluador_participante_id uuid references participantes(id),
  evaluador_rol_id uuid not null references roles(id),
  evaluado_dni text not null,
  evaluado_participante_id uuid references participantes(id),
  evaluado_rol_id uuid not null references roles(id),
  creada_en timestamptz not null default now(),
  constraint asignaciones_sin_autoevaluacion check (evaluador_dni <> evaluado_dni),
  unique (corrida_id, evaluador_dni)
);

-- Checklist abierto para una asignacion concreta.
create table checklist_instancias (
  id uuid primary key default gen_random_uuid(),
  asignacion_id uuid not null unique references asignaciones(id) on delete cascade,
  plantilla_id uuid not null references checklist_plantillas(id),
  enviada_en timestamptz,
  creada_en timestamptz not null default now()
);

create table checklist_respuestas (
  id uuid primary key default gen_random_uuid(),
  instancia_id uuid not null references checklist_instancias(id) on delete cascade,
  item_id uuid not null references checklist_items(id),
  cumplido boolean not null default false,
  marcada_en timestamptz not null default now(),
  unique (instancia_id, item_id)
);

create index asignaciones_corrida_idx on asignaciones (corrida_id);
create index asignaciones_evaluado_participante_idx on asignaciones (evaluado_participante_id);
create index checklist_items_plantilla_idx on checklist_items (plantilla_id, orden);
create index checklist_respuestas_instancia_idx on checklist_respuestas (instancia_id);
