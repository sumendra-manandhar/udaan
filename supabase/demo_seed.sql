-- Demo content so the app isn't empty while you show it off.
-- Everything here uses fixed IDs starting with 00000000-0000-4000-a and
-- @udaan-demo.invalid emails, so supabase/demo_cleanup.sql removes it all.
-- Demo users have no password and cannot sign in.
-- Spot locations are real flying areas, but the notes are sample text:
-- check rules and local permission before flying at any of them.

begin;

-- Pilots -------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email,
       '{"provider":"email","providers":["email"]}', '{}', now(), now()
from (values
  ('00000000-0000-4000-a000-000000000001', 'aarav@udaan-demo.invalid'),
  ('00000000-0000-4000-a000-000000000002', 'sita@udaan-demo.invalid'),
  ('00000000-0000-4000-a000-000000000003', 'bikash@udaan-demo.invalid'),
  ('00000000-0000-4000-a000-000000000004', 'nima@udaan-demo.invalid'),
  ('00000000-0000-4000-a000-000000000005', 'ritu@udaan-demo.invalid'),
  ('00000000-0000-4000-a000-000000000006', 'prakash@udaan-demo.invalid')
) as u(id, email)
on conflict (id) do nothing;

insert into public.profiles (id, username, display_name, bio, home_base, styles, for_hire, services, builds, uin_registered) values
  ('00000000-0000-4000-a000-000000000001', 'aarav_fpv', 'Aarav Shrestha',
   'Demo pilot · Racing since 2022. Runs the monthly race nights in the valley.', 'Lalitpur',
   '{racing,freestyle}', false, '[]',
   '[{"name":"5\" race quad","specs":"True-X frame · 2306 motors · F7 FC · analog 5.8 GHz"}]', true),
  ('00000000-0000-4000-a000-000000000002', 'sita_cinematic', 'Sita Gurung',
   'Demo pilot · Cinematic flying around Pokhara lakes and hills. Available for tourism shoots.', 'Pokhara',
   '{cinematic,long-range}', true,
   '[{"title":"Hotel and resort fly-through","price":"NPR 25,000"},{"title":"Trekking and travel promo","price":"NPR 30,000"}]',
   '[{"name":"3.5\" cinewhoop","specs":"Ducted frame · 1804 motors · digital HD · naked action cam"}]', true),
  ('00000000-0000-4000-a000-000000000003', 'bikash_rips', 'Bikash Tamang',
   'Demo pilot · Freestyle on ridges and bandos. One-take real estate tours on request.', 'Kathmandu',
   '{freestyle,cinematic}', true,
   '[{"title":"Real estate one-take tour","price":"NPR 15,000"},{"title":"Event and wedding FPV","price":"NPR 20,000"}]',
   '[{"name":"5\" freestyle","specs":"Apex frame · 2207 motors · F7 FC · digital HD"},{"name":"2.5\" whoop","specs":"Cinewhoop for indoor one-takes"}]', true),
  ('00000000-0000-4000-a000-000000000004', 'nima_longrange', 'Nima Sherpa',
   'Demo pilot · Long-range cruising and mountain views. Always within line of sight and the rules.', 'Bhaktapur',
   '{long-range,cinematic}', false, '[]',
   '[{"name":"7\" long range","specs":"7\" frame · 2806 motors · GPS · long-range receiver"}]', true),
  ('00000000-0000-4000-a000-000000000005', 'ritu_whoops', 'Ritu Maharjan',
   'Demo pilot · Tiny whoops indoors, gates and tight lines. Hosts whoop nights.', 'Kathmandu',
   '{whoops,racing}', false, '[]',
   '[{"name":"65 mm whoop","specs":"1S whoop · analog camera"}]', false),
  ('00000000-0000-4000-a000-000000000006', 'prakash_builds', 'Prakash Karki',
   'Demo pilot · Helps beginners build and tune their first quad. Runs the build nights.', 'Lalitpur',
   '{beginner,freestyle}', false, '[]',
   '[{"name":"First-build 5\"","specs":"Budget 5\" kit · 2207 motors · F4 FC"}]', true)
on conflict (id) do update set
  username = excluded.username, display_name = excluded.display_name, bio = excluded.bio,
  home_base = excluded.home_base, styles = excluded.styles, for_hire = excluded.for_hire,
  services = excluded.services, builds = excluded.builds, uin_registered = excluded.uin_registered;

