import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { EVIDENCE_MODEL_CANDIDATES, buildTransformationSystemPrompt } from "@/lib/evidence";

export const dynamic = "force-dynamic";

const MAX_DETAIL_CHARS = 200;
const MAX_NAME_CHARS = 20;

function sanitizeText(raw: unknown, maxChars: number): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().slice(0, maxChars);
  return trimmed || null;
}

// A narrow rewrite call — its ONLY input is the short extracted phrase and
// the player's name, never the full conversation, so it has no way to
// invent anything beyond restyling those two fixed inputs. Failure here
// means "no generated evidence this time" — the caller falls back to the
// structural (verbatim-quote) trick instead.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const detail = sanitizeText(body?.detail, MAX_DETAIL_CHARS);
  const playerName = sanitizeText(body?.playerName, MAX_NAME_CHARS);

  if (!detail || !playerName) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[evidence-transform] ANTHROPIC_API_KEY is not set — reporting no body generated");
    return NextResponse.json({ body: null, fallbackReason: "missing_api_key" });
  }

  try {
    const client = new Anthropic({ apiKey });
    let response: Anthropic.Message | null = null;
    let lastErr: unknown = null;

    for (const model of EVIDENCE_MODEL_CANDIDATES) {
      try {
        response = await client.messages.create({
          model,
          max_tokens: 220,
          temperature: 0.7,
          system: buildTransformationSystemPrompt(),
          messages: [{ role: "user", content: `Detail: ${detail}\nName: ${playerName}` }],
        });
        break;
      } catch (err) {
        lastErr = err;
        if (!(err instanceof Anthropic.NotFoundError)) throw err;
      }
    }

    if (!response) throw lastErr;

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );
    const generated = textBlock?.text.trim() || null;
    console.log(`[evidence-transform] body="${generated}"`);
    return NextResponse.json({ body: generated });
  } catch (err) {
    console.error("[evidence-transform] Anthropic API call failed:", err);
    return NextResponse.json({ body: null, fallbackReason: "error" });
  }
}
