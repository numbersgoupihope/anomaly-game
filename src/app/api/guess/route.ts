import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { GuessResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isoDaysAgo(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const anonId = body?.anonId;
  const sentenceIndex = body?.sentenceIndex;

  if (typeof anonId !== "string" || !UUID_RE.test(anonId)) {
    return NextResponse.json({ error: "Invalid anonId" }, { status: 400 });
  }
  if (typeof sentenceIndex !== "number" || !Number.isInteger(sentenceIndex)) {
    return NextResponse.json(
      { error: "Invalid sentenceIndex" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const { data: scene, error: sceneError } = await supabase
    .from("scenes")
    .select("play_date, anomaly_index, reveal_text")
    .eq("play_date", today)
    .maybeSingle();

  if (sceneError) {
    return NextResponse.json({ error: sceneError.message }, { status: 500 });
  }
  if (!scene) {
    return NextResponse.json(
      { error: "No scene is scheduled for today." },
      { status: 404 }
    );
  }

  const { data: streak, error: streakError } = await supabase
    .from("streaks")
    .select("current_streak, last_played_date")
    .eq("anon_id", anonId)
    .maybeSingle();

  if (streakError) {
    return NextResponse.json({ error: streakError.message }, { status: 500 });
  }

  const correct = sentenceIndex === scene.anomaly_index;

  if (streak?.last_played_date === today) {
    const payload: GuessResponse = {
      correct,
      anomalyIndex: scene.anomaly_index,
      revealText: scene.reveal_text,
      currentStreak: streak.current_streak,
      alreadyPlayed: true,
    };
    return NextResponse.json(payload);
  }

  const yesterday = isoDaysAgo(today, 1);
  const continuingStreak = streak?.last_played_date === yesterday;
  const newStreak = correct
    ? continuingStreak
      ? streak!.current_streak + 1
      : 1
    : 0;

  const { error: upsertStreakError } = await supabase.from("streaks").upsert(
    {
      anon_id: anonId,
      current_streak: newStreak,
      last_played_date: today,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "anon_id" }
  );

  if (upsertStreakError) {
    return NextResponse.json(
      { error: upsertStreakError.message },
      { status: 500 }
    );
  }

  const { error: statsError } = await supabase.rpc("increment_daily_stats", {
    p_play_date: today,
    p_correct: correct,
  });

  if (statsError) {
    return NextResponse.json({ error: statsError.message }, { status: 500 });
  }

  const payload: GuessResponse = {
    correct,
    anomalyIndex: scene.anomaly_index,
    revealText: scene.reveal_text,
    currentStreak: newStreak,
    alreadyPlayed: false,
  };
  return NextResponse.json(payload);
}
