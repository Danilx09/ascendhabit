-- =====================================================================
-- AscendHabit · Cambiar la frase del diario sin perder textos
--              + orden manual de hábitos (arrastrar)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Diario: clave envuelta
--    wrapped_key = la clave del diario cifrada con la frase. Cambiar la frase
--    solo reemplaza sal + wrapped_key; los textos no se tocan.
--    Null = diario creado antes (la clave sale directamente de la frase).
-- ---------------------------------------------------------------------
alter table public.journal_keys
  add column if not exists wrapped_key text check (wrapped_key like 'v1:%');

create or replace function public.get_journal_day(p_date date default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_user  uuid := auth.uid();
  v_today date;
  v_date  date;
begin
  if v_user is null then raise exception 'No autenticado'; end if;
  v_today := private.user_today(v_user);
  v_date  := least(coalesce(p_date, v_today), v_today);

  return jsonb_build_object(
    'today', v_today,
    'date',  v_date,
    'entry', (select to_jsonb(e) - 'user_id' from public.journal_entries e
               where e.user_id = v_user and e.entry_date = v_date),
    'prev_date', (select max(entry_date) from public.journal_entries
                   where user_id = v_user and entry_date < v_date),
    'next_date', (select min(entry_date) from public.journal_entries
                   where user_id = v_user and entry_date > v_date and entry_date <= v_today),
    'total_entries', (select count(*) from public.journal_entries where user_id = v_user),
    'key', (select jsonb_build_object('salt', k.salt, 'iterations', k.iterations,
                                      'verifier', k.verifier, 'wrapped_key', k.wrapped_key)
              from public.journal_keys k where k.user_id = v_user)
  );
end $$;

-- setup / reset aceptan ahora la clave envuelta (se reemplazan las versiones de 3 parámetros)
drop function if exists public.setup_journal_key(text, int, text);
drop function if exists public.reset_journal_key(text, int, text);

create or replace function public.setup_journal_key(p_salt text, p_iterations int, p_verifier text, p_wrapped_key text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  insert into public.journal_keys (user_id, salt, iterations, verifier, wrapped_key)
  values (auth.uid(), p_salt, p_iterations, p_verifier, p_wrapped_key);
exception when unique_violation then
  raise exception 'Ya tienes una frase configurada';
end $$;

create or replace function public.reset_journal_key(p_salt text, p_iterations int, p_verifier text, p_wrapped_key text default null)
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  update public.journal_entries
     set free_journal = null, q_gratitude = null, q_challenge = null, q_learning = null, updated_at = now()
   where user_id = auth.uid()
     and coalesce(free_journal, q_gratitude, q_challenge, q_learning) is not null;
  get diagnostics n = row_count;
  insert into public.journal_keys (user_id, salt, iterations, verifier, wrapped_key)
  values (auth.uid(), p_salt, p_iterations, p_verifier, p_wrapped_key)
  on conflict (user_id) do update
    set salt = excluded.salt, iterations = excluded.iterations,
        verifier = excluded.verifier, wrapped_key = excluded.wrapped_key, created_at = now();
  return n;
end $$;

-- Cambiar la frase. p_current_salt evita pisar un cambio hecho a la vez en otro dispositivo.
create or replace function public.change_journal_passphrase(
  p_current_salt text, p_salt text, p_iterations int, p_wrapped_key text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if p_wrapped_key is null then raise exception 'Falta la clave envuelta'; end if;
  update public.journal_keys
     set salt = p_salt, iterations = p_iterations, wrapped_key = p_wrapped_key
   where user_id = auth.uid() and salt = p_current_salt;
  if not found then
    raise exception 'La frase cambió en otro dispositivo';
  end if;
end $$;

revoke execute on function public.setup_journal_key(text, int, text, text),
                           public.reset_journal_key(text, int, text, text),
                           public.change_journal_passphrase(text, text, int, text) from public, anon;
grant  execute on function public.setup_journal_key(text, int, text, text),
                           public.reset_journal_key(text, int, text, text),
                           public.change_journal_passphrase(text, text, int, text) to authenticated;

-- ---------------------------------------------------------------------
-- 2) Orden manual de hábitos
-- ---------------------------------------------------------------------
-- Punto de partida: el orden que se veía hasta ahora (prioridad, luego antigüedad)
with o as (
  select id, row_number() over (partition by user_id order by priority, sort_order, created_at) as rn
  from public.habits
)
update public.habits h set sort_order = o.rn from o where h.id = o.id;

-- Los hábitos nuevos van al final de la lista
create or replace function private.habits_set_defaults()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.start_date is null then
    new.start_date := private.user_today(new.user_id);
  end if;
  if coalesce(new.sort_order, 0) = 0 then
    select coalesce(max(sort_order), 0) + 1 into new.sort_order
      from public.habits where user_id = new.user_id;
  end if;
  return new;
end $$;

-- Guarda el orden: p_ids = todos (o parte de) los hábitos del usuario, en el orden deseado
create or replace function public.reorder_habits(p_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  update public.habits h
     set sort_order = x.ord
    from unnest(p_ids) with ordinality as x(id, ord)
   where h.id = x.id and h.user_id = auth.uid();
end $$;

revoke execute on function public.reorder_habits(uuid[]) from public, anon;
grant  execute on function public.reorder_habits(uuid[]) to authenticated;

-- Hoy y el correo usan el orden manual
create or replace function public.get_today()
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
         ) order by h.sort_order, h.created_at), '[]'::jsonb)
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

create or replace function private.reminder_payload(p_user uuid, p_test boolean default false)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_today      date := private.user_today(p_user);
  v_week_start date := date_trunc('week', private.user_today(p_user))::date;
  v_pending    jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'name',      h.name,
           'icon',      h.icon,
           'kind',      case when h.frequency_type = 'times_per_week' then 'weekly'
                             when h.goal_type <> 'boolean' then 'amount'
                             else 'check' end,
           'value',     coalesce(l.value, 0),
           'target',    h.target_value,
           'unit',      h.unit,
           'week_done', (select count(*) from public.habit_logs w
                          where w.habit_id = h.id and w.log_date between v_week_start and v_today
                            and (w.is_completed or w.recovered_via is not null)),
           'times_per_week', h.times_per_week
         ) order by h.sort_order, h.created_at), '[]'::jsonb)
    into v_pending
    from public.habits h
    left join public.habit_logs l on l.habit_id = h.id and l.log_date = v_today
   where h.user_id = p_user
     and h.archived_on is null
     and h.start_date <= v_today
     and not coalesce(l.is_completed or l.recovered_via is not null, false)
     and (
       private.is_scheduled(h, v_today)
       or (h.frequency_type = 'times_per_week'
           and (select count(*) from public.habit_logs w
                 where w.habit_id = h.id and w.log_date between v_week_start and v_today
                   and (w.is_completed or w.recovered_via is not null)) < h.times_per_week)
     );

  return jsonb_build_object(
    'email',            (select u.email from auth.users u where u.id = p_user),
    'name',             (select p.display_name from public.profiles p where p.id = p_user),
    'locale',           coalesce((select p.locale from public.profiles p where p.id = p_user), 'es'),
    'today',            v_today,
    'pending',          v_pending,
    'journal_written',  exists (select 1 from public.journal_entries j
                                 where j.user_id = p_user and j.entry_date = v_today
                                   and j.free_journal is not null),
    'recovery_pending', (select count(*) from public.streak_recovery_requests r
                          where r.approver_id = p_user and r.status = 'pending'
                            and r.created_at >= now() - private.cfg_recovery_expiry()),
    'test',             p_test
  );
end $$;
