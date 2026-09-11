# Anomaly

A daily one-round horror/uncanny puzzle. Each day everyone sees the same short
scene — 4–5 plain sentences. One of them is subtly wrong. You have 30 seconds
to click it.

No accounts, no login. An anonymous id lives in `localStorage` to track your
streak; nothing else is tied to a person.

## Stack

- Next.js 16 (App Router) + Tailwind
- Supabase (Postgres) for scenes, streaks, and daily aggregate stats
- Deployed on Vercel

## Data model

- `scenes` — one row per `play_date`: `sentences` (jsonb array), `anomaly_index`, `reveal_text`, `day_number` (for the `Anomaly #N` label).
- `streaks` — one row per anonymous id: `current_streak`, `last_played_date`.
- `daily_stats` — one row per `play_date`: `total_plays`, `total_correct`.

All three tables have RLS enabled with **no policies**, so they're only
reachable through the service-role key, which is only ever used from Next.js
route handlers (`src/app/api/*`), never sent to the browser. The browser talks
to `/api/scene`, `/api/guess`, and `/api/stats` — never to Supabase directly.

## Local setup

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL editor, run `supabase/migrations/0001_init.sql`, then
   `supabase/seed.sql` (seeds the first 5 days, anchored so Day 1 starts
   today — re-running it later just shifts the dates forward, so only run it
   once).
3. Copy `.env.local.example` to `.env.local` and fill in:
   - `SUPABASE_URL` — Project Settings → API → Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` — Project Settings → API → `service_role` secret key
4. `npm install`
5. `npm run dev` and open http://localhost:3000

## Deploying to Vercel

1. Push this repo to GitHub (already done if you're reading this from the repo).
2. Import the repo in the [Vercel dashboard](https://vercel.com/new).
3. Add the two env vars from `.env.local` in the Vercel project settings
   (Production and Preview).
4. Deploy.

## Adding new daily scenes

Insert a row into `scenes` with the next `day_number` and a future
`play_date`. Each scene needs 4–5 sentences, the (0-indexed) `anomaly_index`,
and a one-line `reveal_text` explaining why that sentence is wrong.
