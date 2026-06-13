-- Team photos (custom team cards from Drive / admin uploads).
alter table teams add column if not exists photo_url text;
