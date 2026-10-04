-- =====================================================================
-- AscendHabit · Paso 3: Panel de Accountability y rescates
--   · get_recoverable_misses(): días fallados que todavía se pueden rescatar
--     (dentro de la ventana de 48 h, sin solicitud previa y con cupo mensual)
--   · get_partner_info(): estado del vínculo con el socio
-- =====================================================================

create function public.get_recoverable_misses()
returns table (
  habit_id        uuid,
  habit_name      text,
  habit_icon      text,
  habit_color     text,
  missed_date     date,
  used_this_month int,
  monthly_max     int,
  partner_name    text
) language plpgsql stable security definer set search_path = '' as $$
declare
  v_user    uuid := auth.uid();
  v_partner uuid;
  v_today   date;
begin
  if v_user is null then raise exception 'No autenticado'; end if;
  v_partner := private.active_partner(v_user);
  if v_partner is null then return; end if;   -- sin socio no hay rescates
  v_today := private.user_today(v_user);

  return query
  select h.id, h.name, h.icon, h.color, d.day::date,
         used.n::int, private.cfg_recovery_monthly_max(),
         (select p.display_name from public.profiles p where p.id = v_partner)
  from public.habits h
  cross join generate_series(v_today - private.cfg_recovery_window_days(),
                             v_today - 1, interval '1 day') as d(day)
  cross join lateral (
    select count(*) as n
    from public.streak_recovery_requests r
    where r.habit_id = h.id
      and r.status in ('pending', 'approved')
      and date_trunc('month', r.missed_date) = date_trunc('month', d.day)
  ) used
  where h.user_id = v_user
    and h.frequency_type <> 'times_per_week'      -- los semanales no tienen día fallado
    and private.is_scheduled(h, d.day::date)
    and not exists (select 1 from public.habit_logs l
                     where l.habit_id = h.id and l.log_date = d.day::date
                       and (l.is_completed or l.recovered_via is not null))
    and not exists (select 1 from public.streak_recovery_requests r
                     where r.habit_id = h.id and r.missed_date = d.day::date)
    and used.n < private.cfg_recovery_monthly_max()
  order by d.day desc, h.priority, h.sort_order;
end $$;

create function public.get_partner_info()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'invite_code', (select invite_code from public.profiles where id = auth.uid()),
    'partner_id',  private.active_partner(auth.uid()),
    'partner_name', (select display_name from public.profiles
                      where id = private.active_partner(auth.uid())),
    'since', (select created_at from public.partnerships
               where status = 'active' and auth.uid() in (user_a, user_b))
  )
$$;

revoke execute on function public.get_recoverable_misses(), public.get_partner_info() from public, anon;
grant  execute on function public.get_recoverable_misses(), public.get_partner_info() to authenticated;
