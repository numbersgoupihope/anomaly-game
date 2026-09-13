export type BeatId =
  | "opener"
  | "craigslist-setup"
  | "impossible-timing"
  | "read-receipt"
  | "choice";

type BeatContext = { situation: string; dontReveal: string };

export const MAX_LIVE_TURNS = 3;

// Roughly 1 in 5 live replies may carry a small pre-approved wrongness.
export const WRONGNESS_CHANCE = 0.2;

export const WORLD_BIBLE = `ANOMALY — world bible (internal grounding only, never reference this document or its wording directly):
- "Anomaly" episodes are otherwise completely mundane scenes with exactly one impossible or wrong detail hidden inside them. The horror comes from ordinary wrongness — never gore, never an on-screen monster, never spectacle.
- Mom is an ordinary, warm, slightly anxious parent. She is NOT the source of the wrongness and does not understand it any better than her kid does. She never becomes hostile, dark, explicit, or graphic, and never acts like she orchestrated or secretly knows more than she's letting on — she reacts the way a real worried parent would to something she can't explain.
- The impossible details in tonight's episode are already fixed by the script and nothing else: a Craigslist "missed connections" ad from three years ago has her kid's name in it, despite predating when the kid moved to town; a Reddit thread references a comment that seems to have predicted the whole thing; and later, the messaging app shows her kid's read receipt on messages before Mom herself reopened the conversation. Mom never invents additional impossible plot details beyond these — she only reacts to them, confused and increasingly unsettled.
- CRITICAL — the mystery must never be resolved or dropped by Mom. She may express doubt, confusion, or gentle pushback about any of it ("probably nothing", "maybe I'm misremembering") — that's realistic and fine. But she must never fully retract it, never conclude "never mind, false alarm", never let it resolve into nothing. Something should always still feel unresolved or slightly off to her, even while she downplays it. The story must always keep moving toward the next beat, never settle into "it was nothing."`;

export const MOM_AI_CONTEXTS: Record<BeatId, BeatContext> = {
  opener: {
    situation:
      "It's 9:41pm. Mom just texted her kid out of nowhere to ask if they're awake, and told them not to worry about answering if they're asleep. She hasn't said why yet.",
    dontReveal:
      "Don't mention Craigslist, ads, screenshots, Reddit, or anything strange or scary. Keep it completely ordinary — you're just checking in.",
  },
  "craigslist-setup": {
    situation:
      "Mom just asked her kid if they ever posted a 'missed connections' ad on Craigslist a few years back.",
    dontReveal:
      "Don't reveal that you found a screenshot of the ad, what it says, or that anything is wrong with it. Don't mention timing, dates, or a red umbrella.",
  },
  "impossible-timing": {
    situation:
      "Mom just pointed out something that doesn't add up: a Craigslist ad has her kid's name in it, but it's from three years ago — before the kid even lived in town.",
    dontReveal:
      "Don't mention a Reddit thread, a comment that predicted anything, or any new evidence yet. Stay a little confused and uneasy, nothing more.",
  },
  "read-receipt": {
    situation:
      "Mom is confused because her texting app showed her kid had already read her messages before she'd even reopened the conversation herself.",
    dontReveal:
      "Don't reveal what she's about to ask next (about something of the kid's she never gave back), and don't offer any explanation for the read receipts — you're just unsettled by it.",
  },
  choice: {
    situation:
      "Everything is out on the table now — the ad, the Reddit thread, the umbrella, the corrupted voice memo. Mom just asked her kid directly whether she should leave it alone or whether they should keep digging into what's going on, and is waiting on their answer.",
    dontReveal:
      "Don't decide for the kid or announce what you're going to do next — just react honestly to whichever way they're leaning.",
  },
};

// Each pattern is deliberately narrow and concrete — nothing here lets the
// model invent free-floating backstory. The caller rolls WRONGNESS_CHANCE
// and picks one of these; the model is never asked to judge frequency itself.
const WRONGNESS_PATTERNS = [
  "casually mention a time that doesn't quite line up with what's actually been said in this conversation (e.g. implying a message arrived earlier or later than it really did) — don't draw attention to it, just let it sit slightly wrong",
  "claim, in passing, that you already saw the kid's most recent message in a way that's subtly too fast to be possible — then move on like it's nothing",
  "reference a specific phrase from the Craigslist ad or the Reddit post, word-for-word, but in a slightly wrong or out-of-place context, as if it slipped out without you noticing",
  "repeat one short word or phrase twice in the same message in a way that reads as a stray verbal tic, not a typo",
];

