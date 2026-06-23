-- Official race start time for countdown (local Chile time, stored as time-of-day).
alter table races
  add column if not exists start_time time not null default '12:00:00';
