-- =====================================================================
-- AscendHabit · Diario: textos largos + historial por año
-- =====================================================================

-- Diario extenso: hasta ~150.000 caracteres por día (el cifrado ocupa más que el texto)
alter table public.journal_entries drop constraint if exists journal_entries_free_journal_check;
alter table public.journal_entries add constraint journal_entries_free_journal_check
  check (free_journal like 'v1:%' and char_length(free_journal) <= 600000);

-- Resumen de un año: cuántos días con diario/bitácora tiene cada mes
create function public.get_journal_year(p_year int default null)
returns table (
  month         date,
  entries       int,
  journal_days  int,
  avg_mood      numeric
) language sql stable security definer set search_path = '' as $$
  with y as (
    select coalesce(p_year, extract(year from private.user_today(auth.uid()))::int) as yr
  )
  select m::date,
         count(e.id)::int,
         count(e.id) filter (where e.free_journal is not null)::int,
         round(avg(e.mood_score), 1)
  from y
  cross join generate_series(make_date(y.yr, 1, 1), make_date(y.yr, 12, 1), interval '1 month') m
  left join public.journal_entries e
         on e.user_id = auth.uid()
        and e.entry_date >= m::date
        and e.entry_date <  (m + interval '1 month')::date
  group by m
  order by m
$$;

revoke execute on function public.get_journal_year(int) from public, anon;
grant  execute on function public.get_journal_year(int) to authenticated;
