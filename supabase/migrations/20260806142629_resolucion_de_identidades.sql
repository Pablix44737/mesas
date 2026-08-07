-- El sistema resuelve contra el padron los DNI ingresados en una asignacion.
create or replace function public.resolver_identidades_de_asignacion()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.evaluador_dni := trim(new.evaluador_dni);
  new.evaluado_dni  := trim(new.evaluado_dni);

  select p.id into new.evaluador_participante_id
    from public.participantes p where p.dni = new.evaluador_dni;

  select p.id into new.evaluado_participante_id
    from public.participantes p where p.dni = new.evaluado_dni;

  return new;
end;
$$;

create trigger asignaciones_resolver_identidades
  before insert or update of evaluador_dni, evaluado_dni on public.asignaciones
  for each row execute function public.resolver_identidades_de_asignacion();
