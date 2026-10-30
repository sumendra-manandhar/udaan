-- Hardening from Supabase's security and performance advisors.

-- 1. Internal helpers must not be callable through the public API (/rest/v1/rpc).
--    check_spot is only a trigger; is_moderator moves to a private schema that
--    the API does not expose, but which RLS policies can still call.
revoke execute on function public.check_spot() from public, anon, authenticated;

create schema if not exists private;
grant usage on schema private to anon, authenticated;

create or replace function private.is_moderator()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'moderator');
$$;
revoke execute on function private.is_moderator() from public;
grant execute on function private.is_moderator() to anon, authenticated;

-- check_spot now uses the private helper.
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
  elsif new.status is distinct from old.status and not private.is_moderator() then
    new.status := old.status;
  end if;
  if new.airport_warning then
    new.is_private := true;
    if new.status = 'approved' then new.status := 'rejected'; end if;
  end if;
  -- An edit to the location sends an approved spot back to review.
  if tg_op = 'UPDATE' and (new.lat <> old.lat or new.lng <> old.lng) and not private.is_moderator() then
    new.status := 'pending';
  end if;
  return new;
end $$;
revoke execute on function public.check_spot() from public, anon, authenticated;

-- 2. Policies: evaluate auth.uid() once per query, not once per row.
drop policy profiles_insert on public.profiles;
drop policy profiles_update on public.profiles;
create policy profiles_insert on public.profiles for insert with check (id = (select auth.uid()));
create policy profiles_update on public.profiles for update using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy spots_read on public.spots;
drop policy spots_insert on public.spots;
drop policy spots_update on public.spots;
create policy spots_read on public.spots for select using (
  (status = 'approved' and not is_private) or created_by = (select auth.uid()) or (select private.is_moderator())
);
create policy spots_insert on public.spots for insert with check (created_by = (select auth.uid()));
create policy spots_update on public.spots for update
  using (created_by = (select auth.uid()) or (select private.is_moderator()))
  with check (created_by = (select auth.uid()) or (select private.is_moderator()));

drop policy events_insert on public.events;
drop policy events_update on public.events;
create policy events_insert on public.events for insert with check (host_id = (select auth.uid()));
create policy events_update on public.events for update using (host_id = (select auth.uid())) with check (host_id = (select auth.uid()));

drop policy rsvps_insert on public.rsvps;
drop policy rsvps_update on public.rsvps;
create policy rsvps_insert on public.rsvps for insert with check (user_id = (select auth.uid()));
create policy rsvps_update on public.rsvps for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy flights_read on public.flights;
drop policy flights_insert on public.flights;
drop policy flights_update on public.flights;
create policy flights_read on public.flights for select using (is_public or pilot_id = (select auth.uid()));
create policy flights_insert on public.flights for insert with check (pilot_id = (select auth.uid()));
create policy flights_update on public.flights for update using (pilot_id = (select auth.uid())) with check (pilot_id = (select auth.uid()));

drop policy hire_read on public.hire_requests;
drop policy hire_insert on public.hire_requests;
drop policy hire_update on public.hire_requests;
create policy hire_read on public.hire_requests for select
  using (requester_id = (select auth.uid()) or pilot_id = (select auth.uid()));
create policy hire_insert on public.hire_requests for insert
  with check (requester_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = pilot_id and p.for_hire));
create policy hire_update on public.hire_requests for update
  using (requester_id = (select auth.uid()) or pilot_id = (select auth.uid()))
  with check (requester_id = (select auth.uid()) or pilot_id = (select auth.uid()));

-- The old public helper is no longer used.
drop function public.is_moderator();

-- 3. Index the foreign keys.
create index if not exists events_host_idx on public.events (host_id);
create index if not exists events_spot_idx on public.events (spot_id);
create index if not exists flights_pilot_idx on public.flights (pilot_id);
create index if not exists flights_spot_idx on public.flights (spot_id);
create index if not exists hire_pilot_idx on public.hire_requests (pilot_id);
create index if not exists hire_requester_idx on public.hire_requests (requester_id);
create index if not exists rsvps_user_idx on public.rsvps (user_id);
create index if not exists spots_created_by_idx on public.spots (created_by);
