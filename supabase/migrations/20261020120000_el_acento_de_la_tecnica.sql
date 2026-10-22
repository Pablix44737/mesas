-- El acento que faltaba en «Observador de la tecnica».
--
-- Las migraciones de este proyecto se escriben sin tildes, y al sembrar los roles
-- esa convencion se llevo puesto un dato que no es codigo: `roles.nombre` es
-- texto que se muestra tal cual. Aparece en la pantalla del participante al
-- elegir rol, en la del lider, en el recorrido de la mesa y en los resultados.
--
-- Solo el nombre. `codigo` es la clave con que lo referencian las
-- participaciones, los checklists y la aplicacion: ese no se toca.
update public.roles
   set nombre = 'Observador de la técnica'
 where codigo = 'observador_tecnica';
