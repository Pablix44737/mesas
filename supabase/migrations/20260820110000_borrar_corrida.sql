-- Deshacer una corrida habilitada por error.
--
-- Pasa: el lider toca "habilitar la corrida 2" cuando la 1 todavia estaba en
-- curso y nadie habia enviado nada. Hasta ahora no habia vuelta atras y la mesa
-- quedaba con una corrida de mas, vacia, corriendo el numero de todas las
-- siguientes.
--
-- Tres condiciones, y las tres viven aca y no en la app:
--
--   1. Solo la ULTIMA corrida de la mesa. Borrar una del medio dejaria un hueco
--      en la numeracion y "volver a la anterior" no querria decir nada.
--   2. Solo si no tiene ninguna evaluacion ENVIADA. Un checklist enviado es un
--      registro cerrado del trabajo de alguien; que se pueda perder por un clic
--      del administrador seria peor que la corrida de mas.
--   3. Al borrarla, la anterior vuelve a quedar habilitada, que es el estado en
--      el que la mesa estaba antes del error. Si no habia anterior, la mesa
--      queda sin corrida habilitada: el mismo estado que recien creada.
--
-- Lo que si se lleva puesto son las participaciones de esa corrida y los
-- checklists que alguien haya abierto sin enviar. Son de la corrida equivocada,
-- asi que se van con ella; el resumen que devuelve dice cuantos eran para que el
-- administrador lo vea antes y despues.
--
-- La numeracion no queda con huecos: `habilitar_siguiente_corrida()` calcula
-- `max(numero) + 1`, asi que despues de borrar la 2 la siguiente vuelve a ser 2.
create or replace function public.borrar_corrida(p_corrida_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_mesa uuid;
  v_numero int;
  v_ultima int;
  v_enviadas int;
  v_participaciones int;
  v_abiertos int;
  v_vuelve_a int;
begin
  select c.mesa_id, c.numero into v_mesa, v_numero
    from public.corridas c
   where c.id = p_corrida_id;

  if not found then
    raise exception 'Esa corrida ya no existe' using errcode = 'no_data_found';
  end if;

  -- El mismo `for update` que toma `habilitar_siguiente_corrida`: si el lider
  -- esta habilitando la siguiente en este momento, los dos se serializan.
  perform 1 from public.mesas m where m.id = v_mesa for update;

  select max(c.numero) into v_ultima from public.corridas c where c.mesa_id = v_mesa;

  if v_numero <> v_ultima then
    raise exception 'Solo se puede eliminar la ultima corrida de la mesa'
      using errcode = 'check_violation';
  end if;

  select count(*) into v_enviadas
    from public.checklist_instancias i
    join public.participaciones pa on pa.id = i.participacion_id
   where pa.corrida_id = p_corrida_id
     and i.enviada_en is not null;

  if v_enviadas > 0 then
    raise exception 'La corrida tiene evaluaciones enviadas'
      using errcode = 'check_violation';
  end if;

  select count(*) into v_participaciones
    from public.participaciones pa
   where pa.corrida_id = p_corrida_id;

  select count(*) into v_abiertos
    from public.checklist_instancias i
    join public.participaciones pa on pa.id = i.participacion_id
   where pa.corrida_id = p_corrida_id;

  -- Participaciones e instancias caen por cascada, como al borrar una mesa.
  delete from public.corridas where id = p_corrida_id;

  -- Y la mesa vuelve a la corrida anterior. Va despues del delete a proposito:
  -- el indice unico parcial sobre `corridas(mesa_id) where habilitada` no admite
  -- dos habilitadas ni por un instante.
  update public.corridas
     set habilitada = true
   where id = (
     select c.id
       from public.corridas c
      where c.mesa_id = v_mesa
      order by c.numero desc
      limit 1
   )
  returning numero into v_vuelve_a;

  return jsonb_build_object(
    'numero', v_numero,
    'participaciones', v_participaciones,
    'checklists_abiertos', v_abiertos,
    'vuelve_a', v_vuelve_a
  );
end;
$$;
