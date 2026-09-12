import "server-only";
import { createHash } from "crypto";

export const STATUS_COOKIE = "anomaly_status_auth";

export function computeStatusToken(password: string): string {
  return createHash("sha256").update(`anomaly-status:${password}`).digest("hex");
}

export function isValidStatusToken(token: string | undefined): boolean {
  const password = process.env.STATUS_PASSWORD;
  if (!password || !token) return false;
  return token === computeStatusToken(password);
}
