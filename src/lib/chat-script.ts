export type CraigslistContent = {
  kind: "craigslist";
  title: string;
  meta: string;
  body: string;
};

export type RedditContent = {
  kind: "reddit";
  byline: string;
  title: string;
  body: string;
  commentAuthor: string;
  commentBody: string;
};

export type ImageContent = CraigslistContent | RedditContent;

import type { BeatId } from "@/lib/mom-ai";

export type MessageStep = { kind: "message"; id: string; time: string; text: string };
export type ImageStep = { kind: "image"; id: string; time: string; content: ImageContent };
// A live back-and-forth with the Mom AI, scoped to one story beat.
export type ReplyStep = { kind: "reply"; id: string; beatId: BeatId };
export type ChoiceStep = { kind: "choice"; id: string };
// The "are you still there" pause: the typing indicator starts/stops a few
// times before this message finally lands.
export type FlickerStep = { kind: "flicker"; id: string; time: string; text: string };
// A typing indicator that appears and never resolves into a message.
export type FrozenStep = { kind: "frozen"; id: string };
// A "voice memo" attachment that plays back warped/garbled audio.
export type CorruptedAttachmentStep = { kind: "corrupted-attachment"; id: string; time: string };
// A one-off line referencing the player's real session — never explained.
export type FourthWallStep = { kind: "fourth-wall"; id: string };

export type ScriptStep =
  | MessageStep
  | ImageStep
  | ReplyStep
  | ChoiceStep
  | FlickerStep
  | FrozenStep
  | CorruptedAttachmentStep
  | FourthWallStep;

export type Path = "aware" | "compliant";

// The Craigslist ad's callout is the one place the player's real name should
// land — a specific wrong name (the old hardcoded "Jordan") reads worse than
// no name at all, so the fallback rephrases around it instead of guessing.
export function craigslistAdBody(name: string | null): string {
  const nameClause = name
    ? `a pharmacy loyalty receipt with your name printed right on it: ${name}.`
    : "a pharmacy loyalty receipt with your name printed right on it, clear as anything.";
  return `You were standing outside the pharmacy on 8th, red umbrella, on the phone with someone. You dropped a receipt when you were digging for your keys — ${nameClause} I picked it up to give it back but you'd already crossed the street. I still have it. I think about it more than I should. If this is you, I have something of yours.`;
}

export function nameCalloutText(name: string | null): string {
  return name
    ? `${name} — that's your name right there, isn't it`
    : "that's your name right there, isn't it";
}

export const INTRO_STEPS: ScriptStep[] = [
  { kind: "message", id: "m1", time: "9:41 PM", text: "hey are you awake" },
  {
    kind: "message",
    id: "m2",
    time: "9:41 PM",
    text: "don't answer if you're asleep, it's not important",
  },
  { kind: "reply", id: "r1", beatId: "opener" },
  { kind: "message", id: "m3", time: "9:43 PM", text: "ok good" },
  { kind: "message", id: "m4", time: "9:43 PM", text: "this is going to sound strange" },
  {
    kind: "message",
    id: "m5",
    time: "9:44 PM",
    text: "did you post something on craigslist a few years ago? like an ad?",
  },
  {
    kind: "message",
    id: "m6",
    time: "9:44 PM",
    text: "missed connections, I think it's called",
  },
  { kind: "reply", id: "r2", beatId: "craigslist-setup" },
  {
    kind: "message",
    id: "m8",
    time: "9:46 PM",
    text: "I found something today and I don't know why it has your name in it",
  },
  {
    kind: "image",
    id: "img1",
    time: "9:47 PM",
    content: {
      kind: "craigslist",
      title: "you dropped this — w4m — 24 (Riverside & 8th)",
      meta: "Posted 3 years, 7 months ago",
      body: craigslistAdBody(null),
    },
  },
  { kind: "message", id: "m9", time: "9:48 PM", text: nameCalloutText(null) },
  {
    kind: "message",
    id: "m10",
    time: "9:48 PM",
    text: "I don't understand how someone knew your name three years ago, you weren't even living here yet",
  },
  { kind: "reply", id: "r3", beatId: "impossible-timing" },
  {
    kind: "message",
    id: "m12",
    time: "9:52 PM",
    text: "somebody in a facebook group I'm in was talking about this exact post today",
  },
  {
    kind: "image",
    id: "img2",
    time: "9:53 PM",
    content: {
      kind: "reddit",
      byline: "r/nosleep — Posted by u/riverside_bystander — 3 years ago",
      title: "Does anyone else remember the umbrella ad on Craigslist?",
      body: 'I replied to it as a joke and got a response that made no sense: "She hasn\'t dropped it yet. You\'re early."',
      commentAuthor: "u/quietstreetlamp",
      commentBody:
        "I live two blocks from there. Never seen anyone drop anything outside it. Still think about this.",
    },
  },
  {
    kind: "message",
    id: "m13",
    time: "9:55 PM",
    text: '"she hasn\'t dropped it yet, you\'re early"',
  },
  { kind: "message", id: "m14", time: "9:55 PM", text: "that comment is from three years ago" },
  {
    kind: "message",
    id: "m15",
    time: "9:56 PM",
    text: "you dropped your umbrella outside that exact pharmacy last week. I picked it up and gave it back to you.",
  },
  { kind: "corrupted-attachment", id: "attachment1", time: "9:57 PM" },
  { kind: "fourth-wall", id: "fourthwall1" },
  { kind: "choice", id: "choice1" },
];

export const AWARE_STEPS: ScriptStep[] = [
  {
    kind: "message",
    id: "a1",
    time: "9:58 PM",
    text: "yeah. you're probably right. I'm going to stop looking at this stuff, it's late.",
  },
  { kind: "message", id: "a2", time: "9:58 PM", text: "goodnight. love you." },
  // A long, deliberately dead pause after the goodnight — the episode is
  // meant to feel over here — before one last mundane-but-wrong detail
  // arrives, hours later, with no follow-up. No jump scare, just a closing
  // wrongness that never resolves.
  {
    kind: "flicker",
    id: "a3",
    time: "3:12 AM",
    text: "the umbrella's back by the door. I don't remember bringing it in.",
  },
];

export const COMPLIANT_STEPS: ScriptStep[] = [
  { kind: "message", id: "c1", time: "9:58 PM", text: "ok. give me a second." },
  { kind: "message", id: "c2", time: "10:01 PM", text: "are you still there" },
  {
    kind: "flicker",
    id: "c3",
    time: "10:04 PM",
    text: "sorry. I stepped away and when I came back my messages to you were already marked as read. I hadn't opened this conversation again yet.",
  },
  { kind: "message", id: "c4", time: "10:04 PM", text: "did you read these already" },
  { kind: "reply", id: "r4", beatId: "read-receipt" },
  { kind: "message", id: "c5", time: "10:07 PM", text: "actually — quick thing before I go" },
  {
    kind: "message",
    id: "c6",
    time: "10:08 PM",
    text: "what's the something of yours you never got back",
  },
  { kind: "frozen", id: "frozen1" },
];

export const CHOICE_OPTIONS: { path: Path; label: string }[] = [
  {
    path: "aware",
    label: "That's really strange. We should stop looking into this.",
  },
  {
    path: "compliant",
    label: "Keep looking — I want to know what it means.",
  },
];

export type ResolvedItem =
  | {
      kind: "message";
      id: string;
      time: string;
      text: string;
      from: "mom" | "you";
      live?: boolean;
    }
  | { kind: "image"; id: string; time: string; content: ImageContent; from: "mom" }
  | { kind: "attachment"; id: string; time: string; from: "mom" };
