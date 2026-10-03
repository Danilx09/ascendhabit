-- =====================================================================
-- AscendHabit · Migración inicial (v1 / MVP)
-- Tablas, RLS, reglas de racha, Día Perfecto, panel de socio y
-- recuperación de racha con aprobación.
--
-- Decisiones del MVP:
--   · Cada usuario solo puede leer y escribir SUS tablas (RLS).
--   · El socio nunca lee tablas ajenas: ve el panel a través de funciones
--     SECURITY DEFINER que devuelven datos agregados.
--   · Los registros solo se editan para "hoy" (zona horaria del usuario).
--     Un día pasado solo se rescata con una solicitud aprobada por el socio.
--   · Recuperación: pedirla ≤ 48 h después del día fallado, máx. 2 por hábito
--     al mes (cuentan las pendientes y las aprobadas) y expira a las 72 h.
-- =====================================================================

create schema if not exists private;   -- helpers internos (no expuestos por la API)

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.goal_type          as enum ('boolean', 'count', 'duration');
create type public.frequency_type     as enum ('daily', 'specific_days', 'times_per_week');
create type public.time_of_day        as enum ('morning', 'afternoon', 'evening', 'anytime');
create type public.partnership_status as enum ('active', 'ended');
create type public.recovery_reason    as enum ('illness', 'travel', 'forgot', 'other');
create type public.recovery_status    as enum ('pending', 'approved', 'rejected', 'expired');

-- ---------------------------------------------------------------------
-- Configuración (un solo lugar para ajustar las reglas)
-- ---------------------------------------------------------------------
create function private.cfg_recovery_window_days()  returns int language sql immutable set search_path = '' as $$ select 2 $$;  -- 48 h tras el día
create function private.cfg_recovery_monthly_max()  returns int language sql immutable set search_path = '' as $$ select 2 $$;
create function private.cfg_recovery_expiry()       returns interval language sql immutable set search_path = '' as $$ select interval '72 hours' $$;

create function private.is_valid_timezone(tz text)
returns boolean language plpgsql stable set search_path = '' as $$
begin
  perform now() at time zone tz;
  return true;
exception when others then
  return false;
end $$;

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text check (char_length(display_name) <= 50),
  timezone     text not null default 'America/Bogota'
               check (private.is_valid_timezone(timezone)),
  invite_code  text not null unique
               default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_at   timestamptz not null default now()
);

create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users on delete cascade,   -- null = categoría del sistema
  name       text not null check (char_length(name) between 1 and 40),
  color      text not null default '#6366F1',
  icon       text,
  sort_order int  not null default 0
);

create table public.habits (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users on delete cascade,
  category_id        uuid references public.categories on delete set null,
  name               text not null check (char_length(name) between 1 and 80),
  description        text,
  icon               text,
  color              text,
  goal_type          public.goal_type not null default 'boolean',
  target_value       numeric not null default 1,
  unit               text,
  frequency_type     public.frequency_type not null default 'daily',
  frequency_days     smallint[],        -- ISO: 1 = lunes … 7 = domingo
  times_per_week     smallint,
  priority           smallint not null default 2 check (priority between 1 and 3),
  time_of_day        public.time_of_day not null default 'anytime',
  reminder_time      time,              -- reservado para recordatorios por email (v1.1)
  share_with_partner boolean not null default false,
  start_date         date not null default current_date,
  archived_on        date,              -- a partir de este día deja de programarse
  sort_order         int not null default 0,
  created_at         timestamptz not null default now(),

  constraint target_matches_goal check (
    (goal_type = 'boolean' and target_value = 1) or
    (goal_type <> 'boolean' and target_value > 0)
  ),
  constraint frequency_is_consistent check (
    (frequency_type = 'daily'
       and frequency_days is null and times_per_week is null) or
    (frequency_type = 'specific_days'
       and cardinality(frequency_days) between 1 and 7
       and frequency_days <@ array[1,2,3,4,5,6,7]::smallint[]
       and times_per_week is null) or
    (frequency_type = 'times_per_week'
       and times_per_week between 1 and 7 and frequency_days is null)
  ),
  constraint archive_after_start check (archived_on is null or archived_on >= start_date)
);
create index habits_user_idx on public.habits (user_id);

