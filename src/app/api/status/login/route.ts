import { NextResponse } from "next/server";
import { computeStatusToken, STATUS_COOKIE } from "@/lib/status-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const password = body?.password;
  const expected = process.env.STATUS_PASSWORD;

  if (!expected || typeof password !== "string" || password !== expected) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(STATUS_COOKIE, computeStatusToken(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/status",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
