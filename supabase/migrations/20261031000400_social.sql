-- Social media: links to a pilot's accounts, posts they feature on their
-- profile, and posts attached to flights. Only links are stored; the app
-- embeds the post from the platform when online. Embed addresses are worked
-- out in the app from the link, never stored.

alter table public.profiles add column if not exists socials jsonb not null default '{}'::jsonb
  check (jsonb_typeof(socials) = 'object');
alter table public.profiles add column if not exists featured_posts jsonb not null default '[]'::jsonb
  check (jsonb_typeof(featured_posts) = 'array' and jsonb_array_length(featured_posts) <= 12);
alter table public.flights add column if not exists links jsonb not null default '[]'::jsonb
  check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 10);
