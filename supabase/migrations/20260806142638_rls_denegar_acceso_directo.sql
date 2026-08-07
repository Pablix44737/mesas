-- Los participantes se identifican solo por DNI, sin credencial.
-- Por eso ninguna tabla se expone al cliente: todo el acceso pasa por
-- los endpoints de servidor de SvelteKit, que usan la service_role key.
-- RLS activo y sin politicas => denegado para anon y authenticated.
alter table public.roles                 enable row level security;
alter table public.participantes         enable row level security;
alter table public.mesas                 enable row level security;
alter table public.corridas              enable row level security;
alter table public.checklist_plantillas  enable row level security;
alter table public.checklist_items       enable row level security;
alter table public.asignaciones          enable row level security;
alter table public.checklist_instancias  enable row level security;
alter table public.checklist_respuestas  enable row level security;