create table public.partnerships (
  id         uuid primary key default gen_random_uuid(),
  user_a     uuid not null references auth.users on delete cascade,
  user_b     uuid not null references auth.users on delete cascade,
  status     public.partnership_status not null default 'active',
  created_at timestamptz not null default now(),
  ended_at   timestamptz,
  check (user_a < user_b)                -- (A,B) y (B,A) son la misma pareja
);
-- Un usuario solo puede tener UN socio activo (MVP)
create unique index one_active_partnership_a on public.partnerships (user_a) where status = 'active';
create unique index one_active_partnership_b on public.partnerships (user_b) where status = 'active';

create table public.streak_recovery_requests (
  id           uuid primary key default gen_random_uuid(),
  habit_id     uuid not null references public.habits on delete cascade,
  requester_id uuid not null references auth.users on delete cascade,
  approver_id  uuid not null references auth.users on delete cascade,
  missed_date  date not null,
  reason       public.recovery_reason not null,
  message      text check (char_length(message) <= 280),
  status       public.recovery_status not null default 'pending',
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  check (requester_id <> approver_id),
  unique (habit_id, missed_date)         -- una sola oportunidad por día fallado
);
create index recovery_approver_idx  on public.streak_recovery_requests (approver_id, status);
create index recovery_requester_idx on public.streak_recovery_requests (requester_id, status);

create table public.habit_logs (
  id              uuid primary key default gen_random_uuid(),
  habit_id        uuid not null references public.habits on delete cascade,
  user_id         uuid not null references auth.users on delete cascade,
  log_date        date not null,
  value           numeric not null default 0 check (value >= 0),
  target_snapshot numeric not null,     -- la meta vigente ESE día (lo fija el trigger)
  is_completed    boolean generated always as (value >= target_snapshot) stored,
  recovered_via   uuid references public.streak_recovery_requests on delete set null,
  note            text check (char_length(note) <= 500),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (habit_id, log_date)
);
create index habit_logs_user_date_idx on public.habit_logs (user_id, log_date);

create table public.habit_templates (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  description    text,
  category_name  text,
  icon           text,
  goal_type      public.goal_type not null,
  target_value   numeric not null default 1,
  unit           text,
  frequency_type public.frequency_type not null default 'daily',
  time_of_day    public.time_of_day not null default 'anytime',
  sort_order     int not null default 0
);

-- ---------------------------------------------------------------------
-- Helpers internos
-- ---------------------------------------------------------------------

-- "Hoy" en la zona horaria del usuario
create function private.user_today(p_user uuid)
returns date language sql stable security definer set search_path = '' as $$
  select (now() at time zone coalesce(
            (select p.timezone from public.profiles p where p.id = p_user),
            'America/Bogota'))::date
$$;

