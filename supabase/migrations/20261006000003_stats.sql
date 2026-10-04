-- =====================================================================
-- AscendHabit · Estadísticas globales
--   get_stats(p_weeks): tendencia semanal de cumplimiento y energía,
--   cumplimiento por día de la semana, ranking por hábito y resumen.
--   Misma regla que el resto de la app: un día recuperado cuenta como hecho;
--   los hábitos "X por semana" aportan min(hechos, meta) / meta a su semana.
-- =====================================================================

-- % de cumplimiento de un hábito en los últimos 30 días (o 4 semanas si es semanal)
create function private.habit_rate_30d(p_habit uuid)
returns int language plpgsql stable security definer set search_path = '' as $$
declare
  h       public.habits;
  v_today date;
  v_ok    int;
  v_den   int;
begin
  select * into h from public.habits where id = p_habit;
  v_today := private.user_today(h.user_id);

  if h.frequency_type = 'times_per_week' then
    select coalesce(sum(least(c.n, h.times_per_week)), 0), coalesce(sum(h.times_per_week), 0)
      into v_ok, v_den
      from (
        select (select count(*) from public.habit_logs l
                 where l.habit_id = h.id and l.log_date between w::date and w::date + 6
                   and (l.is_completed or l.recovered_via is not null)) as n
        from generate_series(date_trunc('week', v_today)::date - 28,
                             date_trunc('week', v_today)::date - 7, interval '7 days') w
        where w::date + 6 >= h.start_date
      ) c;
  else
    select count(*) filter (where m.ok), count(*) filter (where m.ok or m.day < v_today)
      into v_ok, v_den
      from (
        select g.day::date as day,
               coalesce(l.is_completed or l.recovered_via is not null, false) as ok
        from generate_series(greatest(h.start_date, v_today - 29),
                             least(v_today, coalesce(h.archived_on - 1, v_today)),
                             interval '1 day') g(day)
        left join public.habit_logs l on l.habit_id = h.id and l.log_date = g.day::date
        where private.is_scheduled(h, g.day::date)
      ) m;
  end if;

  return case when v_den > 0 then round(100.0 * v_ok / v_den) end;
end $$;

create function public.get_stats(p_weeks int default 12)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_user    uuid := auth.uid();
  v_today   date;
  v_weeks   int := least(greatest(coalesce(p_weeks, 12), 4), 52);
  v_start   date;
  v_weekly  jsonb;
  v_weekday jsonb;
  v_habits  jsonb;
  v_perfect record;
  v_pdays   int;
  v_sdays   int;
begin
  if v_user is null then raise exception 'No autenticado'; end if;
  v_today := private.user_today(v_user);
  v_start := date_trunc('week', v_today)::date - (v_weeks - 1) * 7;

  -- 1) Tendencia semanal (la semana en curso cuenta hasta hoy)
  with weeks as (
    select w::date as wk, least(w::date + 6, v_today) as wk_end
    from generate_series(v_start, date_trunc('week', v_today)::date, interval '7 days') w
  ), daily as (
    select wk.wk, coalesce(sum(s.scheduled), 0) as sch, coalesce(sum(s.done), 0) as dn
    from weeks wk
    cross join lateral private.day_stats(v_user, wk.wk, wk.wk_end) s
    group by wk.wk
  ), weekly_habits as (
    select wk.wk,
           coalesce(sum(h.times_per_week), 0) as tgt,
           coalesce(sum(least(h.times_per_week, (
             select count(*) from public.habit_logs l
              where l.habit_id = h.id and l.log_date between wk.wk and wk.wk_end
                and (l.is_completed or l.recovered_via is not null)))), 0) as dn
    from weeks wk
    left join public.habits h
           on h.user_id = v_user and h.frequency_type = 'times_per_week'
          and h.start_date <= wk.wk_end
          and (h.archived_on is null or h.archived_on > wk.wk)
    group by wk.wk
  ), mood as (
    select wk.wk, round(avg(j.mood_score), 1) as avg_mood,
           count(j.id) filter (where j.free_journal is not null) as journal_days
    from weeks wk
    left join public.journal_entries j
           on j.user_id = v_user and j.entry_date between wk.wk and wk.wk_end
    group by wk.wk
  )
  select jsonb_agg(jsonb_build_object(
           'week_start',   w.wk,
           'scheduled',    d.sch + wh.tgt,
           'done',         d.dn + wh.dn,
           'pct',          case when d.sch + wh.tgt > 0
                                then round(100.0 * (d.dn + wh.dn) / (d.sch + wh.tgt)) end,
           'avg_mood',     m.avg_mood,
           'journal_days', m.journal_days,
           'is_current',   w.wk = date_trunc('week', v_today)::date
         ) order by w.wk)
    into v_weekly
    from weeks w
    join daily d using (wk)
    join weekly_habits wh using (wk)
    join mood m using (wk);

  -- 2) Cumplimiento por día de la semana (días cerrados del periodo)
  select jsonb_agg(jsonb_build_object(
           'isodow', x.dow,
           'scheduled', x.sch,
           'done', x.dn,
           'pct', case when x.sch > 0 then round(100.0 * x.dn / x.sch) end
         ) order by x.dow)
    into v_weekday
    from (
      select g.dow, coalesce(sum(s.scheduled), 0) as sch, coalesce(sum(s.done), 0) as dn
      from generate_series(1, 7) g(dow)
      left join private.day_stats(v_user, v_start, v_today - 1) s
             on extract(isodow from s.day)::int = g.dow
      group by g.dow
    ) x;

  -- 3) Ranking por hábito (activos)
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', h.id, 'name', h.name, 'icon', h.icon,
           'rate_30d', private.habit_rate_30d(h.id),
           'current_streak', st.current_streak,
           'best_streak', st.best_streak,
           'streak_unit', st.streak_unit
         ) order by private.habit_rate_30d(h.id) desc nulls last, h.name), '[]'::jsonb)
    into v_habits
    from public.habits h
    cross join lateral private.habit_streak(h.id) st
   where h.user_id = v_user and h.archived_on is null;

  -- 4) Resumen
  select * into v_perfect from private.perfect_day_streak(v_user);
  select count(*) filter (where scheduled > 0 and done = scheduled), count(*) filter (where scheduled > 0)
    into v_pdays, v_sdays
    from private.day_stats(v_user, v_today - 29, v_today - 1);

  return jsonb_build_object(
    'today',              v_today,
    'weeks',              v_weeks,
    'weekly',             coalesce(v_weekly, '[]'::jsonb),
    'weekday',            coalesce(v_weekday, '[]'::jsonb),
    'habits',             v_habits,
    'perfect_day_streak', v_perfect.current_streak,
    'perfect_day_best',   v_perfect.best_streak,
    'perfect_days_30d',   v_pdays,
    'active_days_30d',    v_sdays
  );
end $$;

revoke execute on function private.habit_rate_30d(uuid) from public, anon, authenticated;
revoke execute on function public.get_stats(int) from public, anon;
grant  execute on function public.get_stats(int) to authenticated;
