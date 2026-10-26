-- =============================================================
-- Assistente do Casal – schema completo
-- Rode este arquivo inteiro no Supabase: SQL Editor > New query.
-- Pode ser executado de novo sem perder dados (idempotente).
-- =============================================================

create extension if not exists pgcrypto;

-- -------------------------------------------------------------
-- Casa (household) e perfis
-- -------------------------------------------------------------
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Nossa casa',
  invite_code text not null unique default upper(substr(md5(random()::text), 1, 6)),
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  display_name text not null default 'Eu',
  avatar text not null default '🙂',
  weekly_study_goal_minutes int not null default 150,
  daily_water_goal int not null default 8,
  created_at timestamptz not null default now()
);

-- Casa do usuário logado. SECURITY DEFINER evita recursão nas políticas RLS.
create or replace function public.my_household()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from public.profiles where id = auth.uid()
$$;

-- Cria o perfil automaticamente no cadastro.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Cria uma casa nova e coloca o usuário nela.
create or replace function public.create_household(p_name text)
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  h public.households;
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;
  insert into public.households (name) values (coalesce(nullif(trim(p_name), ''), 'Nossa casa'))
  returning * into h;
  update public.profiles set household_id = h.id where id = auth.uid();
  return h;
end;
$$;

-- Entra na casa de outra pessoa pelo código de convite.
create or replace function public.join_household(p_code text)
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  h public.households;
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;
  select * into h from public.households where invite_code = upper(trim(p_code));
  if h.id is null then
    raise exception 'Código de convite não encontrado';
  end if;
  update public.profiles set household_id = h.id where id = auth.uid();
  return h;
end;
$$;

alter table public.households enable row level security;
alter table public.profiles enable row level security;

drop policy if exists households_select on public.households;
create policy households_select on public.households
  for select using (id = public.my_household());

drop policy if exists households_update on public.households;
create policy households_update on public.households
  for update using (id = public.my_household());

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or household_id = public.my_household());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- -------------------------------------------------------------
-- Treinos
-- -------------------------------------------------------------
create table if not exists public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household() references public.households (id) on delete cascade,
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  assigned_to uuid references public.profiles (id) on delete set null,
  name text not null,
  description text,
  emoji text not null default '💪',
  weekdays int[] not null default '{}', -- 0 = domingo ... 6 = sábado
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.plan_exercises (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household() references public.households (id) on delete cascade,
  plan_id uuid not null references public.workout_plans (id) on delete cascade,
  position int not null default 0,
  name text not null,
  sets int,
  reps text,          -- "12", "10-12", "30s"
  load text,          -- "8 kg", "elástico verde"
  rest_seconds int,
  notes text
);

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household() references public.households (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  plan_id uuid references public.workout_plans (id) on delete set null,
  plan_name text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_minutes int,
  completion text check (completion in ('completo', 'parcial', 'nao')),
  effort int check (effort between 1 and 5),  -- 1 = leve ... 5 = exaustivo
  mood text,                                   -- emoji escolhido
  feeling_note text,
  created_at timestamptz not null default now()
);

create table if not exists public.session_exercises (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household() references public.households (id) on delete cascade,
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  position int not null default 0,
  exercise_name text not null,
  planned text,
  done boolean not null default false,
  note text
);

-- -------------------------------------------------------------
-- Dieta
-- -------------------------------------------------------------
create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household() references public.households (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  eaten_on date not null default current_date,
  meal_type text not null check (meal_type in ('cafe', 'lanche_manha', 'almoco', 'lanche_tarde', 'jantar', 'ceia')),
  description text not null,
  feeling text check (feeling in ('otimo', 'ok', 'pesado')),
  on_plan boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.water_logs (
  household_id uuid not null default public.my_household() references public.households (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  day date not null default current_date,
  glasses int not null default 0,
  primary key (user_id, day)
);

-- -------------------------------------------------------------
-- Gastos
-- -------------------------------------------------------------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household() references public.households (id) on delete cascade,
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  paid_by uuid references public.profiles (id) on delete set null,
  amount numeric(12, 2) not null check (amount >= 0),
  description text not null,
  merchant text,
  category text not null default 'outros',
  payment_method text,
  spent_on date not null default current_date,
  receipt_path text,
  items jsonb,
  source text not null default 'manual' check (source in ('manual', 'nota')),
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------
-- Atividades
-- -------------------------------------------------------------
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household() references public.households (id) on delete cascade,
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  assigned_to uuid references public.profiles (id) on delete set null, -- null = os dois
  title text not null,
  notes text,
  category text not null default 'casa',
  due_on date,
  due_time time,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------
-- Perfumes
-- -------------------------------------------------------------
create table if not exists public.perfumes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household() references public.households (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null,
  brand text,
  concentration text,  -- EDP, EDT, Parfum, Body splash...
  notes text,          -- notas olfativas
  family text,         -- floral, amadeirado, cítrico, oriental...
  favorite boolean not null default false,
  wishlist boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.perfume_wears (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household() references public.households (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  perfume_id uuid not null references public.perfumes (id) on delete cascade,
  worn_on date not null default current_date,
  occasion text,
  weather text,
  rating int check (rating between 1 and 5),
  compliment boolean not null default false,
  note text,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------
-- Estudos (idiomas)
-- -------------------------------------------------------------
create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household() references public.households (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  language text not null,
  kind text not null,      -- vocabulario, gramatica, leitura, escuta, conversa, escrita, app, aula
  minutes int not null check (minutes > 0),
  studied_on date not null default current_date,
  mood text,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.vocab_cards (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household() references public.households (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  language text not null,
  term text not null,
  translation text not null,
  example text,
  box int not null default 1 check (box between 1 and 5),  -- caixas de Leitner
  next_review date not null default current_date,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------
-- RLS: tudo visível e editável pelos membros da mesma casa
-- -------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'workout_plans', 'plan_exercises', 'workout_sessions', 'session_exercises',
    'meals', 'water_logs', 'expenses', 'activities',
    'perfumes', 'perfume_wears', 'study_sessions', 'vocab_cards'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_household', t);
    execute format(
      'create policy %I on public.%I for all using (household_id = public.my_household()) with check (household_id = public.my_household())',
      t || '_household', t
    );
  end loop;
end;
$$;

create index if not exists workout_sessions_user_idx on public.workout_sessions (user_id, started_at desc);
create index if not exists meals_user_day_idx on public.meals (user_id, eaten_on);
create index if not exists expenses_household_day_idx on public.expenses (household_id, spent_on desc);
create index if not exists activities_household_due_idx on public.activities (household_id, done, due_on);
create index if not exists perfume_wears_day_idx on public.perfume_wears (household_id, worn_on desc);
create index if not exists study_sessions_user_day_idx on public.study_sessions (user_id, studied_on desc);
create index if not exists vocab_cards_review_idx on public.vocab_cards (user_id, next_review);

-- -------------------------------------------------------------
-- Storage: fotos das notas fiscais (bucket privado)
-- Caminho dos arquivos: <household_id>/<uuid>.jpg
-- -------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists receipts_select on storage.objects;
create policy receipts_select on storage.objects
  for select using (bucket_id = 'receipts' and (storage.foldername(name))[1] = public.my_household()::text);

drop policy if exists receipts_insert on storage.objects;
create policy receipts_insert on storage.objects
  for insert with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = public.my_household()::text);

drop policy if exists receipts_delete on storage.objects;
create policy receipts_delete on storage.objects
  for delete using (bucket_id = 'receipts' and (storage.foldername(name))[1] = public.my_household()::text);
