do $$
begin
  if exists (select 1 from pg_type where typname = 'notification_channel') then
    begin
      alter type public.notification_channel add value 'email';
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;

alter table public.shops
  add column if not exists banner_image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shop-assets',
  'shop-assets',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
