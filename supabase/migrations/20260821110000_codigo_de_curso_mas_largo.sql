-- 24 caracteres cortaban el anio: «Enfermeria en Urgencias · Cohorte 2027» derivaba
-- `enfermeria-en-urgencias`, y la cohorte siguiente habria quedado como `-2`. Con
-- 40 entra la parte que distingue una edicion de otra, y sigue siendo corto para
-- la URL del QR.
alter table public.cursos drop constraint cursos_codigo_formato;

alter table public.cursos
  add constraint cursos_codigo_formato check (codigo ~ '^[a-z0-9][a-z0-9-]{1,39}$');
