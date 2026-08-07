-- Habilitar una corrida es siempre el mismo movimiento: cerrar la que este en
-- curso y abrir la siguiente. Va en una funcion para que ocurra de una sola vez;
-- si quedara a medias, la mesa se quedaria sin corrida habilitada.
create or replace function public.habilitar_siguiente_corrida(p_mesa_id uuid)
returns public.corridas
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_corrida public.corridas;
begin
  -- Serializa a dos lideres que habiliten al mismo tiempo: sin esto, ambos
  -- calcularian el mismo numero y uno chocaria contra unique (mesa_id, numero).
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

  return v_corrida;
end;
$$;
