-- Datos base del producto (van también a producción, por eso es migración y no seed.sql)

insert into public.categories (user_id, name, color, icon, sort_order) values
  (null, 'Salud',         '#10B981', '💧', 1),
  (null, 'Fitness',       '#F97316', '🏃', 2),
  (null, 'Mente',         '#8B5CF6', '🧘', 3),
  (null, 'Aprendizaje',   '#3B82F6', '📖', 4),
  (null, 'Productividad', '#EAB308', '🎯', 5),
  (null, 'Descanso',      '#6366F1', '🌙', 6);

insert into public.habit_templates
  (name, description, category_name, icon, goal_type, target_value, unit, time_of_day, sort_order) values
  ('Beber agua',                    'Hidratación a lo largo del día',              'Salud',         '💧', 'count',    8,  'vasos',   'anytime',   1),
  ('Definir las 3 prioridades',     'Elige las 3 tareas que harían del día un éxito','Productividad','🎯', 'boolean',  1,  null,      'morning',   2),
  ('Moverse 30 minutos',            'Caminar, entrenar, bici… lo que sea',          'Fitness',       '🏃', 'duration', 30, 'min',     'anytime',   3),
  ('Meditar',                       'Respiración o meditación guiada',              'Mente',         '🧘', 'duration', 10, 'min',     'morning',   4),
  ('Leer',                          'Libro físico o digital, no redes',             'Aprendizaje',   '📖', 'count',    20, 'páginas', 'evening',   5),
  ('Sin pantallas antes de dormir', '30 minutos sin móvil antes de acostarte',      'Descanso',      '📵', 'boolean',  1,  null,      'evening',   6),
  ('Diario de gratitud',            'Escribe 3 cosas por las que estás agradecido', 'Mente',         '✍️', 'boolean',  1,  null,      'evening',   7);
