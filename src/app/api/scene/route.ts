import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { SceneForClient } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("scenes")
    .select("day_number, play_date, sentences")
    .eq("play_date", today)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      { error: "No scene is scheduled for today." },
      { status: 404 }
    );
  }

  const payload: SceneForClient = {
    dayNumber: data.day_number,
    playDate: data.play_date,
    sentences: data.sentences,
    serverNow: today,
  };

  return NextResponse.json(payload);
}
