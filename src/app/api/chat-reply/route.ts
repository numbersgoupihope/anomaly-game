import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  MAX_LIVE_TURNS,
  MOM_AI_CONTEXTS,
  buildMomSystemPrompt,
  fallbackReply,
  rollWrongness,
  type BeatId,
} from "@/lib/mom-ai";

export const dynamic = "force-dynamic";

const MAX_MESSAGE_CHARS = 300;
const MAX_HISTORY_ITEMS = MAX_LIVE_TURNS * 2;
const MAX_TRANSCRIPT_ITEMS = 60;

type HistoryItem = { role: "user" | "assistant"; content: string };
type TranscriptItem = { from: "mom" | "you"; text: string };

function isBeatId(value: unknown): value is BeatId {
  return typeof value === "string" && value in MOM_AI_CONTEXTS;
}

function sanitizeHistory(raw: unknown): HistoryItem[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_HISTORY_ITEMS) {
    return null;
  }
  const out: HistoryItem[] = [];
  for (const item of raw) {
    if (
      !item ||
      (item.role !== "user" && item.role !== "assistant") ||
      typeof item.content !== "string"
    ) {
      return null;
    }
    out.push({ role: item.role, content: item.content.slice(0, MAX_MESSAGE_CHARS) });
  }
  // Must end on the player's new message.
  if (out[out.length - 1].role !== "user") return null;
  return out;
}

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
  if (transcript.length === 0) return "(nothing yet — this is the very first message)";
  return transcript.map((item) => `${item.from === "mom" ? "Mom" : "Kid"}: ${item.text}`).join("\n");
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const beatId = body?.beatId;
  const history = sanitizeHistory(body?.history);
  const transcript = sanitizeTranscript(body?.transcript);

  if (!isBeatId(beatId) || !history) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const userTurns = history.filter((m) => m.role === "user").length;
  if (userTurns > MAX_LIVE_TURNS) {
    return NextResponse.json({ reply: fallbackReply(beatId) });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error(
      "[chat-reply] ANTHROPIC_API_KEY is not set in this environment — falling back to static lines"
    );
    return NextResponse.json({
      reply: fallbackReply(beatId),
      fallbackReason: "missing_api_key",
    });
  }

  // The exact model ID for Haiku 4.5 has been inconsistent across sources
  // this app was built from (with vs. without the "-20251001" date suffix).
  // Try the primary one; on a 404 specifically, retry once with the
  // alternate spelling before giving up to the static fallback.
  const MODEL_CANDIDATES = ["claude-haiku-4-5", "claude-haiku-4-5-20251001"];

  const { includeWrongness, pattern } = rollWrongness();
  const systemPrompt = buildMomSystemPrompt({
    beatId,
    transcriptSoFar: formatTranscript(transcript),
    includeWrongness,
    wrongnessPattern: pattern,
  });

  try {
    const client = new Anthropic({ apiKey });
    let response: Anthropic.Message | null = null;
    let lastErr: unknown = null;

    for (const model of MODEL_CANDIDATES) {
      try {
        response = await client.messages.create({
          model,
          max_tokens: 200,
          system: systemPrompt,
          messages: history,
        });
        if (model !== MODEL_CANDIDATES[0]) {
          console.error(
            `[chat-reply] model "${MODEL_CANDIDATES[0]}" was not found — "${model}" worked instead. Update the primary model id.`
          );
        }
        break;
      } catch (err) {
        lastErr = err;
        if (!(err instanceof Anthropic.NotFoundError)) throw err;
        // 404 on this exact model id — try the next candidate.
      }
    }

    if (!response) throw lastErr;

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );
    const reply = textBlock?.text.trim();

    if (!reply) {
      console.error("[chat-reply] Anthropic response had no usable text block:", response);
    }

    console.log(
      `[chat-reply] beat=${beatId} wrongness=${includeWrongness ? pattern : "none"} reply="${reply}"`
    );

    return NextResponse.json({ reply: reply || fallbackReply(beatId) });
  } catch (err) {
    let reason = "unknown_error";
    if (err instanceof Anthropic.AuthenticationError) reason = "authentication_error (bad or revoked API key)";
    else if (err instanceof Anthropic.PermissionDeniedError) reason = "permission_denied (key lacks access to this model)";
    else if (err instanceof Anthropic.NotFoundError) reason = "not_found (likely an invalid model id)";
    else if (err instanceof Anthropic.RateLimitError) reason = "rate_limited";
    else if (err instanceof Anthropic.BadRequestError) reason = `bad_request: ${err.message}`;
    else if (err instanceof Anthropic.APIConnectionError) reason = "connection_error (network/DNS/proxy issue reaching api.anthropic.com)";
    else if (err instanceof Anthropic.APIError) reason = `api_error_${err.status}: ${err.message}`;

    console.error("[chat-reply] Anthropic API call failed:", reason, err);

    return NextResponse.json({ reply: fallbackReply(beatId), fallbackReason: reason });
  }
}
