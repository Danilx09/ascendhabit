-- =====================================================================
-- AscendHabit · Paso 4: gestión de hábitos
--   · get_habit_detail(): calendario mensual + estadísticas de un hábito
--   · set_habit_archived(): archivar / restaurar (con fecha en zona del usuario)
--   · Editar la meta actualiza también el registro de HOY (no los pasados)
-- =====================================================================

-- 1) El registro de HOY usa siempre la meta vigente; los días pasados conservan la suya
create or replace function private.guard_habit_log()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  h       public.habits;
  v_today date;
  v_row   public.habit_logs;
  v_grace constant int := 0;   -- días de gracia para editar (0 = solo hoy)
begin
  if current_user not in ('authenticated', 'anon') then
    if tg_op = 'DELETE' then return old; end if;
    new.updated_at := now();
    return new;
  end if;

  v_row   := case when tg_op = 'DELETE' then old else new end;
  v_today := (now() at time zone coalesce(
               (select p.timezone from public.profiles p where p.id = auth.uid()),
               'America/Bogota'))::date;

  if v_row.log_date > v_today then
    raise exception 'No puedes registrar días futuros';
  end if;
  if v_row.log_date < v_today - v_grace then
    raise exception 'Ese día ya cerró. Usa "Solicitar recuperación de racha".';
  end if;
  if tg_op = 'DELETE' then
    if old.recovered_via is not null then
      raise exception 'Un día recuperado no se puede borrar';
    end if;
    return old;
  end if;

  select * into h from public.habits where id = new.habit_id;
  if not found or h.user_id <> auth.uid() then
    raise exception 'Hábito no encontrado';
  end if;

  new.user_id    := auth.uid();
  new.updated_at := now();

  if tg_op = 'INSERT' then
    if new.recovered_via is not null then
      raise exception 'recovered_via solo lo asigna la aprobación del socio';
    end if;
    new.target_snapshot := h.target_value;
  else
    if new.recovered_via is distinct from old.recovered_via
       or new.habit_id is distinct from old.habit_id
       or new.log_date is distinct from old.log_date then
      raise exception 'Campo no editable';
    end if;
    new.target_snapshot := case when old.log_date = v_today then h.target_value
                                else old.target_snapshot end;
  end if;
  return new;
end $$;

-- 2) Al cambiar la meta de un hábito, el registro de hoy se ajusta a la nueva meta
create function private.sync_today_target()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.habit_logs
     set target_snapshot = new.target_value
   where habit_id = new.id
     and log_date = private.user_today(new.user_id)
     and recovered_via is null;
  return new;
end $$;

create trigger habits_sync_today_target
  after update of target_value on public.habits
  for each row when (old.target_value is distinct from new.target_value)
  execute function private.sync_today_target();

-- 3) Archivar / restaurar.
--    Restaurar reinicia start_date a hoy: los días archivados no cuentan como fallos.
create function public.set_habit_archived(p_habit_id uuid, p_archived boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_today date := private.user_today(auth.uid());
begin
  if p_archived then
    update public.habits
       set archived_on = greatest(v_today, start_date)
     where id = p_habit_id and user_id = auth.uid() and archived_on is null;
  else
    update public.habits
       set archived_on = null, start_date = v_today
     where id = p_habit_id and user_id = auth.uid() and archived_on is not null;
  end if;
  if not found then raise exception 'Hábito no encontrado'; end if;
end $$;

-- 4) Detalle de un hábito: calendario de un mes + estadísticas
create function public.get_habit_detail(p_habit_id uuid, p_month date default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  h        public.habits;
  v_today  date;
  v_from   date;
  v_to     date;
  v_days   jsonb;
  st       record;
  v_ok     int;
  v_den    int;
  v_total  int;
  v_rec    int;
begin
  select * into h from public.habits where id = p_habit_id and user_id = auth.uid();
  if not found then raise exception 'Hábito no encontrado'; end if;

  v_today := private.user_today(h.user_id);
  v_from  := date_trunc('month', coalesce(p_month, v_today))::date;
  v_to    := (v_from + interval '1 month' - interval '1 day')::date;

  select * into st from private.habit_streak(h.id);

  -- Calendario del mes
  select jsonb_agg(jsonb_build_object(
           'date',      g.day::date,
           'scheduled', case when h.frequency_type = 'times_per_week'
                             then g.day::date >= h.start_date
                                  and (h.archived_on is null or g.day::date < h.archived_on)
                             else private.is_scheduled(h, g.day::date) end,
           'value',     coalesce(l.value, 0),
           'target',    coalesce(l.target_snapshot, h.target_value),
           'done',      coalesce(l.is_completed, false),
           'recovered', l.recovered_via is not null
         ) order by g.day)
    into v_days
    from generate_series(v_from, v_to, interval '1 day') g(day)
    left join public.habit_logs l on l.habit_id = h.id and l.log_date = g.day::date;

  -- Cumplimiento de los últimos 30 días (hoy solo cuenta si ya está hecho)
  if h.frequency_type = 'times_per_week' then
    -- Últimas 4 semanas completas: min(hechos, meta) / meta
    select coalesce(sum(least(c.n, h.times_per_week)), 0), coalesce(sum(h.times_per_week), 0)
      into v_ok, v_den
      from (
        select w::date as wk,
               (select count(*) from public.habit_logs l
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

  select count(*) filter (where is_completed or recovered_via is not null),
         count(*) filter (where recovered_via is not null)
    into v_total, v_rec
    from public.habit_logs where habit_id = h.id;

  return jsonb_build_object(
    'habit',           to_jsonb(h),
    'today',           v_today,
    'month',           v_from,
    'current_streak',  st.current_streak,
    'best_streak',     st.best_streak,
    'streak_unit',     st.streak_unit,
    'rate_30d',        case when v_den > 0 then round(100.0 * v_ok / v_den) end,
    'total_done',      v_total,
    'recovered_count', v_rec,
    'days',            coalesce(v_days, '[]'::jsonb)
  );
end $$;

revoke execute on function private.sync_today_target() from public, anon, authenticated;
revoke execute on function public.set_habit_archived(uuid, boolean), public.get_habit_detail(uuid, date) from public, anon;
grant  execute on function public.set_habit_archived(uuid, boolean), public.get_habit_detail(uuid, date) to authenticated;
