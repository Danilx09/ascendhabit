-- =====================================================================
-- AscendHabit · Recordatorios diarios por email
--
--   pg_cron (cada hora) ──▶ private.dispatch_reminders()
--        └─ por cada usuario cuya hora local = su hora de recordatorio
--           y que aún tiene algo pendiente hoy
--   pg_net  ──POST + Bearer secreto──▶ https://<tu-app>/api/reminders (Vercel)
--        └─ nodemailer ──SMTP Gmail──▶ bandeja de entrada
--
-- Requiere 2 secretos en Supabase Vault (ver README):
--   reminder_endpoint  → https://ascendhabit.vercel.app/api/reminders
--   reminder_secret    → la misma cadena aleatoria que REMINDER_SECRET en Vercel
-- =====================================================================

-- Preferencias (por defecto desactivado: cada uno lo activa en Ajustes)
alter table public.profiles
  add column reminder_enabled   boolean  not null default false,
  add column reminder_hour      smallint not null default 20 check (reminder_hour between 0 and 23),
  add column reminder_last_sent date,
  add column reminder_test_at   timestamptz;

grant update (reminder_enabled, reminder_hour) on public.profiles to authenticated;

-- pg_net (peticiones HTTP desde Postgres). Viene en Supabase; aquí solo se activa.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
  end if;
end $$;

-- Lee un secreto de Supabase Vault (null si no existe o si Vault no está disponible)
create function private.secret(p_name text)
returns text language plpgsql stable security definer set search_path = '' as $$
declare v text;
begin
  if to_regclass('vault.decrypted_secrets') is null then return null; end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1'
    into v using p_name;
  return v;
end $$;

-- Contenido del recordatorio de un usuario (sin nada del diario: está cifrado)
create function private.reminder_payload(p_user uuid, p_test boolean default false)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_today      date := private.user_today(p_user);
  v_week_start date := date_trunc('week', private.user_today(p_user))::date;
  v_pending    jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'name',   h.name,
           'icon',   h.icon,
           'detail', case
                       when h.frequency_type = 'times_per_week' then
                         (select count(*) from public.habit_logs w
                           where w.habit_id = h.id and w.log_date between v_week_start and v_today
                             and (w.is_completed or w.recovered_via is not null))
                         || '/' || h.times_per_week || ' esta semana'
                       when h.goal_type <> 'boolean' then
                         trim(coalesce(l.value, 0)::text || ' / ' || h.target_value::text || ' ' || coalesce(h.unit, ''))
                       else null
                     end
         ) order by h.priority, h.sort_order), '[]'::jsonb)
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

-- Envía la petición a la app (un solo POST con todos los recordatorios del momento)
create function private.post_reminders(p_reminders jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_url    text := private.secret('reminder_endpoint');
  v_secret text := private.secret('reminder_secret');
  v_id     bigint;
begin
  if v_url is null or v_secret is null then
    raise exception 'Faltan los secretos reminder_endpoint / reminder_secret en Supabase Vault';
  end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 30000)'
    into v_id
    using v_url,
          jsonb_build_object('reminders', p_reminders),
          jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret);
  return v_id;
end $$;

-- Lo ejecuta pg_cron cada hora en punto
create function private.dispatch_reminders()
returns int language plpgsql security definer set search_path = '' as $$
declare
  r       record;
  v_list  jsonb := '[]'::jsonb;
  v_p     jsonb;
begin
  for r in
    select p.id
      from public.profiles p
     where p.reminder_enabled
       and extract(hour from now() at time zone p.timezone)::int = p.reminder_hour
       and (p.reminder_last_sent is null or p.reminder_last_sent < private.user_today(p.id))
  loop
    v_p := private.reminder_payload(r.id, false);
    update public.profiles set reminder_last_sent = (v_p->>'today')::date where id = r.id;
    -- Día ya completo y nada que aprobar → no molestar
    if jsonb_array_length(v_p->'pending') = 0 and (v_p->>'recovery_pending')::int = 0 then
      continue;
    end if;
    v_list := v_list || jsonb_build_array(v_p);
  end loop;

  if jsonb_array_length(v_list) > 0 then
    perform private.post_reminders(v_list);
  end if;
  return jsonb_array_length(v_list);
end $$;

-- Botón "Enviar correo de prueba" (máx. 1 cada 2 minutos)
create function public.send_test_reminder()
returns void language plpgsql security definer set search_path = '' as $$
declare v_last timestamptz;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select reminder_test_at into v_last from public.profiles where id = auth.uid();
  if v_last is not null and v_last > now() - interval '2 minutes' then
    raise exception 'Espera un par de minutos antes de enviar otra prueba';
  end if;
  update public.profiles set reminder_test_at = now() where id = auth.uid();
  perform private.post_reminders(jsonb_build_array(private.reminder_payload(auth.uid(), true)));
end $$;

revoke execute on function private.secret(text), private.reminder_payload(uuid, boolean),
  private.post_reminders(jsonb), private.dispatch_reminders() from public, anon, authenticated;
revoke execute on function public.send_test_reminder() from public, anon;
grant  execute on function public.send_test_reminder() to authenticated;

-- Programación: cada hora en punto
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('send-daily-reminders', '0 * * * *', 'select private.dispatch_reminders()');
  else
    raise notice 'pg_cron no disponible: programa private.dispatch_reminders() manualmente';
  end if;
end $$;
