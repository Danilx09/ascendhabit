-- =====================================================================
-- AscendHabit · Español / English
--   · profiles.locale: idioma elegido (lo usa el correo de recordatorio)
--   · Plantillas y categorías del sistema con nombre en inglés
--   · El recordatorio envía datos en bruto + idioma; el texto lo arma la app
-- =====================================================================

alter table public.profiles
  add column locale text check (locale in ('es', 'en'));

grant update (locale) on public.profiles to authenticated;

-- Plantillas
alter table public.habit_templates
  add column name_en        text,
  add column description_en text,
  add column unit_en        text;

update public.habit_templates set name_en = v.n, description_en = v.d, unit_en = v.u
from (values
  ('Beber agua',                    'Drink water',          'Stay hydrated through the day',          'glasses'),
  ('Definir las 3 prioridades',     'Set 3 priorities',     'Pick the 3 tasks that would make the day a success', null),
  ('Moverse 30 minutos',            'Move for 30 minutes',  'Walk, train, cycle… anything goes',      'min'),
  ('Meditar',                       'Meditate',             'Breathing or guided meditation',         'min'),
  ('Leer',                          'Read',                 'Paper or digital book, not social media', 'pages'),
  ('Sin pantallas antes de dormir', 'No screens before bed', '30 minutes without your phone before bed', null),
  ('Diario de gratitud',            'Gratitude journal',    'Write 3 things you''re grateful for',    null)
) as v(es, n, d, u)
where public.habit_templates.name = v.es;

-- Categorías del sistema
alter table public.categories add column name_en text;

update public.categories set name_en = v.n
from (values
  ('Salud', 'Health'), ('Fitness', 'Fitness'), ('Mente', 'Mind'),
  ('Aprendizaje', 'Learning'), ('Productividad', 'Productivity'), ('Descanso', 'Rest')
) as v(es, n)
where public.categories.user_id is null and public.categories.name = v.es;

-- Recordatorio: datos neutrales (sin frases en español) + idioma del usuario
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

revoke execute on function private.reminder_payload(uuid, boolean) from public, anon, authenticated;
