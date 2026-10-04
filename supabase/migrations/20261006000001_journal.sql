-- =====================================================================
-- AscendHabit · Diario personal + Bitácora emocional
--   · Una fila por usuario y día (journal_entries)
--   · 100 % privado: solo el dueño. Ninguna función de socio lo lee.
--   · Cifrado de extremo a extremo: los textos llegan YA cifrados desde el
--     dispositivo (AES-GCM, clave derivada de una frase con PBKDF2). La base de
--     datos solo acepta valores con prefijo "v1:" → nunca guarda texto en claro.
--     mood_score y primary_emotion van sin cifrar para poder hacer estadísticas.
--   · Escritura por RPC con "patch": el autoguardado envía solo los campos
--     que cambiaron, así el diario y la bitácora no se pisan entre sí.
-- =====================================================================

-- Parámetros de la clave de cada usuario (NO la clave: solo sal + verificador)
create table public.journal_keys (
  user_id    uuid primary key default auth.uid() references auth.users on delete cascade,
  salt       text not null,               -- base64, 16 bytes aleatorios
  iterations int  not null check (iterations >= 100000),
  verifier   text not null check (verifier like 'v1:%'),  -- texto conocido cifrado: comprueba la frase
  created_at timestamptz not null default now()
);
alter table public.journal_keys enable row level security;
create policy "journal_keys: leer la propia" on public.journal_keys for select to authenticated
  using (user_id = (select auth.uid()));

create table public.journal_entries (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users on delete cascade,
  entry_date      date not null,
  -- Campos cifrados: "v1:<iv base64>:<datos base64>"
  free_journal    text check (free_journal like 'v1:%' and char_length(free_journal) <= 120000),
  mood_score      smallint check (mood_score between 1 and 5),        -- nivel de energía
  primary_emotion text check (char_length(primary_emotion) <= 30),   -- palabra clave / tag
  q_gratitude     text check (q_gratitude like 'v1:%' and char_length(q_gratitude) <= 12000), -- ¿qué salió bien / qué agradezco?
  q_challenge     text check (q_challenge like 'v1:%' and char_length(q_challenge) <= 12000), -- emoción difícil y cómo la gestioné
  q_learning      text check (q_learning  like 'v1:%' and char_length(q_learning)  <= 12000), -- ¿qué haré mejor mañana?
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, entry_date)
);

alter table public.journal_entries enable row level security;

-- Lectura y borrado directos solo del dueño; la escritura pasa por save_journal_entry()
create policy "journal: leer el propio" on public.journal_entries for select to authenticated
  using (user_id = (select auth.uid()));
create policy "journal: borrar el propio" on public.journal_entries for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- save_journal_entry(fecha, patch)
--   patch = {"free_journal": "...", "mood_score": 4, ...}  (solo las claves presentes se tocan;
--   una clave con valor null borra ese campo)
-- ---------------------------------------------------------------------
create function public.save_journal_entry(p_date date, p_patch jsonb)
returns public.journal_entries language plpgsql security definer set search_path = '' as $$
declare
  v_user  uuid := auth.uid();
  v_today date;
  r       public.journal_entries;
  k       text;
begin
  if v_user is null then raise exception 'No autenticado'; end if;
  v_today := private.user_today(v_user);
  if p_date is null or p_date > v_today then
    raise exception 'No puedes escribir en días futuros';
  end if;

  for k in select jsonb_object_keys(coalesce(p_patch, '{}'::jsonb)) loop
    if k not in ('free_journal', 'mood_score', 'primary_emotion', 'q_gratitude', 'q_challenge', 'q_learning') then
      raise exception 'Campo desconocido: %', k;
    end if;
  end loop;

  insert into public.journal_entries (user_id, entry_date)
  values (v_user, p_date)
  on conflict (user_id, entry_date) do nothing;

  update public.journal_entries e set
    free_journal    = case when p_patch ? 'free_journal'    then nullif(p_patch->>'free_journal', '')                 else e.free_journal end,
    mood_score      = case when p_patch ? 'mood_score'      then (p_patch->>'mood_score')::smallint                   else e.mood_score end,
    primary_emotion = case when p_patch ? 'primary_emotion' then nullif(lower(trim(p_patch->>'primary_emotion')), '') else e.primary_emotion end,
    q_gratitude     = case when p_patch ? 'q_gratitude'     then nullif(p_patch->>'q_gratitude', '')                  else e.q_gratitude end,
    q_challenge     = case when p_patch ? 'q_challenge'     then nullif(p_patch->>'q_challenge', '')                  else e.q_challenge end,
    q_learning      = case when p_patch ? 'q_learning'      then nullif(p_patch->>'q_learning', '')                   else e.q_learning end,
    updated_at      = now()
  where e.user_id = v_user and e.entry_date = p_date
  returning * into r;

  return r;
