# EatinOut

A family restaurant memory app. Log who ate what (and whether it was safe for their allergies) in under 30 seconds, see what everyone had **last time here**, and get a **where should we go tonight?** pick based only on your family's own history.

> EatinOut records your family's experience. Always confirm allergens with the restaurant.

## Status

React front end backed by **Supabase** (Postgres, Auth, Storage). Each account gets its own private family; row-level security (RLS) means a family can only ever read or change its own rows. A brand-new account can tap **"Try with Bree's demo family"** to load 5 Austin restaurants and 15 visits.

Stack: React 19, Vite, TypeScript, Tailwind CSS v4, React Router, Supabase JS, Vitest.

## Run it locally

Requires Node 20+.

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase URL and publishable key
npm run dev                  # http://localhost:5173
```

Restart `npm run dev` after changing `.env.local`; Vite only reads it at startup.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm test` | Run the unit tests (ranking and "last time here" rules) |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Typecheck and build to `dist/` |
| `npm run preview` | Serve the production build |

## Environment variables

| Variable | Where to find it |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys (`sb_publishable_...`) |

The publishable key is designed to be public; RLS protects the data. **Never** put the secret / `service_role` key in this app. `.env.local` is git-ignored.

## Database

- Schema, RLS policies, signup trigger and the `visit-photos` storage bucket: `supabase/migrations/20261107190000_init_eatinout.sql`
- Privacy test: `supabase/tests/rls_isolation.sql` creates two throwaway families inside a transaction, checks neither can read or change the other's rows or photos (and that signed-out users see nothing), then rolls back. Paste it into the Supabase SQL editor to re-run; it prints `RLS isolation: all checks passed` or raises an error.

Tables: `families`, `family_users` (which login belongs to which family), `members`, `restaurants`, `visits` (tags stored as an array), `dish_logs`. Every table carries `family_id`, and composite foreign keys stop a visit or dish from pointing at another family's rows.

For sign-up to work without an email round-trip, turn off **Authentication → Sign In / Providers → Email → Confirm email** in the Supabase dashboard. Add your deployed URL under **Authentication → URL Configuration** when you deploy.

## Deploy to Vercel

```bash
vercel          # preview
vercel --prod   # production
```

Vercel detects Vite automatically. Add the two `VITE_SUPABASE_*` variables in the Vercel project settings. `vercel.json` sends every route to `index.html` so deep links work.

## How it works

| Screen | Route | Notes |
| --- | --- | --- |
| Tonight | `/tonight` | Ranked picks with a reason, unsafe-dish warnings, and a "Not for everyone yet" list |
| Places | `/restaurants` | Saved restaurants, add a new one |
| Last time here | `/restaurants/:id` | What each person had last time, rating, date, safe flag, and a "try again" dish |
| Log visit | `/log` | One screen: place, date, a dish and 👍/😐/👎 per person, safe yes/no, tags, photo |
| Family | `/family` | Members, allergies, "won't eat" notes |

### Ranking rules (`src/lib/ranking.ts`)

- A dish counts as **liked** if its **latest** rating is 👍, so a kid's changed taste stops counting.
- A place is suggested **only if every member has at least one liked dish** there that was never logged as not safe for them.
- Places that fail that rule are listed under "Not for everyone yet" with the reason, never ranked.
- Any dish logged as not safe shows a warning.
- Score favors recent 👍 ratings (90-day half-life), with a small bonus for family-friendly tags.

### Code map

```
src/
  lib/types.ts          data model (mirrors future DB tables)
  lib/supabase.ts       Supabase client (reads the VITE_ env vars)
  lib/store/remote.ts   load/save rows, snake_case <-> app types
  lib/store/StoreProvider.tsx  auth session, optimistic saves, actions
  lib/ranking.ts        tonight picker
  lib/lastTime.ts       "last time here" + "try again"
  lib/seed.ts           Bree's demo family (loaded per account on request)
supabase/
  migrations/           database schema and RLS
  tests/                RLS isolation test
  screens/              one file per screen
  components/           shared UI
```
