import type { DailyResult } from "./types";

function resultKey(playDate: string) {
  return `anomaly_result_${playDate}`;
}

export function getCachedResult(playDate: string): DailyResult | null {
  const raw = window.localStorage.getItem(resultKey(playDate));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DailyResult;
  } catch {
    return null;
  }
}

export function setCachedResult(result: DailyResult) {
  window.localStorage.setItem(resultKey(result.playDate), JSON.stringify(result));
}