create function private.active_partner(p_user uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select case when p.user_a = p_user then p.user_b else p.user_a end
  from public.partnerships p
  where p.status = 'active' and p_user in (p.user_a, p.user_b)
  limit 1
$$;

-- ¿El hábito está programado ese día? (solo hábitos diarios / días específicos)
create function private.is_scheduled(h public.habits, d date)
returns boolean language sql immutable set search_path = '' as $$
  select h.frequency_type <> 'times_per_week'
     and d >= h.start_date
     and (h.archived_on is null or d < h.archived_on)
     and (h.frequency_type = 'daily'
          or extract(isodow from d)::smallint = any (h.frequency_days))
$$;

-- Marca las solicitudes vencidas (también lo hace pg_cron cada 15 min)
create function private.expire_recovery_requests()
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.streak_recovery_requests
     set status = 'expired', resolved_at = now()
   where status = 'pending'
     and created_at < now() - private.cfg_recovery_expiry();
  get diagnostics n = row_count;
  return n;
end $$;

-- Por cada día del rango: hábitos programados y cuántos se cumplieron
-- (un día recuperado cuenta como cumplido)
create function private.day_stats(p_user uuid, p_from date, p_to date)
returns table (day date, scheduled int, done int)
language sql stable security definer set search_path = '' as $$
  select g.day::date,
         count(h.id)::int,
         count(l.id) filter (where l.is_completed or l.recovered_via is not null)::int
  from generate_series(p_from, p_to, interval '1 day') as g(day)
  left join public.habits h
         on h.user_id = p_user
        and private.is_scheduled(h, g.day::date)
  left join public.habit_logs l
         on l.habit_id = h.id and l.log_date = g.day::date
  group by g.day
  order by g.day
$$;

-- Racha actual y mejor racha de un hábito.
-- Diario / días específicos → racha en días programados.
-- Veces por semana          → racha en semanas cumplidas (lunes a domingo).
-- El periodo en curso no rompe la racha hasta que termina.
create function private.habit_streak(p_habit uuid)
returns table (current_streak int, best_streak int, streak_unit text)
language plpgsql stable security definer set search_path = '' as $$
declare
  h       public.habits;
  v_today date;
  v_end   date;
begin
  select * into h from public.habits where id = p_habit;
  if not found then return; end if;

  v_today := private.user_today(h.user_id);
  v_end   := least(v_today, coalesce(h.archived_on - 1, v_today));

  if h.frequency_type = 'times_per_week' then
    return query
    with weeks as (
      select w::date as wk
      from generate_series(date_trunc('week', h.start_date)::date,
                           date_trunc('week', v_end)::date,
                           interval '7 days') w
    ), counted as (
      select wk,
             (select count(*) from public.habit_logs l
               where l.habit_id = h.id
                 and l.log_date between greatest(wk, h.start_date) and wk + 6
                 and (l.is_completed or l.recovered_via is not null)) >= h.times_per_week as ok
      from weeks
    ), filtered as (
      select wk, ok from counted
      where not (wk = date_trunc('week', v_today)::date and not ok)
    ), grouped as (
      select ok, sum(case when ok then 0 else 1 end) over (order by wk) as grp
      from filtered
    )
    select coalesce((select count(*) from grouped
                      where ok and grp = (select max(grp) from grouped)), 0)::int,
           coalesce((select max(c) from (select count(*) c from grouped
                                          where ok group by grp) s), 0)::int,
           'weeks';
  else
    return query
    with days as (
      select d::date as day
      from generate_series(h.start_date, v_end, interval '1 day') d
      where private.is_scheduled(h, d::date)
    ), marked as (
      select days.day,
             coalesce(l.is_completed or l.recovered_via is not null, false) as ok
      from days
      left join public.habit_logs l on l.habit_id = h.id and l.log_date = days.day
    ), filtered as (
      select day, ok from marked where not (day = v_today and not ok)
    ), grouped as (
      select ok, sum(case when ok then 0 else 1 end) over (order by day) as grp
      from filtered
    )
    select coalesce((select count(*) from grouped
                      where ok and grp = (select max(grp) from grouped)), 0)::int,
           coalesce((select max(c) from (select count(*) c from grouped
                                          where ok group by grp) s), 0)::int,
           'days';
  end if;
end $$;

-- Racha de "Día Perfecto": días con ≥ 1 hábito programado y 100 % cumplidos.
-- Los días sin hábitos programados son neutros (ni suman ni rompen).
-- Los hábitos "veces por semana" no participan (no tienen día fijo).
create function private.perfect_day_streak(p_user uuid)
returns table (current_streak int, best_streak int)
language sql stable security definer set search_path = '' as $$
  with bounds as (
    select min(h.start_date) as first_day, private.user_today(p_user) as today
    from public.habits h
    where h.user_id = p_user and h.frequency_type <> 'times_per_week'
  ), stats as (
    select s.*, b.today
    from bounds b, private.day_stats(p_user, b.first_day, b.today) s
  ), filtered as (
    select day, (done = scheduled) as ok
    from stats
    where scheduled > 0
      and not (day = today and done < scheduled)
  ), grouped as (
    select ok, sum(case when ok then 0 else 1 end) over (order by day) as grp
    from filtered
  )
  select coalesce((select count(*) from grouped
                    where ok and grp = (select max(grp) from grouped)), 0)::int,
         coalesce((select max(c) from (select count(*) c from grouped
                                        where ok group by grp) s), 0)::int
$$;

-- Resumen de un usuario. Con p_for_partner = true solo se listan los hábitos
-- compartidos, pero los porcentajes SIEMPRE incluyen todos (también privados).
create function private.user_summary(p_user uuid, p_for_partner boolean)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_today      date := private.user_today(p_user);
  v_week_start date := date_trunc('week', v_today)::date;
  v_today_s    int; v_today_d int;
  v_week_s     int; v_week_d  int;
  v_wk_target  int; v_wk_done int;
  v_perfect    record;
  v_habits     jsonb;
begin
  select scheduled, done into v_today_s, v_today_d
    from private.day_stats(p_user, v_today, v_today);

  select coalesce(sum(scheduled), 0), coalesce(sum(done), 0) into v_week_s, v_week_d
    from private.day_stats(p_user, v_week_start, v_today);

  -- Hábitos "veces por semana": aportan min(hechos, meta) / meta a la semana
  select coalesce(sum(h.times_per_week), 0),
         coalesce(sum(least(h.times_per_week, (
            select count(*) from public.habit_logs l
             where l.habit_id = h.id
               and l.log_date between v_week_start and v_today
               and (l.is_completed or l.recovered_via is not null)))), 0)
    into v_wk_target, v_wk_done
    from public.habits h
   where h.user_id = p_user
     and h.frequency_type = 'times_per_week'
     and h.start_date <= v_today
     and (h.archived_on is null or h.archived_on > v_today);

  select * into v_perfect from private.perfect_day_streak(p_user);

  select coalesce(jsonb_agg(jsonb_build_object(
           'id',             h.id,
           'name',           h.name,
           'icon',           h.icon,
           'color',          h.color,
           'frequency_type', h.frequency_type,
           'scheduled_today',private.is_scheduled(h, v_today),
           'done_today',     coalesce(l.is_completed or l.recovered_via is not null, false),
           'progress_today', coalesce(l.value, 0),
           'target',         h.target_value,
           'unit',           h.unit,
           'current_streak', st.current_streak,
           'best_streak',    st.best_streak,
           'streak_unit',    st.streak_unit
         ) order by h.sort_order, h.created_at), '[]'::jsonb)
    into v_habits
    from public.habits h
    left join public.habit_logs l on l.habit_id = h.id and l.log_date = v_today
    cross join lateral private.habit_streak(h.id) st
   where h.user_id = p_user
     and h.archived_on is null
     and (not p_for_partner or h.share_with_partner);

  return jsonb_build_object(
    'user_id',            p_user,
    'display_name',       (select display_name from public.profiles where id = p_user),
    'today',              v_today,
    'today_scheduled',    v_today_s,
    'today_done',         v_today_d,
    'today_pct',          case when v_today_s > 0 then round(100.0 * v_today_d / v_today_s) end,
    'week_pct',           case when v_week_s + v_wk_target > 0
                               then round(100.0 * (v_week_d + v_wk_done) / (v_week_s + v_wk_target)) end,
    'perfect_day_streak', v_perfect.current_streak,
    'perfect_day_best',   v_perfect.best_streak,
    'habits',             v_habits
  );
end $$;

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------

-- Crear el perfil al registrarse
create function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id,
          coalesce(new.raw_user_meta_data ->> 'display_name',
                   split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Reglas de integridad de los registros cuando escribe el usuario.
-- SECURITY INVOKER a propósito: así current_user = 'authenticated' cuando
-- escribe la app, y = dueño de la función cuando escribe el sistema (RPC).
create function private.guard_habit_log()
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

  select * into h from public.habits where id = new.habit_id;   -- RLS: solo los propios
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
    new.target_snapshot := old.target_snapshot;
  end if;
  return new;
end $$;

create trigger habit_logs_guard
  before insert or update or delete on public.habit_logs
  for each row execute function private.guard_habit_log();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.profiles                 enable row level security;
alter table public.categories               enable row level security;
alter table public.habits                   enable row level security;
alter table public.habit_logs               enable row level security;
alter table public.partnerships             enable row level security;
alter table public.streak_recovery_requests enable row level security;
alter table public.habit_templates          enable row level security;

create policy "profiles: ver el propio"       on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "profiles: editar el propio"    on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "categories: ver sistema y propias" on public.categories for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));
create policy "categories: crear propias"     on public.categories for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "categories: editar propias"    on public.categories for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "categories: borrar propias"    on public.categories for delete to authenticated
  using (user_id = (select auth.uid()));

