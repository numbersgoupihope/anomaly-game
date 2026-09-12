import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  MAX_LIVE_TURNS,
  MOM_AI_CONTEXTS,
  buildMomSystemPrompt,
  fallbackReply,
  type BeatId,
} from "@/lib/mom-ai";

export const dynamic = "force-dynamic";

const MAX_MESSAGE_CHARS = 300;
const MAX_HISTORY_ITEMS = MAX_LIVE_TURNS * 2;

type HistoryItem = { role: "user" | "assistant"; content: string };

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

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const beatId = body?.beatId;
  const history = sanitizeHistory(body?.history);

  if (!isBeatId(beatId) || !history) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const userTurns = history.filter((m) => m.role === "user").length;
  if (userTurns > MAX_LIVE_TURNS) {
    return NextResponse.json({ reply: fallbackReply(beatId) });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ reply: fallbackReply(beatId) });
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 200,
      system: buildMomSystemPrompt(MOM_AI_CONTEXTS[beatId]),
      messages: history,
    });

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );
    const reply = textBlock?.text.trim();

    return NextResponse.json({ reply: reply || fallbackReply(beatId) });
  } catch {
    return NextResponse.json({ reply: fallbackReply(beatId) });
  }
}
