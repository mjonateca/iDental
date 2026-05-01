create table if not exists public.email_notifications (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  type text not null default 'reminder',
  status text not null default 'pending',
  recipient_email text,
  recipient_name text,
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.email_notifications enable row level security;

create policy "Shop owner manages email notifications" on public.email_notifications
  for all using (
    shop_id in (select id from public.shops where owner_id = auth.uid())
  );
