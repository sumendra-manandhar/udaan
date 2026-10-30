-- Airport no-fly rings.
-- IMPORTANT: this list is NOT complete. Before launch, add every aerodrome from
-- AIP Nepal (caanepal.gov.np) and confirm the radius with CAAN. Set
-- verified = true only after checking each row against the official source.
insert into public.airports (name, icao, lat, lng, radius_m, verified) values
  ('Tribhuvan International Airport', 'VNKT', 27.6966, 85.3591, 5000, false);

-- Make yourself a moderator (run once, with your auth user id):
-- update public.profiles set role = 'moderator' where username = 'sumendra';
