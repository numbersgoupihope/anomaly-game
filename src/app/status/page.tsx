import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isValidStatusToken, STATUS_COOKIE } from "@/lib/status-auth";
import StatusLoginForm from "@/components/StatusLoginForm";
import DailyPlaysChart from "@/components/DailyPlaysChart";

export const dynamic = "force-dynamic";

export default async function StatusPage() {
  const cookieStore = await cookies();
  const authed = isValidStatusToken(cookieStore.get(STATUS_COOKIE)?.value);

  if (!authed) {
    return (
      <main className="flex min-h-screen flex-1 items-center justify-center px-6">
        <StatusLoginForm />
      </main>
    );
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("daily_stats")
    .select("play_date, total_plays, total_correct")
    .order("play_date", { ascending: true });

  const rows = data ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const totalPlaysAllTime = rows.reduce((sum, r) => sum + r.total_plays, 0);
  const totalPlaysToday =
    rows.find((r) => r.play_date === today)?.total_plays ?? 0;

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 29);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const last30 = rows.filter((r) => r.play_date >= cutoffStr);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 px-6 py-16">
      <h1 className="text-sm uppercase tracking-[0.2em] text-zinc-500">
        status
      </h1>

      {error && <p className="text-sm text-red-400">{error.message}</p>}

      <div className="flex gap-10">
        <div>
          <p className="font-mono text-2xl tabular-nums text-zinc-100">
            {totalPlaysAllTime.toLocaleString()}
          </p>
          <p className="text-xs text-zinc-500">all-time plays</p>
        </div>
        <div>
          <p className="font-mono text-2xl tabular-nums text-zinc-100">
            {totalPlaysToday.toLocaleString()}
          </p>
          <p className="text-xs text-zinc-500">plays today</p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs text-zinc-500">daily plays, last 30 days</p>
        <DailyPlaysChart data={last30} />
      </div>
    </main>
  );
}
