-- El numero de mesa vuelve a empezar en 1 en cada curso.
--
-- Era unico a nivel global, asi que la segunda edicion habria tenido que
-- arrancar en la mesa 10. Ahora lo unico que se exige es que no haya dos mesas
-- con el mismo numero DENTRO de un curso, que es lo que se ve en el aula.
--
-- La contracara es que /m/<numero> deja de identificar una mesa: dos cursos
-- pueden tener su mesa 1. Por eso el QR pasa a llevar el codigo del curso.
alter table public.mesas drop constraint mesas_numero_key;

alter table public.mesas add constraint mesas_curso_numero_key unique (curso_id, numero);
