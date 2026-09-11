-- Anomaly: core schema
-- All access happens server-side via the service-role key (see src/lib/supabase-admin.ts),
-- so RLS is enabled with no policies to deny anon/authenticated access entirely.

create extension if not exists "pgcrypto";

create table if not exists scenes (
  id uuid primary key default gen_random_uuid(),
  play_date date not null unique,
  day_number int not null unique,
  sentences jsonb not null,
  anomaly_index int not null,
  reveal_text text not null,
  created_at timestamptz not null default now()
);

create table if not exists streaks (
  anon_id uuid primary key,
  current_streak int not null default 0,
  last_played_date date,
  updated_at timestamptz not null default now()
);

create table if not exists daily_stats (
  play_date date primary key,
  total_plays int not null default 0,
  total_correct int not null default 0
);

alter table scenes enable row level security;
alter table streaks enable row level security;
alter table daily_stats enable row level security;

-- Atomic increment so concurrent guesses on the same day never race each other.
create or replace function increment_daily_stats(p_play_date date, p_correct boolean)
returns void
language sql
security definer
set search_path = public
as $$
  insert into daily_stats (play_date, total_plays, total_correct)
  values (p_play_date, 1, case when p_correct then 1 else 0 end)
  on conflict (play_date) do update set
    total_plays = daily_stats.total_plays + 1,
    total_correct = daily_stats.total_correct + case when p_correct then 1 else 0 end;
$$;