-- Spots (inserted normally so the airport-ring trigger runs) ------------------
insert into public.spots (id, created_by, name, type, lat, lng, best_time, notes, is_private) values
  ('00000000-0000-4000-a001-000000000001', '00000000-0000-4000-a000-000000000003', 'Nagarkot ridge', 'ridge', 27.7172, 85.5203, 'Sunrise',
   'Ridge lines with open valley and Himalaya views. Launch from the flat ground near the viewpoint; keep well clear of people at the tower and hotels.', false),
  ('00000000-0000-4000-a001-000000000002', '00000000-0000-4000-a000-000000000004', 'Chandragiri hills', 'ridge', 27.6720, 85.2120, 'Sunset',
   'Long cinematic passes over forest. Wind picks up after noon. Stay away from the cable car line.', false),
  ('00000000-0000-4000-a001-000000000003', '00000000-0000-4000-a000-000000000002', 'Taudaha lake', 'lake', 27.6480, 85.2820, 'Morning',
   'Glassy water early in the day. Do not fly low over the birds; respect the temple area.', false),
  ('00000000-0000-4000-a001-000000000004', '00000000-0000-4000-a000-000000000001', 'Godawari field', 'field', 27.5960, 85.3870, 'Any time',
   'Open field used for practice and gates. Ask the caretaker before setting up.', false),
  ('00000000-0000-4000-a001-000000000005', '00000000-0000-4000-a000-000000000004', 'Shivapuri ridge (Nagi Gumba trail)', 'ridge', 27.8030, 85.3770, 'Morning',
   'Inside Shivapuri Nagarjun National Park: park approval needed before flying. Great views when it is clear.', false),
  ('00000000-0000-4000-a001-000000000006', '00000000-0000-4000-a000-000000000003', 'Dhulikhel hills', 'ridge', 27.6200, 85.5580, 'Sunrise',
   'Terraced hills and mountain views. Plenty of open launch spots away from houses.', false),
  ('00000000-0000-4000-a001-000000000007', '00000000-0000-4000-a000-000000000001', 'Sundarijal practice field', 'track', 27.7660, 85.4250, 'Afternoon',
   'Flat field where the race nights set up gates. Bring your own power.', false),
  ('00000000-0000-4000-a001-000000000008', '00000000-0000-4000-a000-000000000005', 'Kirtipur indoor hall', 'indoor', 27.6780, 85.2780, 'Evening',
   'Community hall used for whoop nights. Book through the host; venue rules apply.', false),
  ('00000000-0000-4000-a001-000000000009', '00000000-0000-4000-a000-000000000002', 'Sarangkot ridge', 'ridge', 28.2440, 83.9480, 'Sunrise',
   'Busy paragliding launch: do not fly when gliders are in the air. Check airport rules for Pokhara first.', false),
  ('00000000-0000-4000-a001-000000000010', '00000000-0000-4000-a000-000000000002', 'Begnas lake', 'lake', 28.1730, 84.0950, 'Morning',
   'Quieter than Phewa, with calm water and boats in the morning. Check airport rules for Pokhara first.', false),
  ('00000000-0000-4000-a001-000000000011', '00000000-0000-4000-a000-000000000004', 'Bandipur hilltop', 'ridge', 27.9360, 84.4070, 'Sunset',
   'Old town on a ridge with wide valley views. Fly away from the bazaar and houses.', false),
  ('00000000-0000-4000-a001-000000000012', '00000000-0000-4000-a000-000000000006', 'Kakani hills', 'ridge', 27.8100, 85.2550, 'Morning',
   'Sample spot waiting for moderator review.', false)
on conflict (id) do nothing;

-- Approve all but the last one (the trigger blocks status changes outside a
-- moderator session, so bypass it only for this update).
alter table public.spots disable trigger spots_check;
update public.spots set status = 'approved'
where id::text like '00000000-0000-4000-a001-%' and id <> '00000000-0000-4000-a001-000000000012' and not airport_warning;
alter table public.spots enable trigger spots_check;

