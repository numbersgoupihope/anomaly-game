// The dynamic "evidence" mechanic — deliberately built from small, narrow,
// single-purpose pieces instead of one freeform AI call. Mom's own chat
// prompt (mom-ai.ts) never sees any of this; the reveal is assembled by app
// logic and inserted as its own beat.

export const EVIDENCE_MIN_TURN = 3;
export const EVIDENCE_MAX_TURN = 6;

export const EVIDENCE_MODEL_CANDIDATES = ["claude-haiku-4-5", "claude-haiku-4-5-20251001"];

// 2a — extraction: a strict, low-temperature classifier. Its only job is to
// find one concrete personal detail the KID actually typed, or say NONE.
// It must never invent, infer, or embellish.
export function buildExtractionSystemPrompt(): string {
  return `You are a careful, mechanical classifier. You are not a creative writer and not in character as anyone.

Read the conversation below between "Mom" and her kid. Look for ONE concrete, specific, personal detail the KID (never Mom) has actually typed about themselves — a specific place, a specific memory, a habit, a nickname, an object, a routine. It must be something the kid actually said, in substance, word for word — never something you infer, guess, generalize, or embellish.

Rules:
- Only ever draw from the kid's own messages, never Mom's.
- The detail must be concrete and specific, not a vague mood or a one-word feeling. "tired" is not usable. "I used to bike to the lake behind my old apartment every morning" is usable.
- If more than one usable detail exists, pick the single most specific and concrete one.
- If nothing usable exists yet, respond with exactly: NONE
- Otherwise, respond with ONLY a short, economical paraphrase of that one detail — a few words to one short phrase. No extra commentary, no explanation, no quotation marks, no preamble. Either that short phrase, or exactly NONE. Nothing else is acceptable.`;
}

// 2b — transformation: takes ONLY the short extracted phrase (plus the
// player's name, a tiny fixed piece of data, not the conversation) and
// rewrites it into third-person "evidence" copy in the existing
// Craigslist/missed-connections template.
export function buildTransformationSystemPrompt(): string {
  return `You write short, unsettling "evidence" copy for a horror text-adventure. You will be given exactly two things: a short personal detail, and a first name. Nothing else — no conversation, no other context, and you must not ask for any.

Write 2-4 sentences of third-person "missed connections"-style classified-ad copy, as if a stranger encountered this detail about the person in public and is describing it back — dated years before it could actually have happened. It should read as ordinary, mundane classified-ad prose on its surface (plain, grounded, texting-ad register — not literary, not purple), with exactly one thing wrong: the timing. Slightly off, quietly impossible — never explained, never commented on, never flagged as strange within the text itself.

Work the detail in naturally, as something the stranger specifically noticed. Work the name in naturally too, as something the stranger picked up on and is repeating back (e.g. "...you told the barista your name was {name}" or "...called you {name}, I think") — never just dropped in with no reason given for how the stranger would know it. End with a small unsettling closing touch, echoing a classic missed-connections ad — that the writer still has "something" of theirs, or thinks about it more than they should, or similar. Never invent violence, gore, romantic or sexual content, or anything graphic.

Reply with ONLY the ad body text itself — no title, no headers, no quotation marks, no explanation, nothing else.`;
}

const NONE_MARKER = "NONE";

export function parseExtractedDetail(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.toUpperCase() === NONE_MARKER) return null;
  // Defensive: strip surrounding quotes the model might add despite instructions.
  return trimmed.replace(/^["']+|["']+$/g, "").slice(0, 200);
}

// 2c fallback — if extraction never succeeds within the turn window, twist
// something the player actually typed verbatim into the ad instead of
// falling back to fully generic copy. Picks the longest (most substantive)
// message the player sent during the eligible window.
export function pickVerbatimMessage(messages: string[]): string {
  return messages.reduce((longest, m) => (m.trim().length > longest.trim().length ? m : longest), "");
}

export function buildStructuralFallbackBody(verbatimText: string, name: string): string {
  const quoted = verbatimText.trim().slice(0, 140);
  if (!quoted) {
    return `You were standing outside the pharmacy on 8th, red umbrella, on the phone with someone. I picked up a receipt with your name on it — ${name} — after you crossed the street. I still have it. I think about it more than I should.`;
  }
  return `You were standing outside the pharmacy on 8th, red umbrella, on the phone with someone. I couldn't hear much, but I caught exactly what you said — word for word, like you'd say it right now: "${quoted}" You told someone your name was ${name}. I picked up a receipt you dropped after you crossed the street. I still have it. I think about it more than I should.`;
}
