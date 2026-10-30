-- Udaan schema: offline-first sync tables.
-- Every synced table has: id uuid (client-generated), updated_at (server clock,
-- set by trigger, used as the pull cursor) and deleted_at (soft delete, so
-- deletions sync to other devices).

create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null check (char_length(display_name) between 1 and 60),
  bio text check (char_length(bio) <= 280),
  home_base text,
  styles text[] not null default '{}',
  for_hire boolean not null default false,
  services jsonb not null default '[]'::jsonb,   -- [{title, price}]
  builds jsonb not null default '[]'::jsonb,     -- [{name, specs}]
  uin_registered boolean not null default false,
  avatar_path text,
  role text not null default 'pilot' check (role in ('pilot', 'moderator')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Pilots cannot promote themselves to moderator. Requests from signed-in users
-- carry auth.uid(); the SQL editor and service role do not, so admins can still
-- set roles there.
create or replace function public.protect_profile_role()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.role := 'pilot';
  elsif new.role is distinct from old.role then
    new.role := old.role;
  end if;
  return new;
end $$;

create trigger profiles_role before insert or update on public.profiles
  for each row execute function public.protect_profile_role();
create trigger profiles_touch before insert or update on public.profiles
  for each row execute function public.touch_updated_at();

create or replace function public.is_moderator()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'moderator');
$$;

