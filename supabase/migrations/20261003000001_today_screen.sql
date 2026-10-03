-- =====================================================================
-- AscendHabit · Paso 2: pantalla "Hoy"
--   · get_today(): todo lo que necesita la pantalla en UNA llamada
--   · log_habit(): registra el progreso de HOY (fecha calculada en el servidor)
--   · habits.user_id por defecto = usuario autenticado
--   · habits.start_date por defecto = "hoy" en la zona del usuario (no UTC)
-- =====================================================================

alter table public.habits alter column user_id set default auth.uid();

-- start_date: current_date usa UTC → a las 8 p. m. en Bogotá ya sería "mañana".
alter table public.habits alter column start_date drop default;

create function private.habits_set_defaults()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.start_date is null then
    new.start_date := private.user_today(new.user_id);
  end if;
  return new;
end $$;

create trigger habits_defaults
  before insert on public.habits
  for each row execute function private.habits_set_defaults();

-- ---------------------------------------------------------------------
-- get_today()
-- ---------------------------------------------------------------------
create function public.get_today()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_user       uuid := auth.uid();
  v_today      date;
  v_week_start date;
  v_s          int;
  v_d          int;
  v_perfect    record;
  v_habits     jsonb;
  v_pending    int;
begin
  if v_user is null then raise exception 'No autenticado'; end if;

  v_today      := private.user_today(v_user);
  v_week_start := date_trunc('week', v_today)::date;

  select scheduled, done into v_s, v_d from private.day_stats(v_user, v_today, v_today);
  select * into v_perfect from private.perfect_day_streak(v_user);

  select count(*) into v_pending
    from public.streak_recovery_requests r
   where r.approver_id = v_user and r.status = 'pending'
     and r.created_at >= now() - private.cfg_recovery_expiry();

  select coalesce(jsonb_agg(jsonb_build_object(
           'id',                 h.id,
           'name',               h.name,
           'description',        h.description,
           'icon',               h.icon,
           'color',              h.color,
           'category_id',        h.category_id,
           'goal_type',          h.goal_type,
           'target_value',       h.target_value,
           'unit',               h.unit,
           'frequency_type',     h.frequency_type,
           'frequency_days',     h.frequency_days,
           'times_per_week',     h.times_per_week,
           'priority',           h.priority,
           'time_of_day',        h.time_of_day,
           'share_with_partner', h.share_with_partner,
           'scheduled_today',    h.frequency_type = 'times_per_week' or private.is_scheduled(h, v_today),
           'value_today',        coalesce(l.value, 0),
           'done_today',         coalesce(l.is_completed or l.recovered_via is not null, false),
           'week_done',          (select count(*) from public.habit_logs wl
                                   where wl.habit_id = h.id
                                     and wl.log_date between v_week_start and v_today
                                     and (wl.is_completed or wl.recovered_via is not null)),
           'current_streak',     st.current_streak,
           'best_streak',        st.best_streak,
           'streak_unit',        st.streak_unit
         ) order by h.priority, h.sort_order, h.created_at), '[]'::jsonb)
    into v_habits
    from public.habits h
    left join public.habit_logs l on l.habit_id = h.id and l.log_date = v_today
    cross join lateral private.habit_streak(h.id) st
   where h.user_id = v_user
     and h.archived_on is null
     and h.start_date <= v_today;

  return jsonb_build_object(
    'today',                     v_today,
    'display_name',              (select display_name from public.profiles where id = v_user),
    'today_scheduled',           v_s,
    'today_done',                v_d,
    'today_pct',                 case when v_s > 0 then round(100.0 * v_d / v_s) end,
    'perfect_day_streak',        v_perfect.current_streak,
    'perfect_day_best',          v_perfect.best_streak,
    'pending_recovery_requests', v_pending,
    'habits',                    v_habits
  );
end $$;

-- ---------------------------------------------------------------------
-- log_habit(): fija el valor de HOY para un hábito.
-- SECURITY INVOKER → pasa por RLS y por el trigger guard_habit_log.
-- ---------------------------------------------------------------------
create function public.log_habit(p_habit_id uuid, p_value numeric)
returns public.habit_logs language plpgsql security invoker set search_path = '' as $$
declare
  v_today date;
  r       public.habit_logs;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;

  v_today := (now() at time zone coalesce(
               (select p.timezone from public.profiles p where p.id = auth.uid()),
               'America/Bogota'))::date;

  insert into public.habit_logs (habit_id, user_id, log_date, value, target_snapshot)
  values (p_habit_id, auth.uid(), v_today, greatest(coalesce(p_value, 0), 0), 0)  -- el trigger fija la meta
  on conflict (habit_id, log_date) do update set value = excluded.value
  returning * into r;
  return r;
end $$;

-- Permisos
revoke execute on function private.habits_set_defaults() from public, anon, authenticated;
revoke execute on function public.get_today(), public.log_habit(uuid, numeric) from public, anon;
grant  execute on function public.get_today(), public.log_habit(uuid, numeric) to authenticated;
