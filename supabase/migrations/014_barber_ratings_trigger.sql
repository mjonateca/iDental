-- Trigger to keep barbers.rating updated from reviews table
create or replace function public.update_barber_rating_from_reviews()
returns trigger language plpgsql as $$
begin
  update public.barbers
  set rating = coalesce((
    select round(avg(rating)::numeric, 1)
    from public.reviews
    where barber_id = coalesce(new.barber_id, old.barber_id)
  ), 0)
  where id = coalesce(new.barber_id, old.barber_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_update_barber_rating on public.reviews;
create trigger trg_update_barber_rating
  after insert or update or delete on public.reviews
  for each row execute function public.update_barber_rating_from_reviews();
