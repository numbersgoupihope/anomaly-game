# Anomaly

A daily one-round horror/uncanny puzzle. Each day everyone sees the same short
scene — 4–5 plain sentences, revealed one at a time. One of them is subtly
wrong. You have 30 seconds to click it.

No accounts, no login, no per-player tracking of any kind.

## Stack

- Next.js 16 (App Router) + Tailwind
- Supabase (Postgres) for scenes and daily aggregate stats
- Web Audio API for an opt-in ambient drone and hit/miss tones — no audio files
- Deployed on Vercel

## Data model

- `scenes` — one row per `play_date`: `sentences` (jsonb array), `anomaly_index`, `reveal_text`, `day_number` (for the `Anomaly #N` label).
- `daily_stats` — one row per `play_date`: `total_plays`, `total_correct`. Powers the public live counter and the private `/status` page.

Both tables have RLS enabled with **no policies**, so they're only reachable
through the service-role key, which is only ever used from Next.js route
handlers (`src/app/api/*`), never sent to the browser. The browser talks to
`/api/scene`, `/api/guess`, and `/api/stats` — never to Supabase directly.

An earlier version also tracked a per-player streak in a `streaks` table; v2
removed that entirely (see `supabase/migrations/0002_drop_streaks.sql`) — the
game no longer identifies players across visits at all. The client still
caches that day's own result in `localStorage` purely so a page refresh
doesn't replay the round.

## Local setup

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL editor, run the migrations in `supabase/migrations/` in order,
   then `supabase/seed.sql` (seeds the first 5 days, anchored so Day 1 starts
   today — re-running it later just shifts the dates forward, so only run it
   once).
3. Copy `.env.local.example` to `.env.local` and fill in:
   - `SUPABASE_URL` — Project Settings → API → Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` — Project Settings → API → `service_role` secret key
   - `STATUS_PASSWORD` — any password of your choosing, gates `/status`
4. `npm install`
5. `npm run dev` and open http://localhost:3000

## Deploying to Vercel

1. Push this repo to GitHub (already done if you're reading this from the repo).
2. Import the repo in the [Vercel dashboard](https://vercel.com/new).
3. Add the three env vars from `.env.local` in the Vercel project settings
   (Production and Preview).
4. Deploy.

## Adding new daily scenes

Insert a row into `scenes` with the next `day_number` and a future
`play_date`. Each scene needs 4–5 sentences, the (0-indexed) `anomaly_index`,
and a one-line `reveal_text` explaining why that sentence is wrong.

## `/status`

A private, unlinked page at `/status` shows all-time plays, plays today, and
a 30-day line chart from `daily_stats`. It's gated by `STATUS_PASSWORD` — a
plain password form, no session system, just enough to keep it from being
casually stumbled on.
