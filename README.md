# Udaan

**Find where to fly FPV in Nepal.** Udaan is an offline-first progressive web app for FPV pilots: a map of flying spots with airport no-fly rings, events with RSVPs, pilot profiles you can hire from, a permit checklist, and flight logs replayed on the map.

It works in the hills with no signal. Everything is saved on the phone first and syncs to Supabase when a connection returns. It installs from the browser, and ships to Google Play as a Trusted Web Activity.

## Features

| Area | What it does | Offline |
| --- | --- | --- |
| Spots map | Pilot-added spots, filters, distance sorting, airport rings drawn on the map | Browse, add and edit |
| Rules check | Every spot and new pin is checked against known airport 5 km rings, on the device | Yes |
| Moderation | New and moved spots stay private until a moderator approves; spots inside a ring can never go public (enforced in the database) | Review needs a connection |
| Events | Race nights, group flights, workshops; RSVP with capacity | Browse, RSVP, host |
| Flight logs | Upload GPX or Blackbox Explorer CSV; parsed on the phone; replay with telemetry; GPX export | Yes |
| Pilot profiles | Builds, spots, reels, flights, "available for hire" with services | Yes |
| Hire requests | Send and answer shoot requests | Yes |
| Permit checklist | Step-by-step guidance with local progress | Yes |
| Offline maps | Browsed tiles are cached; save an area (up to 3,000 tiles) before a trip | Yes |

## Stack

React 18 + TypeScript + Vite · React Router · Dexie (IndexedDB) · Supabase (Postgres + PostGIS, Auth, Storage, row-level security) · MapLibre GL with OpenFreeMap tiles · vite-plugin-pwa (Workbox) · Vitest.

## How offline sync works

```
UI ──reads──▶ IndexedDB (Dexie) ◀──pull── Supabase
 │                ▲                         ▲
 └─writes──▶ row + outbox entry ──push──────┘
```

- **Local first.** Screens only read IndexedDB (via live queries), so they render instantly and offline.
- **Outbox.** A save writes the row locally and queues one outbox entry per row. Several offline edits to the same row become one upload of its latest state.
- **Push, then pull.** Sync uploads queued photos, then outbox rows (upserts with client-generated UUIDs, so retries are safe), then pulls each table changed since its cursor. Cursors are `(updated_at, id)` keysets on the **server's** clock, so phone clock drift doesn't matter.
- **Conflicts.** Last write wins on the server. A row with unsent local changes is never overwritten by a pull; it uploads first.
- **Deletes** are soft (`deleted_at`) so they reach every device.
- **Failures.** Network errors stop the run and retry later. A change the server rejects (validation or permissions) is retried up to 5 times, then shown in Settings with Retry and Discard, without blocking other changes.
- **When it runs:** on launch, when the network returns, when the app comes to the foreground, 1.5 s after any local change, and every 2 minutes while open.

The engine is in `src/sync/engine.ts`, with tests in `src/sync/engine.test.ts`.

## Getting started

```bash
npm install
cp .env.example .env   # add your Supabase URL and anon key
npm run dev
```

### Set up Supabase

1. Create a project at supabase.com.
2. In the SQL editor, run `supabase/migrations/20261031000000_init.sql`, then `supabase/seed.sql`. Or, with the Supabase CLI: `supabase link` then `supabase db push`.
3. **Auth → Sign In / Providers → Email**: keep it enabled. Udaan uses email and password. For the easiest sign-up, turn **Confirm email** off; with it on, new pilots must click a link in their email before signing in (the app handles both).
4. **Auth → URL configuration**: set the Site URL to your deployed domain and add `https://YOUR-DOMAIN/**` to Redirect URLs (used by password-reset emails).

Signing up creates the pilot's profile automatically: a trigger on `auth.users` (`supabase/migrations/20261031000200_signup_profiles.sql`) builds it from the name and username entered on the sign-up screen.
5. Make yourself a moderator after your first sign-in:
   ```sql
   update public.profiles set role = 'moderator' where username = 'your_username';
   ```

### Demo data

`supabase/demo_seed.sql` adds 6 sample pilots (bios start with "Demo pilot"), 12 spots, 6 events, RSVPs and 8 flight logs. Run `supabase/demo_cleanup.sql` in the SQL editor to remove all of it before launch.

### Before launch: airports

`supabase/seed.sql` contains **only Tribhuvan International Airport**, and it is marked unverified. Add every aerodrome from AIP Nepal (published by CAAN) to `public.airports`, confirm each radius, and set `verified = true` only after checking against the official source. The app tells pilots how many airports it knows and that the list may be incomplete. Also review `src/lib/permits.ts` against current CAAN and Home Ministry rules and update `REVIEWED_ON`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm test` | Unit tests (sync engine, flight parsing, geo) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run build` | Production build with service worker |
| `npm run preview` | Serve the build locally (test offline in DevTools) |

Database rules are tested in CI against real PostGIS: `supabase/tests/rules_test.sql` asserts that pilots can't approve their own spots or become moderators, that spots inside airport rings are forced private and can't be approved, and that anonymous users see only approved spots.

## Deploy

- **Static hosting** (Vercel, Netlify, Cloudflare Pages): build command `npm run build`, output `dist`, set the `VITE_*` environment variables. `vercel.json` adds SPA rewrites and service-worker headers.
- **Docker** (self-hosted, e.g. behind Traefik):
  ```bash
  docker build -t udaan --build-arg VITE_SUPABASE_URL=... --build-arg VITE_SUPABASE_ANON_KEY=... .
  docker run -p 8080:80 udaan
  ```
  `nginx.conf` serves the SPA, never caches `sw.js`, and serves `assetlinks.json` as JSON.

## Google Play

See [docs/PLAY_STORE.md](docs/PLAY_STORE.md) for packaging with Bubblewrap, linking the domain with Digital Asset Links, and the store listing checklist.

## Limits and roadmap

- Raw Betaflight `.bbl` files are binary; export CSV from Blackbox Explorer first. Native `.bbl` decoding is a planned improvement.
- Syncing happens while the app is open; there is no background sync when it's closed.
- OpenFreeMap's public instance limits offline downloads to 3,000 tiles per area. For heavier use, self-host tiles or use a commercial provider (set `VITE_MAP_STYLE_URL`).
- Rule guidance is not legal advice.

## Map data

© OpenStreetMap contributors · OpenMapTiles · OpenFreeMap.