-- Hábitos y registros: SOLO el dueño. El socio nunca lee estas tablas.
create policy "habits: dueño" on public.habits for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "habit_logs: dueño" on public.habit_logs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Pareja y solicitudes: solo lectura; los cambios pasan por funciones RPC
create policy "partnerships: ver las mías" on public.partnerships for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));
create policy "recovery: ver las mías" on public.streak_recovery_requests for select to authenticated
  using ((select auth.uid()) in (requester_id, approver_id));

create policy "templates: lectura" on public.habit_templates for select to authenticated
  using (true);

-- profiles: el usuario no puede cambiar su invite_code ni su id
revoke update on public.profiles from authenticated, anon;
grant  update (display_name, timezone) on public.profiles to authenticated;

-- ---------------------------------------------------------------------
-- API pública (RPC) · supabase.rpc('nombre', {...})
-- ---------------------------------------------------------------------

-- Rachas de todos mis hábitos activos
create function public.get_my_habit_streaks()
returns table (habit_id uuid, current_streak int, best_streak int, streak_unit text)
language sql stable security definer set search_path = '' as $$
  select h.id, s.current_streak, s.best_streak, s.streak_unit
  from public.habits h
  cross join lateral private.habit_streak(h.id) s
  where h.user_id = auth.uid() and h.archived_on is null
