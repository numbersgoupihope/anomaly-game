import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { StatsResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("daily_stats")
    .select("total_plays, total_correct")
    .eq("play_date", today)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const totalPlays = data?.total_plays ?? 0;
  const totalCorrect = data?.total_correct ?? 0;
  const percentCorrect =
    totalPlays === 0 ? 0 : Math.round((totalCorrect / totalPlays) * 100);

  const payload: StatsResponse = { totalPlays, totalCorrect, percentCorrect };
  return NextResponse.json(payload);
}
