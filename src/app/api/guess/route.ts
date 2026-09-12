import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { GuessResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const sentenceIndex = body?.sentenceIndex;

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
    .select("anomaly_index, reveal_text")
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

  const correct = sentenceIndex === scene.anomaly_index;

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
  };
  return NextResponse.json(payload);
}
