-- Cambio de terminologia: el rol que hasta ahora se mostraba como "Observador de
-- la operacion" se llama "Observador del facilitador", que es el termino correcto
-- del modelo.
--
-- Cambia el nombre, no el codigo. `roles.codigo` es la clave a la que apuntan
-- `participaciones.rol_codigo` y `checklist_plantillas.rol_codigo`, y ademas
-- aparece literal en varias funciones y en el indice unico parcial que garantiza
-- un solo checklist vigente para este rol. Tocarlo seria una migracion de otro
-- tamano y de ningun beneficio visible: el codigo no se muestra en ninguna
-- pantalla, todo lo que el usuario lee sale de `roles.nombre`.
--
-- (Probablemente sea esto lo que rebota al intentar editarlo a mano desde el
--  panel de Supabase: cambiar `codigo` choca contra esas dos claves foraneas,
--  que no tienen `on update cascade`.)
update public.roles
   set nombre = 'Observador del facilitador'
 where codigo = 'observador_operacion';
