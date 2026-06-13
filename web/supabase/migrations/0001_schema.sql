-- GKD Championship — initial schema
-- Apply in the Supabase SQL editor (or `supabase db push`).

create type category as enum ('F1', 'F2');

-- ── Core entities ────────────────────────────────────────────────────────────

create table drivers (
  id          uuid primary key default gen_random_uuid(),
  alias       text not null unique,
  full_name   text,
  email       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  escuderia   text not null,
  category    category not null,
  driver1_id  uuid references drivers(id),
  driver2_id  uuid references drivers(id),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (name, category)
);

create table races (
  id          uuid primary key default gen_random_uuid(),
  date        date not null unique,
  month_label text not null,          -- "Marzo", "Abril", ...
  is_official boolean not null default true,
  notes       text,
  created_at  timestamptz not null default now()
);

-- One row per driver per official race per category.
create table race_results (
  id               uuid primary key default gen_random_uuid(),
  race_id          uuid not null references races(id) on delete cascade,
  driver_id        uuid not null references drivers(id),
  category         category not null,
  position         int not null check (position >= 1),
  best_time        numeric,            -- seconds
  is_reserve       boolean not null default false,
  replaced_team_id uuid references teams(id),
  created_at       timestamptz not null default now(),
  unique (race_id, driver_id, category),
  check (not is_reserve or replaced_team_id is not null)
);

-- All session lap times (championship AND practice days).
-- Feeds Vuelta Rápida / Variaciones.
create table lap_times (
  id           uuid primary key default gen_random_uuid(),
  driver_id    uuid not null references drivers(id),
  session_date date not null,
  best_time    numeric not null,       -- seconds
  source       text not null default 'karteando',
  created_at   timestamptz not null default now(),
  unique (driver_id, session_date)
);

create table dotd (
  id         uuid primary key default gen_random_uuid(),
  race_id    uuid not null references races(id) on delete cascade,
  driver_id  uuid not null references drivers(id),
  category   category not null,
  reason     text,
  created_at timestamptz not null default now(),
  unique (race_id, category)
);

create table media (
  id         uuid primary key default gen_random_uuid(),
  tipo       text not null check (tipo in ('Foto', 'YouTube', 'Instagram')),
  titulo     text not null,
  url        text not null,
  fecha      date,
  created_at timestamptz not null default now()
);

-- Karteando web name -> driver alias (migrated from name_mapping.json).
create table name_mappings (
  id         uuid primary key default gen_random_uuid(),
  web_name   text not null unique,
  driver_id  uuid not null references drivers(id),
  created_at timestamptz not null default now()
);

-- Scoring configuration (single row).
create table scoring_config (
  id                       int primary key default 1 check (id = 1),
  f1_max_points            int not null default 16,
  f2_max_points            int not null default 16,
  participation_point      numeric not null default 1,
  dotd_point               numeric not null default 1,
  reserve_team_factor      numeric not null default 0.5,
  team_participation_point numeric not null default 1
);
insert into scoring_config default values;

-- Admin allowlist: Google emails allowed to write.
create table admins (
  email      text primary key,
  created_at timestamptz not null default now()
);

-- ── Row Level Security: public read, admin-only write ───────────────────────

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from admins
    where email = coalesce(auth.jwt() ->> 'email', '')
  );
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'drivers','teams','races','race_results','lap_times',
    'dotd','media','name_mappings','scoring_config','admins'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "%s_public_read" on %I for select using (true)', t, t);
    execute format(
      'create policy "%s_admin_write" on %I for all using (is_admin()) with check (is_admin())', t, t);
  end loop;
end $$;