-- Events (Nepal time, relative to today) -------------------------------------
insert into public.events (id, host_id, title, kind, starts_at, ends_at, venue_name, spot_id, lat, lng, description, bring, capacity, fee, approval_note) values
  ('00000000-0000-4000-a002-000000000001', '00000000-0000-4000-a000-000000000001', 'Race night: season opener', 'race',
   (current_date + 3 + time '16:00') at time zone 'Asia/Kathmandu', (current_date + 3 + time '20:00') at time zone 'Asia/Kathmandu',
   'Sundarijal practice field', '00000000-0000-4000-a001-000000000007', 27.7660, 85.4250,
   'Practice laps from 4 pm, heats at 5:30, finals at 7. Open to all skill levels; spectators welcome.',
   'Quad and at least 3 charged packs
Goggles, spare props and a charger', 24, 'NPR 500', 'Sample event'),
  ('00000000-0000-4000-a002-000000000002', '00000000-0000-4000-a000-000000000003', 'Sunrise group flight', 'group',
   (current_date + 5 + time '05:30') at time zone 'Asia/Kathmandu', (current_date + 5 + time '08:30') at time zone 'Asia/Kathmandu',
   'Nagarkot ridge', '00000000-0000-4000-a001-000000000001', 27.7172, 85.5203,
   'Meet at the viewpoint at 5:30. Cinematic runs first while the light is soft, then freestyle.',
   '3 packs, warm clothes, a flask of tea', 12, null, 'Sample event'),
  ('00000000-0000-4000-a002-000000000003', '00000000-0000-4000-a000-000000000002', 'Pokhara cinematic meetup', 'meetup',
   (current_date + 9 + time '06:30') at time zone 'Asia/Kathmandu', null,
   'Begnas lake', '00000000-0000-4000-a001-000000000010', 28.1730, 84.0950,
   'Slow cinematic lines over the lake, then breakfast and edit-sharing.', 'Cinewhoop or cinematic quad, ND filters', 15, null, 'Sample event'),
  ('00000000-0000-4000-a002-000000000004', '00000000-0000-4000-a000-000000000005', 'Tiny whoop night', 'indoor',
   (current_date + 12 + time '18:00') at time zone 'Asia/Kathmandu', (current_date + 12 + time '21:00') at time zone 'Asia/Kathmandu',
   'Kirtipur indoor hall', '00000000-0000-4000-a001-000000000008', 27.6780, 85.2780,
   'Gates, a timed track and a lot of crashing. Beginners very welcome.', '1S whoop and batteries', 20, 'NPR 300', 'Sample event'),
  ('00000000-0000-4000-a002-000000000005', '00000000-0000-4000-a000-000000000006', 'Build night: your first quad', 'workshop',
   (current_date + 16 + time '17:30') at time zone 'Asia/Kathmandu', (current_date + 16 + time '20:30') at time zone 'Asia/Kathmandu',
   'Patan makerspace', null, null, null,
   'Solder, flash Betaflight and set up a beginner quad with help. Kits available to order in advance.', 'Your kit if you have one, a laptop', 10, 'NPR 1,000', 'Sample event'),
  ('00000000-0000-4000-a002-000000000006', '00000000-0000-4000-a000-000000000001', 'Race night: practice round', 'race',
   (current_date - 10 + time '16:00') at time zone 'Asia/Kathmandu', (current_date - 10 + time '19:00') at time zone 'Asia/Kathmandu',
   'Sundarijal practice field', '00000000-0000-4000-a001-000000000007', 27.7660, 85.4250,
   'Practice round before the season opener.', null, 24, 'Free', 'Sample event')
on conflict (id) do nothing;

-- RSVPs ------------------------------------------------------------------------
insert into public.rsvps (id, event_id, user_id, status)
select ('00000000-0000-4000-a003-' || lpad((row_number() over ())::text, 12, '0'))::uuid, e::uuid, u::uuid, 'going'
from (values
  ('00000000-0000-4000-a002-000000000001', '00000000-0000-4000-a000-000000000002'),
  ('00000000-0000-4000-a002-000000000001', '00000000-0000-4000-a000-000000000003'),
  ('00000000-0000-4000-a002-000000000001', '00000000-0000-4000-a000-000000000005'),
  ('00000000-0000-4000-a002-000000000001', '00000000-0000-4000-a000-000000000006'),
  ('00000000-0000-4000-a002-000000000002', '00000000-0000-4000-a000-000000000004'),
  ('00000000-0000-4000-a002-000000000002', '00000000-0000-4000-a000-000000000001'),
  ('00000000-0000-4000-a002-000000000003', '00000000-0000-4000-a000-000000000004'),
  ('00000000-0000-4000-a002-000000000004', '00000000-0000-4000-a000-000000000001'),
  ('00000000-0000-4000-a002-000000000004', '00000000-0000-4000-a000-000000000006'),
  ('00000000-0000-4000-a002-000000000005', '00000000-0000-4000-a000-000000000005')
) as r(e, u)
on conflict do nothing;

-- Flights: generated tracks looping around each spot ---------------------------
insert into public.flights (id, pilot_id, spot_id, title, flown_at, duration_s, max_alt_m, distance_m, source, track, series, is_public)
select f.id::uuid, f.pilot::uuid, f.spot::uuid, f.title,
       now() - (f.days_ago || ' days')::interval,
       round(f.n * 1.2), f.climb, round(f.n * 1.2 * f.speed),
       'gpx',
       (select jsonb_agg(jsonb_build_array(
                  round((s.lng + f.r * 0.006 * sin(i / 12.0) + i * 0.00003)::numeric, 6),
                  round((s.lat + f.r * 0.004 * cos(i / 9.0))::numeric, 6),
                  round((f.base_alt + f.climb / 2 * (1 + sin(i / 10.0)))::numeric, 1),
                  round((i * 1.2)::numeric, 1)) order by i)
        from generate_series(0, f.n - 1) i),
       jsonb_build_object(
         't', (select jsonb_agg(round((i * 1.2)::numeric, 1) order by i) from generate_series(0, f.n - 1) i),
         'alt', (select jsonb_agg(round((f.base_alt + f.climb / 2 * (1 + sin(i / 10.0)))::numeric, 1) order by i) from generate_series(0, f.n - 1) i),
         'throttle', (select jsonb_agg(round((45 + 25 * sin(i / 6.0) + 10 * sin(i / 2.3))::numeric, 1) order by i) from generate_series(0, f.n - 1) i),
         'vbat', (select jsonb_agg(round((16.8 - i * 0.012 - 0.25 * abs(sin(i / 6.0)))::numeric, 2) order by i) from generate_series(0, f.n - 1) i)
       ),
       true
from (values
  ('00000000-0000-4000-a004-000000000001', '00000000-0000-4000-a000-000000000003', '00000000-0000-4000-a001-000000000001', 'Sunrise ridge dives', 1, 160, 1.0, 95, 2050, 12.0),
  ('00000000-0000-4000-a004-000000000002', '00000000-0000-4000-a000-000000000004', '00000000-0000-4000-a001-000000000002', 'Long-range valley pass', 3, 240, 1.6, 110, 2500, 16.0),
  ('00000000-0000-4000-a004-000000000003', '00000000-0000-4000-a000-000000000002', '00000000-0000-4000-a001-000000000003', 'Lake glide', 4, 140, 0.7, 40, 1300, 8.0),
  ('00000000-0000-4000-a004-000000000004', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a001-000000000007', 'Race practice laps', 2, 120, 0.5, 15, 1340, 18.0),
  ('00000000-0000-4000-a004-000000000005', '00000000-0000-4000-a000-000000000002', '00000000-0000-4000-a001-000000000010', 'Begnas morning mist', 6, 180, 0.9, 60, 650, 9.0),
  ('00000000-0000-4000-a004-000000000006', '00000000-0000-4000-a000-000000000003', '00000000-0000-4000-a001-000000000006', 'Terrace surfing', 8, 150, 1.1, 85, 1550, 13.0),
  ('00000000-0000-4000-a004-000000000007', '00000000-0000-4000-a000-000000000004', '00000000-0000-4000-a001-000000000011', 'Bandipur golden hour', 11, 200, 1.3, 100, 1030, 12.0),
  ('00000000-0000-4000-a004-000000000008', '00000000-0000-4000-a000-000000000002', '00000000-0000-4000-a001-000000000009', 'Sarangkot cloud line', 14, 170, 1.0, 90, 1600, 11.0)
) as f(id, pilot, spot, title, days_ago, n, r, climb, base_alt, speed)
join public.spots s on s.id = f.spot::uuid
on conflict (id) do nothing;

commit;
