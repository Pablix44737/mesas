-- Cambio de requerimientos: los observadores evaluan el desarrollo de la corrida,
-- no el desempeno de una persona. Desaparece el vinculo evaluador/evaluado.
drop view if exists public.asignaciones_detalle;
drop table if exists public.checklist_respuestas;
drop table if exists public.checklist_instancias;
drop table if exists public.asignaciones;

drop function if exists public.impedir_cambios_post_envio();
drop function if exists public.impedir_reapertura_de_envio();
drop function if exists public.validar_plantilla_del_rol_evaluado();
drop function if exists public.validar_item_de_la_plantilla();
drop function if exists public.resolver_identidades_de_asignacion();

-- Los checklists pasan a colgar del rol observador y del escenario.
drop table if exists public.checklist_items;
drop table if exists public.checklist_plantillas;

-- Las mesas pasan a crearse sobre un escenario preparado por el administrador.
delete from public.mesas;
alter table public.mesas drop column escenario;

-- Nuevo conjunto de roles.
delete from public.roles;
alter table public.roles drop column evaluable;
alter table public.roles add column observador boolean not null default false;
alter table public.roles add column orden integer not null default 0;
