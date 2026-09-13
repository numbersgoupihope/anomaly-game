# Anomaly

A daily one-round horror/uncanny puzzle. Each day everyone sees the same short
scene — 4–5 plain sentences, revealed one at a time. One of them is subtly
wrong. You have 30 seconds to click it.

No accounts, no login, no per-player tracking of any kind.

## Current prototype: messaging-interface mechanic (not merged to main)

`src/app/page.tsx` currently renders `<ChatEpisode />`
(`src/components/chat/`) instead of the sentence-reading game described
below — a one-off test episode (a simulated "Mom" text conversation) built
on the `v4-live-ai-analog-horror` branch to prove out a different mechanic.
It's a fixed script, not wired to daily rotation. The original mechanic
(`src/components/Game.tsx` + its `supabase`/`/api/scene`, `/api/guess`
routes) is untouched and unlinked, not deleted, in case it comes back.

The chat prototype needs one more env var: `ANTHROPIC_API_KEY`, for the
live Mom replies during free-text exchanges (Claude Haiku 4.5 — see
`src/app/api/chat-reply/route.ts`). Without it, those exchanges fall back to
a small set of static lines so the episode still plays end to end.

## Stack

- Next.js 16 (App Router) + Tailwind
- Supabase (Postgres) for scenes and daily aggregate stats
- Web Audio API for ambient drone, hit/miss tones, and (in the chat
  prototype) a corrupted-voice-memo effect — no audio files
- Anthropic API (Claude Haiku 4.5) for the chat prototype's live replies
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
   - `ANTHROPIC_API_KEY` — only needed for live Mom replies in the chat prototype; safe to leave unset (falls back to static lines)
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
