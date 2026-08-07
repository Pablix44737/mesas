-- Bucket privado: la planificacion se sirve desde el servidor de SvelteKit,
-- nunca por URL publica. Sin politicas, solo la service_role key llega.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'planificaciones',
  'planificaciones',
  false,
  20971520,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;
