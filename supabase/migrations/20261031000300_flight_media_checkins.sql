-- Flights can carry photos and clips, and can be logged with media only
-- (many FPV quads have no GPS, so there's no track to upload).
alter table public.flights add column if not exists media jsonb not null default '[]'::jsonb;
alter table public.flights add column if not exists notes text check (char_length(notes) <= 1000);
alter table public.flights drop constraint if exists flights_source_check;
alter table public.flights add constraint flights_source_check check (source in ('gpx', 'csv', 'media'));

-- Check-ins: a pilot marks that they're flying at a spot. The app only allows
-- it when the phone's location is near the spot; the location itself is not
-- stored. checked_in_at comes from the phone, so check-ins made offline keep
-- the time they happened rather than the time they synced.
create table if not exists public.checkins (
  id uuid primary key,
  spot_id uuid not null references public.spots (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  note text check (char_length(note) <= 140),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists checkins_spot_idx on public.checkins (spot_id, checked_in_at desc);
create index if not exists checkins_user_idx on public.checkins (user_id);
create index if not exists checkins_updated_idx on public.checkins (updated_at);
create trigger checkins_touch before insert or update on public.checkins
  for each row execute function public.touch_updated_at();

-- Keep phone-supplied times sensible: not in the future, not more than 30
-- days old (an offline phone can sync late, but not that late).
create or replace function public.check_checkin_time()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.checked_in_at > now() + interval '10 minutes' or new.checked_in_at < now() - interval '30 days' then
    new.checked_in_at := now();
  end if;
  return new;
end $$;
create trigger checkins_time before insert on public.checkins
  for each row execute function public.check_checkin_time();

alter table public.checkins enable row level security;
create policy checkins_read on public.checkins for select using (true);
create policy checkins_insert on public.checkins for insert with check (user_id = (select auth.uid()));
create policy checkins_update on public.checkins for update
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
