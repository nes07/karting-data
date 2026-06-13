-- DOTD public voting: admins nominate candidates with reasons, anyone votes
-- once (picking their name), poll closes at a deadline (e.g. next Thursday).

create table dotd_polls (
  id         uuid primary key default gen_random_uuid(),
  race_id    uuid not null references races(id) on delete cascade,
  category   text not null check (category in ('F1', 'F2')),
  closes_at  timestamptz not null,
  created_at timestamptz not null default now(),
  unique (race_id, category)
);

create table dotd_candidates (
  id        uuid primary key default gen_random_uuid(),
  poll_id   uuid not null references dotd_polls(id) on delete cascade,
  driver_id uuid not null references drivers(id),
  reason    text,
  unique (poll_id, driver_id)
);

create table dotd_votes (
  id              uuid primary key default gen_random_uuid(),
  poll_id         uuid not null references dotd_polls(id) on delete cascade,
  voter_driver_id uuid not null references drivers(id),
  candidate_id    uuid not null references dotd_candidates(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique (poll_id, voter_driver_id)
);

alter table dotd_polls enable row level security;
alter table dotd_candidates enable row level security;
alter table dotd_votes enable row level security;

-- Public read everywhere; admins manage polls/candidates.
create policy "dotd_polls_public_read" on dotd_polls for select using (true);
create policy "dotd_polls_admin_write" on dotd_polls for all
  using (is_admin()) with check (is_admin());

create policy "dotd_candidates_public_read" on dotd_candidates for select using (true);
create policy "dotd_candidates_admin_write" on dotd_candidates for all
  using (is_admin()) with check (is_admin());

create policy "dotd_votes_public_read" on dotd_votes for select using (true);
-- Anyone can vote while the poll is open; the unique constraint blocks a
-- second vote and the lack of update/delete policies makes votes immutable.
create policy "dotd_votes_public_insert" on dotd_votes for insert with check (
  exists (
    select 1 from dotd_polls p
    where p.id = poll_id and now() < p.closes_at
  )
);
create policy "dotd_votes_admin_all" on dotd_votes for all
  using (is_admin()) with check (is_admin());
