-- Pilot photos via Supabase Storage + photo_url on drivers.
-- Run in the Supabase SQL editor.

alter table drivers add column if not exists photo_url text;

-- Public bucket for pilot/team photos.
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict (id) do nothing;

-- Anyone can view; only admins can upload/replace/delete.
create policy "fotos_public_read" on storage.objects
  for select using (bucket_id = 'fotos');

create policy "fotos_admin_insert" on storage.objects
  for insert with check (bucket_id = 'fotos' and is_admin());

create policy "fotos_admin_update" on storage.objects
  for update using (bucket_id = 'fotos' and is_admin());

create policy "fotos_admin_delete" on storage.objects
  for delete using (bucket_id = 'fotos' and is_admin());
