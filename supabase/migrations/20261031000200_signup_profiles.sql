-- Email + password sign-up: every new account in auth.users gets a pilot
-- profile automatically, built from the name and username the pilot typed on
-- the sign-up screen (sent as user metadata). No separate onboarding step.

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  base text;
  candidate text;
  n integer := 0;
begin
  -- Username: what the pilot asked for, else the start of their email,
  -- cleaned to the allowed characters.
  base := lower(regexp_replace(
    coalesce(nullif(meta->>'username', ''), split_part(coalesce(new.email, ''), '@', 1)),
    '[^a-zA-Z0-9_]', '', 'g'));
  base := left(base, 20);
  if char_length(base) < 3 then
    base := 'pilot' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;

  -- If someone took it between the availability check and sign-up, add a number.
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    n := n + 1;
    candidate := base || n::text;
  end loop;

  insert into public.profiles (id, username, display_name)
  values (new.id, candidate, left(coalesce(nullif(trim(meta->>'display_name'), ''), candidate), 60))
  on conflict (id) do nothing;
  return new;
end $$;

revoke execute on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();
