-- Asserts the safety rules in the init migration. Any failure raises an error.
\set ON_ERROR_STOP 1
-- Sign-up: creating an account creates its profile from the sign-up details.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.com', '{"username":"Pilot_A","display_name":"Pilot A","role":"moderator"}'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.com', '{"username":"pilot_b","display_name":"Pilot B"}'),
  ('33333333-3333-3333-3333-333333333333', 'pilot_a@example.com', '{"username":"pilot_a"}'),
  ('44444444-4444-4444-4444-444444444444', 'x@example.com', '{}');
do $$ begin
  assert (select display_name from profiles where username = 'pilot_a') = 'Pilot A', 'sign-up creates the profile with the chosen name';
  assert (select role from profiles where username = 'pilot_a') = 'pilot', 'sign-up metadata cannot make someone a moderator';
  assert (select username from profiles where id = '33333333-3333-3333-3333-333333333333') = 'pilot_a1', 'a taken username gets a number added';
  assert (select username from profiles where id = '44444444-4444-4444-4444-444444444444') like 'pilot%', 'no username falls back to a generated one';
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
update profiles set role = 'moderator' where id = auth.uid();
do $$ begin
  assert (select role from profiles where username = 'pilot_a') = 'pilot', 'users must not self-assign moderator';
end $$;
insert into spots (id, created_by, name, type, lat, lng, status) values
  ('aaaaaaaa-0000-0000-0000-000000000001', auth.uid(), 'Nagarkot ridge', 'ridge', 27.715, 85.52, 'approved'),
  ('aaaaaaaa-0000-0000-0000-000000000002', auth.uid(), 'Near the airport', 'field', 27.70, 85.35, 'pending');
do $$ begin
  assert (select status from spots where name = 'Nagarkot ridge') = 'pending', 'new spots must start pending';
  assert (select airport_warning and is_private from spots where name = 'Near the airport'), 'spots in an airport ring must be flagged and private';
end $$;
update spots set status = 'approved' where name = 'Nagarkot ridge';
do $$ begin
  assert (select status from spots where name = 'Nagarkot ridge') = 'pending', 'pilots must not approve their own spots';
end $$;
reset role;

-- An admin (no JWT) promotes pilot A.
select set_config('request.jwt.claim.sub', '', false);
update profiles set role = 'moderator' where username = 'pilot_a';

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
update spots set status = 'approved';
do $$ begin
  assert (select status from spots where name = 'Nagarkot ridge') = 'approved', 'moderators can approve';
  assert (select status from spots where name = 'Near the airport') = 'rejected', 'spots in an airport ring can never be approved';
end $$;
reset role;

set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  assert (select count(*) from spots) = 1, 'anonymous users see only approved public spots';
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$ begin
  begin
    insert into hire_requests (id, pilot_id, requester_id, shoot_type, location, contact, message)
    values (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', auth.uid(), 'tourism', 'Pokhara', 'b@example.com', 'hello');
    raise exception 'hiring a pilot who is not for hire must fail';
  exception when insufficient_privilege then null;
  end;
  begin
    update spots set name = 'Hijacked' where name = 'Nagarkot ridge';
    assert (select name from spots where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'Nagarkot ridge', 'users must not edit others'' spots';
  end;
end $$;
reset role;

-- Check-ins: pilots check themselves in, never someone else.
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
insert into checkins (id, spot_id, user_id, checked_in_at)
values ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', auth.uid(), now() + interval '2 days');
do $$ begin
  assert (select checked_in_at <= now() + interval '1 minute' from checkins where id = 'cccccccc-0000-0000-0000-000000000001'), 'future check-in times are clamped';
  begin
    insert into checkins (id, spot_id, user_id)
    values ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111');
    raise exception 'checking in someone else must fail';
  exception when insufficient_privilege then null;
  end;
end $$;
-- Media-only flights are allowed.
insert into flights (id, pilot_id, title, source, media)
values ('dddddddd-0000-0000-0000-000000000001', auth.uid(), 'Clip only', 'media', '[{"path":"x/y.mp4","kind":"video"}]');
reset role;
select 'all rules tests passed' as result;
