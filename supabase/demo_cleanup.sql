-- Removes all sample content before launch.

-- Sample content added to real accounts (IDs starting 00000000-0000-4000-b).
delete from public.hire_requests where id::text like '00000000-0000-4000-b%';
delete from public.rsvps where id::text like '00000000-0000-4000-b%';
delete from public.flights where id::text like '00000000-0000-4000-b%';
delete from public.events where id::text like '00000000-0000-4000-b%';
delete from public.spots where id::text like '00000000-0000-4000-b%';

-- Demo pilots from demo_seed.sql. Deleting the auth users cascades to their
-- profiles, spots, events, RSVPs, flights and hire requests.
delete from auth.users where email like '%@udaan-demo.invalid';