end $$;

-- ---------------------------------------------------------------------
-- get_journal_day(fecha): la entrada de un día + navegación entre días con entrada
-- ---------------------------------------------------------------------
create function public.get_journal_day(p_date date default null)
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
    'key', (select jsonb_build_object('salt', k.salt, 'iterations', k.iterations, 'verifier', k.verifier)
              from public.journal_keys k where k.user_id = v_user)
  );
end $$;

-- ---------------------------------------------------------------------
-- get_journal_month(mes): resumen por día para el calendario / historial
-- ---------------------------------------------------------------------
create function public.get_journal_month(p_month date default null)
returns table (
  entry_date      date,
  mood_score      smallint,
  primary_emotion text,
  has_journal     boolean,
  has_reflection  boolean
) language sql stable security definer set search_path = '' as $$
  select e.entry_date, e.mood_score, e.primary_emotion,
         e.free_journal is not null,
         coalesce(e.q_gratitude, e.q_challenge, e.q_learning) is not null
  from public.journal_entries e
  where e.user_id = auth.uid()
    and e.entry_date >= date_trunc('month', coalesce(p_month, private.user_today(auth.uid())))::date
    and e.entry_date <  date_trunc('month', coalesce(p_month, private.user_today(auth.uid())))::date + interval '1 month'
  order by e.entry_date desc
$$;

-- ---------------------------------------------------------------------
-- Configurar la frase por primera vez
-- ---------------------------------------------------------------------
create function public.setup_journal_key(p_salt text, p_iterations int, p_verifier text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  insert into public.journal_keys (user_id, salt, iterations, verifier)
  values (auth.uid(), p_salt, p_iterations, p_verifier);
exception when unique_violation then
  raise exception 'Ya tienes una frase configurada';
end $$;

-- ---------------------------------------------------------------------
-- Olvidé la frase: nueva clave y se BORRAN los textos cifrados
-- (energía y emoción se conservan porque no están cifradas)
-- ---------------------------------------------------------------------
create function public.reset_journal_key(p_salt text, p_iterations int, p_verifier text)
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  update public.journal_entries
     set free_journal = null, q_gratitude = null, q_challenge = null, q_learning = null, updated_at = now()
   where user_id = auth.uid()
     and coalesce(free_journal, q_gratitude, q_challenge, q_learning) is not null;
  get diagnostics n = row_count;
  insert into public.journal_keys (user_id, salt, iterations, verifier)
  values (auth.uid(), p_salt, p_iterations, p_verifier)
  on conflict (user_id) do update
    set salt = excluded.salt, iterations = excluded.iterations,
        verifier = excluded.verifier, created_at = now();
  return n;
end $$;

revoke execute on function public.setup_journal_key(text, int, text), public.reset_journal_key(text, int, text) from public, anon;
grant  execute on function public.setup_journal_key(text, int, text), public.reset_journal_key(text, int, text) to authenticated;

revoke execute on function public.save_journal_entry(date, jsonb), public.get_journal_day(date),
  public.get_journal_month(date) from public, anon;
grant execute on function public.save_journal_entry(date, jsonb), public.get_journal_day(date),
  public.get_journal_month(date) to authenticated;
