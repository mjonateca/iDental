-- ============================================================
-- iDental — Add-ons y detalles enriquecidos de reserva
-- Inspirado en funcionalidades públicas de Fresha:
-- group appointments y service add-ons.
-- ============================================================

alter table public.bookings
  add column if not exists guest_count integer not null default 1,
  add column if not exists notes text,
  add column if not exists base_amount numeric(10, 2) not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_guest_count_check'
  ) then
    alter table public.bookings
      add constraint bookings_guest_count_check check (guest_count between 1 and 8);
  end if;
end
$$;

create table if not exists public.service_addons (
  id           uuid primary key default uuid_generate_v4(),
  service_id   uuid not null references public.services(id) on delete cascade,
  name         text not null,
  price        numeric(10, 2) not null default 0,
  duration_min integer not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

create index if not exists service_addons_service_id_idx on public.service_addons(service_id);

create table if not exists public.booking_addons (
  booking_id         uuid not null references public.bookings(id) on delete cascade,
  addon_id           uuid not null references public.service_addons(id) on delete cascade,
  name_snapshot      text not null,
  price_snapshot     numeric(10, 2) not null default 0,
  duration_snapshot  integer not null default 0,
  primary key (booking_id, addon_id)
);
