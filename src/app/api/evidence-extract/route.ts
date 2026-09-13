import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  EVIDENCE_MODEL_CANDIDATES,
  buildExtractionSystemPrompt,
  parseExtractedDetail,
} from "@/lib/evidence";

export const dynamic = "force-dynamic";

const MAX_TRANSCRIPT_ITEMS = 30;
const MAX_MESSAGE_CHARS = 300;

type TranscriptItem = { from: "mom" | "you"; text: string };

function sanitizeTranscript(raw: unknown): TranscriptItem[] {
  if (!Array.isArray(raw)) return [];
  const out: TranscriptItem[] = [];
  for (const item of raw.slice(-MAX_TRANSCRIPT_ITEMS)) {
    if (!item || (item.from !== "mom" && item.from !== "you") || typeof item.text !== "string") {
      continue;
    }
    out.push({ from: item.from, text: item.text.slice(0, MAX_MESSAGE_CHARS) });
  }
  return out;
}

function formatTranscript(transcript: TranscriptItem[]): string {
  if (transcript.length === 0) return "(nothing yet)";
  return transcript.map((item) => `${item.from === "mom" ? "Mom" : "Kid"}: ${item.text}`).join("\n");
}

// A narrow, mechanical classifier call — deliberately separate from both
// Mom's chat prompt and the transformation call below. Failure here just
// means "nothing usable this round," never a hard error surfaced to the
// player — the state machine that calls this falls back structurally once
// its turn window closes.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const transcript = sanitizeTranscript(body?.transcript);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[evidence-extract] ANTHROPIC_API_KEY is not set — reporting no detail found");
    return NextResponse.json({ detail: null, fallbackReason: "missing_api_key" });
  }

  try {
    const client = new Anthropic({ apiKey });
    let response: Anthropic.Message | null = null;
    let lastErr: unknown = null;

    for (const model of EVIDENCE_MODEL_CANDIDATES) {
      try {
        response = await client.messages.create({
          model,
          max_tokens: 60,
          temperature: 0.25,
          system: buildExtractionSystemPrompt(),
          messages: [{ role: "user", content: formatTranscript(transcript) }],
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
    const detail = parseExtractedDetail(textBlock?.text ?? "");
    console.log(`[evidence-extract] detail=${detail ? `"${detail}"` : "NONE"}`);
    return NextResponse.json({ detail });
  } catch (err) {
    console.error("[evidence-extract] Anthropic API call failed:", err);
    return NextResponse.json({ detail: null, fallbackReason: "error" });
  }
}
