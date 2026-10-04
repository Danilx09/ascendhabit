-- =====================================================================
-- AscendHabit · Quitar plantillas y categorías duplicadas
-- (aparecen si la migración de datos base se ejecutó más de una vez)
-- Se puede ejecutar varias veces sin problema.
-- =====================================================================

-- 1) Categorías del sistema: se conserva una por nombre.
--    Antes de borrar, los hábitos que apuntaban a una copia pasan a la que se conserva.
with ranked as (
  select id,
         row_number()  over (partition by name order by id) as rn,
         first_value(id) over (partition by name order by id) as keep_id
  from public.categories
  where user_id is null
)
update public.habits h
   set category_id = r.keep_id
  from ranked r
 where h.category_id = r.id
   and r.rn > 1;

delete from public.categories c
 using (
   select id, row_number() over (partition by name order by id) as rn
   from public.categories
   where user_id is null
 ) d
 where c.id = d.id
   and d.rn > 1;

-- 2) Plantillas: se conserva una por nombre (ningún hábito depende de ellas)
delete from public.habit_templates t
 using (
   select id, row_number() over (partition by name order by id) as rn
   from public.habit_templates
 ) d
 where t.id = d.id
   and d.rn > 1;

-- 3) Que no vuelva a pasar: la base de datos rechazará duplicados
create unique index if not exists categories_system_name_uniq
  on public.categories (name) where user_id is null;
create unique index if not exists habit_templates_name_uniq
  on public.habit_templates (name);
