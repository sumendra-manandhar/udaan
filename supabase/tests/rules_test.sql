-- Asserts the safety rules in the init migration. Any failure raises an error.
\set ON_ERROR_STOP 1
insert into auth.users values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222');

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into profiles (id, username, display_name, role) values (auth.uid(), 'pilot_a', 'Pilot A', 'moderator');
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
insert into profiles (id, username, display_name) values (auth.uid(), 'pilot_b', 'Pilot B');
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
select 'all rules tests passed' as result;
