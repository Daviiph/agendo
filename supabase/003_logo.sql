-- Logo como imagen (comprimida en el navegador, <= 300 KB)
alter table negocios add column if not exists logo_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('agendo-logos', 'agendo-logos', true, 307200, array['image/webp','image/png','image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = 307200, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "agendo_logos_insert" on storage.objects;
drop policy if exists "agendo_logos_update" on storage.objects;
drop policy if exists "agendo_logos_delete" on storage.objects;
create policy "agendo_logos_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'agendo-logos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "agendo_logos_update" on storage.objects for update to authenticated
  using (bucket_id = 'agendo-logos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "agendo_logos_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'agendo-logos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "agendo_logos_select" on storage.objects;
create policy "agendo_logos_select" on storage.objects for select to authenticated
  using (bucket_id = 'agendo-logos' and (storage.foldername(name))[1] = auth.uid()::text);
