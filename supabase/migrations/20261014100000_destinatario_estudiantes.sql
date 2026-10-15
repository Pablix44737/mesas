-- En la interfaz se dice «estudiantes», no «alumnos». Cambia solo lo que se
-- muestra: el codigo 'alumnos' sigue siendo la llave de cursos y roles.
update public.destinatarios
   set nombre = 'Estudiantes',
       descripcion = 'El docente que conduce la mesa facilita; los estudiantes observan el proceso y la técnica.'
 where codigo = 'alumnos';
