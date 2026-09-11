"use client";

import { useEffect, useState } from "react";
import type { StatsResponse } from "@/lib/types";

const POLL_MS = 6000;

export default function StatsBar() {
  const [stats, setStats] = useState<StatsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/stats", { cache: "no-store" });
        if (!res.ok) return;
        const data: StatsResponse = await res.json();
        if (!cancelled) setStats(data);
      } catch {
        // silent — live counter is best-effort
      }
    }

    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!stats || stats.totalPlays === 0) {
    return (
      <p className="text-xs tracking-wide text-zinc-500">
        be the first to play today.
      </p>
    );
  }

  return (
    <p className="text-xs tracking-wide text-zinc-500">
      {stats.totalPlays.toLocaleString()}{" "}
      {stats.totalPlays === 1 ? "person has" : "people have"} played today ·{" "}
      {stats.percentCorrect}% got it right
    </p>
  );
}