-- ---------------------------------------------------------------------------
-- Airports: the 5 km no-fly rings. Keep this list complete from AIP Nepal.
-- ---------------------------------------------------------------------------
create table public.airports (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icao text,
  lat double precision not null,
  lng double precision not null,
  radius_m integer not null default 5000,
  verified boolean not null default false,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create trigger airports_touch before insert or update on public.airports
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Spots
-- ---------------------------------------------------------------------------
create table public.spots (
  id uuid primary key,
  created_by uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  type text not null check (type in ('ridge', 'lake', 'field', 'track', 'indoor', 'other')),
  lat double precision not null check (lat between 26 and 31),
  lng double precision not null check (lng between 80 and 89),
  geom extensions.geography(point, 4326) generated always as (extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography) stored,
  best_time text,
  notes text check (char_length(notes) <= 2000),
  is_private boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  airport_warning boolean not null default false,
  media jsonb not null default '[]'::jsonb,       -- [{path, kind: 'image'|'video'}]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index spots_geom_idx on public.spots using gist (geom);
create index spots_updated_idx on public.spots (updated_at);

-- Server-side safety net: never let a spot inside an airport ring go public,
-- and only moderators can change status.
create or replace function public.check_spot()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  -- Generated columns (geom) are not computed yet in a BEFORE trigger, so the
  -- point is built from lat/lng here.
  new.airport_warning := exists (
    select 1 from airports a
    where a.deleted_at is null
      and st_dwithin(
        st_setsrid(st_makepoint(new.lng, new.lat), 4326)::geography,
        st_setsrid(st_makepoint(a.lng, a.lat), 4326)::geography,
        a.radius_m)
  );
  if tg_op = 'INSERT' then
    new.status := 'pending';
  elsif new.status is distinct from old.status and not public.is_moderator() then
    new.status := old.status;
  end if;
  if new.airport_warning then
    new.is_private := true;
    if new.status = 'approved' then new.status := 'rejected'; end if;
  end if;
  -- An edit to the location sends an approved spot back to review.
  if tg_op = 'UPDATE' and (new.lat <> old.lat or new.lng <> old.lng) and not public.is_moderator() then
    new.status := 'pending';
  end if;
  return new;
end $$;

create trigger spots_check before insert or update on public.spots
  for each row execute function public.check_spot();
create trigger spots_touch before insert or update on public.spots
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Events and RSVPs
-- ---------------------------------------------------------------------------
create table public.events (
  id uuid primary key,
  host_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 100),
  kind text not null check (kind in ('race', 'group', 'indoor', 'workshop', 'meetup')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  venue_name text not null,
  spot_id uuid references public.spots (id) on delete set null,
  lat double precision,
  lng double precision,
  description text check (char_length(description) <= 4000),
  bring text,
  capacity integer check (capacity is null or capacity > 0),
  fee text,
  approval_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index events_updated_idx on public.events (updated_at);
create trigger events_touch before insert or update on public.events
  for each row execute function public.touch_updated_at();

create table public.rsvps (
  id uuid primary key,
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'going' check (status in ('going', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (event_id, user_id)
);
create index rsvps_updated_idx on public.rsvps (updated_at);
create trigger rsvps_touch before insert or update on public.rsvps
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Flights (parsed on device; track and series stored compactly)
-- ---------------------------------------------------------------------------
create table public.flights (
  id uuid primary key,
  pilot_id uuid not null references public.profiles (id) on delete cascade,
  spot_id uuid references public.spots (id) on delete set null,
  title text not null check (char_length(title) between 1 and 100),
  flown_at timestamptz,
  duration_s integer,
  max_alt_m real,
  distance_m real,
  source text not null default 'gpx' check (source in ('gpx', 'csv')),
  track jsonb not null default '[]'::jsonb,     -- [[lng, lat, alt_m, t_s], ...]
  series jsonb not null default '{}'::jsonb,    -- {t: [], throttle: [], vbat: [], alt: []}
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index flights_updated_idx on public.flights (updated_at);
create trigger flights_touch before insert or update on public.flights
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Hire requests
-- ---------------------------------------------------------------------------
create table public.hire_requests (
  id uuid primary key,
  pilot_id uuid not null references public.profiles (id) on delete cascade,
  requester_id uuid not null references public.profiles (id) on delete cascade,
  shoot_type text not null,
  location text not null,
  shoot_date date,
  budget text,
  contact text not null,
  message text not null check (char_length(message) <= 2000),
  status text not null default 'sent' check (status in ('sent', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (pilot_id <> requester_id)
);
create index hire_updated_idx on public.hire_requests (updated_at);
create trigger hire_touch before insert or update on public.hire_requests
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.airports enable row level security;
alter table public.spots enable row level security;
alter table public.events enable row level security;
alter table public.rsvps enable row level security;
alter table public.flights enable row level security;
alter table public.hire_requests enable row level security;

-- Profiles: public read, owner write.
create policy profiles_read on public.profiles for select using (true);
create policy profiles_insert on public.profiles for insert with check (id = auth.uid());
create policy profiles_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- Airports: public read; managed by service role / dashboard.
create policy airports_read on public.airports for select using (true);

-- Spots: approved public spots for everyone; owners see their own; moderators see all.
create policy spots_read on public.spots for select using (
  (status = 'approved' and not is_private) or created_by = auth.uid() or public.is_moderator()
);
create policy spots_insert on public.spots for insert with check (created_by = auth.uid());
create policy spots_update on public.spots for update
  using (created_by = auth.uid() or public.is_moderator())
  with check (created_by = auth.uid() or public.is_moderator());

-- Events: public read; host write.
create policy events_read on public.events for select using (true);
create policy events_insert on public.events for insert with check (host_id = auth.uid());
create policy events_update on public.events for update using (host_id = auth.uid()) with check (host_id = auth.uid());

-- RSVPs: public read (counts and who's going); own write.
create policy rsvps_read on public.rsvps for select using (true);
create policy rsvps_insert on public.rsvps for insert with check (user_id = auth.uid());
create policy rsvps_update on public.rsvps for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Flights: public ones for everyone, private ones for the pilot.
create policy flights_read on public.flights for select using (is_public or pilot_id = auth.uid());
create policy flights_insert on public.flights for insert with check (pilot_id = auth.uid());
create policy flights_update on public.flights for update using (pilot_id = auth.uid()) with check (pilot_id = auth.uid());

-- Hire requests: only the two people involved.
create policy hire_read on public.hire_requests for select
  using (requester_id = auth.uid() or pilot_id = auth.uid());
create policy hire_insert on public.hire_requests for insert
  with check (requester_id = auth.uid() and exists (select 1 from profiles p where p.id = pilot_id and p.for_hire));
create policy hire_update on public.hire_requests for update
  using (requester_id = auth.uid() or pilot_id = auth.uid())
  with check (requester_id = auth.uid() or pilot_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage: public media bucket, each user writes under their own folder.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 52428800,
        array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do nothing;

create policy media_read on storage.objects for select using (bucket_id = 'media');
create policy media_write on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy media_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
