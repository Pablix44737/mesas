-- Quien interviene en el sistema declara el rol que ocupa en una corrida.
-- Se guarda el DNI tal como se ingreso y, si el padron lo resuelve, tambien
-- el participante que le corresponde.
create table public.participaciones (
  id uuid primary key default gen_random_uuid(),
  corrida_id uuid not null references public.corridas(id) on delete cascade,
  dni text not null,
  participante_id uuid references public.participantes(id),
  rol_codigo text not null references public.roles(codigo),
  creada_en timestamptz not null default now(),
  -- Un participante ocupa un solo rol por corrida. Nada impide, en cambio, que
  -- varios ocupen el mismo rol: los observadores suelen ser mas de uno.
  unique (corrida_id, dni)
);

create index participaciones_corrida_idx on public.participaciones (corrida_id);
create index participaciones_participante_idx on public.participaciones (participante_id);

-- El sistema resuelve contra el padron el DNI que se ingresa.
create or replace function public.resolver_identidad_de_participacion()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.dni := trim(new.dni);

  select p.id into new.participante_id
    from public.participantes p where p.dni = new.dni;

  return new;
end;
$$;

create trigger participaciones_resolver_identidad
  before insert or update of dni on public.participaciones
  for each row execute function public.resolver_identidad_de_participacion();

alter table public.participaciones enable row level security;
