-- Datos base del producto (van también a producción, por eso es migración y no seed.sql)

-- Idempotente: si ya existen, no se vuelven a insertar
insert into public.categories (user_id, name, color, icon, sort_order)
select null, v.name, v.color, v.icon, v.sort_order
from (values
  ('Salud',         '#10B981', '💧', 1),
  ('Fitness',       '#F97316', '🏃', 2),
  ('Mente',         '#8B5CF6', '🧘', 3),
  ('Aprendizaje',   '#3B82F6', '📖', 4),
  ('Productividad', '#EAB308', '🎯', 5),
  ('Descanso',      '#6366F1', '🌙', 6)
) as v(name, color, icon, sort_order)
where not exists (select 1 from public.categories c where c.user_id is null and c.name = v.name);

insert into public.habit_templates
  (name, description, category_name, icon, goal_type, target_value, unit, time_of_day, sort_order)
select v.*
from (values
  ('Beber agua',                    'Hidratación a lo largo del día',              'Salud',         '💧', 'count'::public.goal_type,    8::numeric,  'vasos',   'anytime'::public.time_of_day,   1),
  ('Definir las 3 prioridades',     'Elige las 3 tareas que harían del día un éxito','Productividad','🎯', 'boolean'::public.goal_type,  1::numeric,  null,      'morning'::public.time_of_day,   2),
  ('Moverse 30 minutos',            'Caminar, entrenar, bici… lo que sea',          'Fitness',       '🏃', 'duration'::public.goal_type, 30::numeric, 'min',     'anytime'::public.time_of_day,   3),
  ('Meditar',                       'Respiración o meditación guiada',              'Mente',         '🧘', 'duration'::public.goal_type, 10::numeric, 'min',     'morning'::public.time_of_day,   4),
  ('Leer',                          'Libro físico o digital, no redes',             'Aprendizaje',   '📖', 'count'::public.goal_type,    20::numeric, 'páginas', 'evening'::public.time_of_day,   5),
  ('Sin pantallas antes de dormir', '30 minutos sin móvil antes de acostarte',      'Descanso',      '📵', 'boolean'::public.goal_type,  1::numeric,  null,      'evening'::public.time_of_day,   6),
  ('Diario de gratitud',            'Escribe 3 cosas por las que estás agradecido', 'Mente',         '✍️', 'boolean'::public.goal_type,  1::numeric,  null,      'evening'::public.time_of_day,   7)
) as v(name, description, category_name, icon, goal_type, target_value, unit, time_of_day, sort_order)
where not exists (select 1 from public.habit_templates t where t.name = v.name);