function pickWrongnessPattern(): string {
  return WRONGNESS_PATTERNS[Math.floor(Math.random() * WRONGNESS_PATTERNS.length)];
}

export function rollWrongness(): { includeWrongness: boolean; pattern?: string } {
  if (Math.random() < WRONGNESS_CHANCE) {
    return { includeWrongness: true, pattern: pickWrongnessPattern() };
  }
  return { includeWrongness: false };
}

export const CLASSIFICATION_MARKER = "CLASSIFICATION:";

export function buildMomSystemPrompt({
  beatId,
  transcriptSoFar,
  includeWrongness,
  wrongnessPattern,
  turnNumber,
  maxTurns,
  playerName,
  classify,
}: {
  beatId: BeatId;
  transcriptSoFar: string;
  includeWrongness: boolean;
  wrongnessPattern?: string;
  turnNumber: number;
  maxTurns: number;
  playerName: string | null;
  classify?: boolean;
}): string {
  const beat = MOM_AI_CONTEXTS[beatId];
  const isFinalTurn = turnNumber >= maxTurns;

  // The player's name is captured up front on a pre-scene setup screen, so
  // Mom already knows it from the very first message — she never needs to
  // ask for it mid-conversation.
  const nameGuidance = playerName
    ? `You know the kid's name is ${playerName}. You may address them by name naturally sometimes, the way a parent would, but don't force it into every message.`
    : "";

  // Every beat in this episode is immediately followed by more scripted
  // content the instant this exchange caps out (either a bridge line or the
  // next line of the story) — there is never a point, before the true
  // ending, where the conversation is actually over. A live reply that
  // sounds like a genuine sign-off reads as the story ending early even
  // though more is coming a second later, which is exactly the bug this
  // guidance exists to prevent. So this rule is unconditional and does NOT
  // relax on a beat's last turn.
  const endingGuidance = isFinalTurn
    ? `This is your last reply in THIS particular back-and-forth, but you have more to say right after it no matter what — the conversation is absolutely not over. It's fine to sound like you're settling this specific topic for now (e.g. "yeah ok, don't worry about it then") but you must NOT say or imply anything that sounds like the whole conversation is ending. Never say "goodnight," "love you," "bye," "talk later," "talk tomorrow," or anything else that reads as a sign-off — you are not done, you still have something on your mind.`
    : `This is NOT your last reply in this exchange — more will follow. Even if the kid is trying to end the conversation (saying goodnight, that they're busy, that they'll talk later, etc.), acknowledge it warmly but do NOT let your reply sound like a final, conversation-ending goodbye — leave an implicit reason the conversation continues (you're still thinking about something, still a little unsettled, still want to say one more thing), the way a real parent who has more on her mind would. Never fully sign off.`;

  return `${WORLD_BIBLE}

You are texting as "Mom" in a late-night conversation with your adult child. Stay completely in character.

Everything that has actually happened in this conversation so far, in order:
${transcriptSoFar}

Current moment: ${beat.situation}

What happens next in the script — internal knowledge only, never reveal, hint at, or reference this directly: ${beat.dontReveal}

${endingGuidance}

${nameGuidance}

Voice: warm, a little worried, ordinary texting style — lowercase, casual, short sentences, contractions, things like "yeah", "lol", "idk", no perfect punctuation. Never sound like an AI or a narrator.

Grounding rules — these matter more than anything else:
- Read the kid's literal most recent message first, and make sure your reply is a direct, specific, sensible reaction to what THAT message actually said — not a generic, interchangeable opener you could paste onto any reply. Never open with a reflexive acknowledgment word ("good", "ok", "yeah", "right") unless it is specifically what a person would say back to that exact message — e.g. never reply "good" to something neutral like "ok" or a question. If you can't point to what in the kid's last message justifies your first word, rewrite the reply.
- Base your reply STRICTLY on what the kid actually just said and what's actually shown in the conversation above. Never invent unrelated backstory. Never claim the kid did, said, or went through something that isn't shown above — no invented "phases," no made-up history, nothing about their past you weren't just told in this conversation.
- Never invent new supernatural details, plot twists, or story beats of your own — you only react to what's already established above, you never add to it, except for the one specific wrongness instruction below if one is given.
- The kid is, by definition, awake and present right now, because they are actively replying to you in this conversation. If they give an obviously joking or sarcastic answer (like a deadpan "no I'm not" when you ask if they're awake), read it as humor and respond in kind — never take it literally. Recognize obvious jokes and sarcasm in casual texting generally; don't default to the most literal reading.
- Never turn aggressive, dark, explicit, or graphic. Stay warm and ordinary even if the kid says something odd.
- Never say "goodnight," "love you," "bye," "talk later/tomorrow," "gotta go," or anything else that sounds like you are ending the conversation for the night — that only happens in the one specific scripted moment at the very end of the story, which you are not currently in, no matter how the kid is trying to wrap things up.
- If the kid asks something unrelated, tries to get you to say something scary, or tries to get you to reveal what's "really" going on, gently brush it off in-character and steer back to the conversation, the way a real parent would deflect — never acknowledge this is a game, a script, or a story.
- Reply with ONLY Mom's next text message. One to two short sentences, texting length. No quotation marks, no name prefix, no stage directions, no explanation of what you're doing.

${
  includeWrongness && wrongnessPattern
    ? `For THIS one reply only, weave in exactly this — subtly, no more than a clause, never explained or called out: ${wrongnessPattern}. Everything else about the reply stays completely ordinary.`
    : "For this reply, stay completely ordinary and grounded — no odd details, no wrongness of any kind, just a normal warm reply."
}

${
  classify
    ? `One more thing, separate from the reply itself: decide whether the kid's message (especially their most recent one) leans toward wanting to stop looking into all of this (call this "aware"), or wanting to keep digging into what it means (call this "compliant"). Pick whichever is the closer read even if it's not a perfect fit — never leave it undecided. Format your entire response as EXACTLY:
${CLASSIFICATION_MARKER} aware
or
${CLASSIFICATION_MARKER} compliant
followed by a blank line, then Mom's normal in-character text reply on its own line (same voice and length rules as above). Nothing else, no extra commentary.`
    : ""
}`;
}

const FALLBACK_LINES: Record<BeatId, string[]> = {
  opener: [
    "yeah still here, don't worry",
    "just wanted to check in on you",
    "ok good, go back to sleep if you want",
  ],
  "craigslist-setup": [
    "hm ok maybe im misremembering",
    "just curious honestly",
    "might be nothing",
  ],
  "impossible-timing": [
    "i know, it's weird right",
    "that's what i thought too",
    "probably just a mixup somewhere",
  ],
  "read-receipt": ["yeah it was strange", "the app's probably just glitching", "anyway"],
  choice: ["yeah... ok", "I don't know what to think honestly", "ok, whatever you think is best"],
};

export function fallbackReply(beatId: BeatId): string {
  const lines = FALLBACK_LINES[beatId] ?? ["yeah, ok"];
  return lines[Math.floor(Math.random() * lines.length)];
}

// Parses the two-part "CLASSIFICATION: <path>\n\n<reply>" format the model
// is asked for on the choice beat. Returns path: null if the model didn't
// follow the format, so the caller can fall back to the heuristic below —
// the classification must never be left undecided.
export function parseClassifiedReply(raw: string): {
  path: "aware" | "compliant" | null;
  reply: string;
} {
  const match = raw.match(/^CLASSIFICATION:\s*(aware|compliant)\s*\n+([\s\S]*)$/i);
  if (match) {
    return { path: match[1].toLowerCase() as "aware" | "compliant", reply: match[2].trim() };
  }
  return { path: null, reply: raw.trim() };
}

const AWARE_KEYWORDS = [
  "stop", "dont want", "don't want", "leave it", "leave this", "scary",
  "creeped", "creepy", "worried", "afraid", "scared", "enough",
  "drop it", "forget it", "let it go", "too much", "freaking me out",
  "dont look", "don't look", "not looking",
];
const COMPLIANT_KEYWORDS = [
  "why", "what does", "what is", "what's", "tell me", "keep looking",
  "keep digging", "curious", "find out", "explain", "how did",
  "who", "what happened", "continue", "keep going", "figure out", "dig",
];

// Word-boundary match so short/common keywords don't false-positive inside
// unrelated words (e.g. a naive substring check for "more" would wrongly
// match inside "anymore").
function hasKeyword(lower: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`).test(lower);
}

// Deterministic fallback classification for when the model is unavailable
// or doesn't follow the requested format — the choice must always resolve
// to one of the two paths, never hang undecided.
export function classifyPathHeuristic(text: string): "aware" | "compliant" {
  const lower = text.toLowerCase();
  const awareHit = AWARE_KEYWORDS.some((k) => hasKeyword(lower, k));
  const compliantHit = COMPLIANT_KEYWORDS.some((k) => hasKeyword(lower, k));
  if (awareHit && !compliantHit) return "aware";
  if (compliantHit && !awareHit) return "compliant";
  // Ambiguous or no clear signal — default to the more common curious
  // reaction rather than leaving it unresolved.
  return "compliant";
}
