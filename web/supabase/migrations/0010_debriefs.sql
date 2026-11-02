-- Debrief articles: one per official race day (both categories).
-- Public reads published rows; admins draft / regenerate / publish.

create table debriefs (
  id                uuid primary key default gen_random_uuid(),
  race_id           uuid not null unique references races(id) on delete cascade,
  status            text not null default 'draft' check (status in ('draft', 'published')),
  title             text not null,
  excerpt           text not null default '',
  body              jsonb not null,
  facts             jsonb not null,
  featured_aliases  text[] not null default '{}',
  generated_by      text not null default 'template' check (generated_by in ('llm', 'template')),
  published_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table debriefs enable row level security;

create policy "debriefs_public_read" on debriefs
  for select using (status = 'published' or is_admin());

create policy "debriefs_admin_write" on debriefs
  for all using (is_admin()) with check (is_admin());
