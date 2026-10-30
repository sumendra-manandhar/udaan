-- Removes everything added by demo_seed.sql. Deleting the demo auth users
-- cascades to their profiles, spots, events, RSVPs and flights.
delete from auth.users where email like '%@udaan-demo.invalid';
