-- Datos minimos para ejercitar la feature en curso.
-- Los roles NO estan aca: son fijos y los carga la migracion, porque el modelo
-- MESAS los define y el trigger de checklists depende de ellos.

-- Padron de participantes, cargado con anterioridad al evento.
insert into participantes (dni, nombre, apellido) values
  ('30111222', 'Ana',      'Gomez'),
  ('30222333', 'Bruno',    'Diaz'),
  ('30333444', 'Carla',    'Ruiz'),
  ('30444555', 'Diego',    'Lopez'),
  ('30555666', 'Elena',    'Martinez'),
  ('30666777', 'Federico', 'Sosa');

-- Checklists ya terminados: el estado por defecto es 'en_construccion', y uno
-- en construccion no puede asociarse a un escenario ni presentarse en una mesa.
-- Checklist del facilitador: uno solo, comun a todos los escenarios.
insert into checklist_plantillas (rol_codigo, nombre, ponderado, estado)
values ('observador_operacion', 'Checklist del observador del facilitador', false, 'disponible');

-- Checklists de la tecnica: uno por escenario.
insert into checklist_plantillas (rol_codigo, nombre, ponderado, estado) values
  ('observador_tecnica', 'Tecnica: manejo inicial del politraumatizado', true,  'disponible'),
  ('observador_tecnica', 'Tecnica: reanimacion cardiopulmonar avanzada', false, 'disponible');

insert into checklist_items (plantilla_id, orden, texto, peso)
select p.id, v.orden, v.texto, v.peso
from checklist_plantillas p
join (values
  ('Checklist del observador del facilitador', 1, 'El prebriefing establece el contrato de ficcion', 1),
  ('Checklist del observador del facilitador', 2, 'Los objetivos de aprendizaje se enuncian al inicio', 1),
  ('Checklist del observador del facilitador', 3, 'El facilitador interviene sin invadir la ejecucion', 1),
  ('Checklist del observador del facilitador', 4, 'El entorno se mantiene seguro y confidencial', 1),
  ('Checklist del observador del facilitador', 5, 'El operador recibe consignas claras', 1),
  ('Checklist del observador del facilitador', 6, 'El cierre se conduce sin emitir juicios de valor', 1),

  ('Tecnica: manejo inicial del politraumatizado', 1, 'Realiza la evaluacion primaria segun ABCDE', 3),
  ('Tecnica: manejo inicial del politraumatizado', 2, 'Asegura la via aerea con control cervical', 3),
  ('Tecnica: manejo inicial del politraumatizado', 3, 'Identifica y trata la lesion de riesgo vital', 2),
  ('Tecnica: manejo inicial del politraumatizado', 4, 'Controla la hemorragia externa', 2),
  ('Tecnica: manejo inicial del politraumatizado', 5, 'Indica los estudios complementarios pertinentes', 1),

  ('Tecnica: reanimacion cardiopulmonar avanzada', 1, 'Verifica la ausencia de pulso en menos de 10 segundos', 1),
  ('Tecnica: reanimacion cardiopulmonar avanzada', 2, 'Inicia compresiones con frecuencia y profundidad adecuadas', 1),
  ('Tecnica: reanimacion cardiopulmonar avanzada', 3, 'Minimiza las interrupciones de las compresiones', 1),
  ('Tecnica: reanimacion cardiopulmonar avanzada', 4, 'Administra la desfibrilacion cuando corresponde', 1),
  ('Tecnica: reanimacion cardiopulmonar avanzada', 5, 'Aplica el algoritmo de drogas segun el ritmo', 1)
) as v(plantilla, orden, texto, peso) on v.plantilla = p.nombre;

-- Escenarios preparados. Ninguno tiene planificacion adjunta: se sube desde la
-- pantalla de administracion, que es justamente lo que hay que probar.
insert into escenarios (nombre, checklist_tecnica_id)
select 'Manejo inicial del paciente politraumatizado', p.id
  from checklist_plantillas p where p.nombre = 'Tecnica: manejo inicial del politraumatizado';

insert into escenarios (nombre, checklist_tecnica_id)
select 'Reanimacion cardiopulmonar avanzada', p.id
  from checklist_plantillas p where p.nombre = 'Tecnica: reanimacion cardiopulmonar avanzada';
