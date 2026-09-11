import type { DailyResult } from "./types";

export function buildShareText(result: DailyResult): string {
  const label = `Anomaly #${result.dayNumber}`;

  if (result.correct) {
    return `${label} — found it in ${result.timeTakenSeconds}s ⚡ ${result.streakAfter}-day streak`;
  }

  return `${label} — didn't find it this time 👁 back tomorrow`;
}