$$;

create function public.get_my_summary()
returns jsonb language sql stable security definer set search_path = '' as $$
  select private.user_summary(auth.uid(), false)
$$;

-- Panel de Accountability: porcentajes y rachas del socio + solo hábitos compartidos
create function public.get_partner_summary()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_partner uuid := private.active_partner(auth.uid());
begin
  if v_partner is null then return null; end if;
  return private.user_summary(v_partner, true);
end $$;

-- Conectar con el socio usando su código de invitación
create function public.connect_partner(p_invite_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_me    uuid := auth.uid();
  v_other uuid;
  v_id    uuid;
begin
  if v_me is null then raise exception 'No autenticado'; end if;
  select id into v_other from public.profiles where invite_code = upper(trim(p_invite_code));
  if v_other is null   then raise exception 'Código no válido'; end if;
  if v_other = v_me    then raise exception 'No puedes ser tu propio socio'; end if;
  if private.active_partner(v_me) is not null or private.active_partner(v_other) is not null then
    raise exception 'Uno de los dos ya tiene un socio activo';
  end if;

  insert into public.partnerships (user_a, user_b)
  values (least(v_me, v_other), greatest(v_me, v_other))
  returning id into v_id;
  return v_id;
end $$;

create function public.end_partnership()
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.partnerships
     set status = 'ended', ended_at = now()
   where status = 'active' and auth.uid() in (user_a, user_b);
  -- Las solicitudes pendientes entre ambos dejan de tener sentido
  update public.streak_recovery_requests
     set status = 'expired', resolved_at = now()
   where status = 'pending' and auth.uid() in (requester_id, approver_id);
end $$;

-- Solicitar recuperación de racha
create function public.request_streak_recovery(
  p_habit_id    uuid,
  p_missed_date date,
  p_reason      public.recovery_reason,
  p_message     text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_me      uuid := auth.uid();
  v_partner uuid;
  v_today   date;
  h         public.habits;
  v_used    int;
  v_id      uuid;
begin
  if v_me is null then raise exception 'No autenticado'; end if;

  select * into h from public.habits where id = p_habit_id and user_id = v_me;
  if not found then raise exception 'Hábito no encontrado'; end if;

  v_partner := private.active_partner(v_me);
  if v_partner is null then raise exception 'Necesitas un socio activo para pedir recuperación'; end if;

  v_today := private.user_today(v_me);
  if p_missed_date >= v_today then
    raise exception 'Solo se pueden recuperar días que ya terminaron';
  end if;
  if p_missed_date < v_today - private.cfg_recovery_window_days() then
    raise exception 'Pasaron más de 48 h desde ese día';
  end if;
  if p_missed_date < h.start_date or (h.archived_on is not null and p_missed_date >= h.archived_on) then
    raise exception 'El hábito no estaba activo ese día';
  end if;
  if h.frequency_type = 'specific_days' and not private.is_scheduled(h, p_missed_date) then
    raise exception 'Ese día no estaba programado para este hábito';
  end if;
  if exists (select 1 from public.habit_logs l
              where l.habit_id = h.id and l.log_date = p_missed_date
                and (l.is_completed or l.recovered_via is not null)) then
    raise exception 'Ese día ya está cumplido';
  end if;

  perform private.expire_recovery_requests();

  select count(*) into v_used
    from public.streak_recovery_requests r
   where r.habit_id = h.id
     and r.status in ('pending', 'approved')
     and date_trunc('month', r.missed_date) = date_trunc('month', p_missed_date);
  if v_used >= private.cfg_recovery_monthly_max() then
    raise exception 'Ya usaste las % recuperaciones de este mes para este hábito',
      private.cfg_recovery_monthly_max();
  end if;

  insert into public.streak_recovery_requests
    (habit_id, requester_id, approver_id, missed_date, reason, message)
  values (h.id, v_me, v_partner, p_missed_date, p_reason, nullif(trim(p_message), ''))
  returning id into v_id;
  return v_id;
exception
  when unique_violation then
    raise exception 'Ya existe una solicitud para ese día';
end $$;

-- Aprobar o rechazar (solo el socio que recibe la solicitud)
create function public.resolve_streak_recovery(p_request_id uuid, p_approve boolean)
returns public.recovery_status language plpgsql security definer set search_path = '' as $$
declare
  r public.streak_recovery_requests;
  h public.habits;
begin
  select * into r from public.streak_recovery_requests where id = p_request_id for update;
  if not found or r.approver_id <> auth.uid() then
    raise exception 'Solicitud no encontrada';
  end if;
  if r.status <> 'pending' then
    raise exception 'La solicitud ya fue resuelta (%)', r.status;
  end if;
  if r.created_at < now() - private.cfg_recovery_expiry() then
    update public.streak_recovery_requests
       set status = 'expired', resolved_at = now() where id = r.id;
    return 'expired';
  end if;
  if private.active_partner(r.requester_id) is distinct from auth.uid() then
    raise exception 'Ya no son socios';
  end if;

  update public.streak_recovery_requests
     set status = case when p_approve then 'approved' else 'rejected' end::public.recovery_status,
         resolved_at = now()
   where id = r.id;

  if p_approve then
    select * into h from public.habits where id = r.habit_id;
    insert into public.habit_logs (habit_id, user_id, log_date, value, target_snapshot, recovered_via)
    values (h.id, h.user_id, r.missed_date, 0, h.target_value, r.id)
    on conflict (habit_id, log_date) do update set recovered_via = excluded.recovered_via;
    return 'approved';
  end if;
  return 'rejected';
end $$;

-- Bandeja de solicitudes (enviadas y recibidas).
-- El nombre del hábito se oculta al socio si el hábito es privado.
create function public.get_recovery_requests()
returns table (
  id uuid, direction text, habit_id uuid, habit_name text, habit_icon text,
  missed_date date, reason public.recovery_reason, message text,
  status public.recovery_status, created_at timestamptz, expires_at timestamptz,
  resolved_at timestamptz
) language plpgsql security definer set search_path = '' as $$
begin
  perform private.expire_recovery_requests();
  return query
  select r.id,
         case when r.requester_id = auth.uid() then 'outgoing' else 'incoming' end,
         r.habit_id,
         case when r.requester_id = auth.uid() or h.share_with_partner
              then h.name else 'Hábito privado' end,
         case when r.requester_id = auth.uid() or h.share_with_partner
              then h.icon else '🔒' end,
         r.missed_date, r.reason, r.message, r.status, r.created_at,
         r.created_at + private.cfg_recovery_expiry(), r.resolved_at
  from public.streak_recovery_requests r
  join public.habits h on h.id = r.habit_id
  where auth.uid() in (r.requester_id, r.approver_id)
  order by r.created_at desc
  limit 50;
end $$;

-- ---------------------------------------------------------------------
-- Permisos de ejecución: solo usuarios autenticados
-- ---------------------------------------------------------------------
revoke all on schema private from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
-- Excepciones mínimas: lo que se evalúa con los permisos del usuario
grant usage   on schema private to authenticated;
grant execute on function private.is_valid_timezone(text) to authenticated;
grant execute on function private.guard_habit_log()      to authenticated;

revoke execute on function
  public.get_my_habit_streaks(), public.get_my_summary(), public.get_partner_summary(),
  public.connect_partner(text), public.end_partnership(),
  public.request_streak_recovery(uuid, date, public.recovery_reason, text),
  public.resolve_streak_recovery(uuid, boolean), public.get_recovery_requests()
from public, anon;

grant execute on function
  public.get_my_habit_streaks(), public.get_my_summary(), public.get_partner_summary(),
  public.connect_partner(text), public.end_partnership(),
  public.request_streak_recovery(uuid, date, public.recovery_reason, text),
  public.resolve_streak_recovery(uuid, boolean), public.get_recovery_requests()
to authenticated;

-- ---------------------------------------------------------------------
-- Expiración automática cada 15 min (pg_cron viene incluido en Supabase)
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('expire-recovery-requests', '*/15 * * * *',
                          'select private.expire_recovery_requests()');
  else
    raise notice 'pg_cron no disponible: la expiración se aplicará de forma diferida en las RPC';
  end if;
end $$;
