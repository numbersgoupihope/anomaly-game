"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import {
  AWARE_STEPS,
  COMPLIANT_STEPS,
  INTRO_STEPS,
  nameCalloutText,
  type FlickerStep,
  type MessageStep,
  type Path,
  type ReplyStep,
  type ResolvedItem,
  type ScriptStep,
} from "@/lib/chat-script";
import { MAX_LIVE_TURNS, classifyPathHeuristic, type BeatId } from "@/lib/mom-ai";
import {
  EVIDENCE_MAX_TURN,
  EVIDENCE_MIN_TURN,
  buildStructuralFallbackBody,
  pickVerbatimMessage,
} from "@/lib/evidence";
import { getAudioEngine } from "@/lib/audio";
import { useAnalogGlitch } from "@/lib/useAnalogGlitch";
import { useScrollbackGlitch } from "@/lib/useScrollbackGlitch";
import Atmosphere from "@/components/Atmosphere";
import ChatHeader from "@/components/chat/ChatHeader";
import TypingIndicator from "@/components/chat/TypingIndicator";
import MessageBubble from "@/components/chat/MessageBubble";
import ImageCard from "@/components/chat/ImageCard";
import TimeDivider from "@/components/chat/TimeDivider";
import LiveReplyComposer from "@/components/chat/LiveReplyComposer";
import CorruptedAttachment from "@/components/chat/CorruptedAttachment";
import HomeVideoClip from "@/components/chat/HomeVideoClip";

// The "are you still there" pause: on, off, on, off, on, off — landing the
// message right after the final off, ~15s total.
const FLICKER_SCHEDULE_MS = [2500, 1500, 2500, 1500, 2500, 4500];

// Spliced in right after a live exchange caps out, before the script
// resumes — a short, human "oh wait, actually" beat plus a dedicated
// follow-up line that actually continues that thought, so the pivot back to
// the scripted plot never reads as a cold, unrelated cut. Only defined for
// beats whose very next scripted line doesn't already read as a natural
// continuation of a live exchange (opener's "ok good" and read-receipt's
// "actually — quick thing before I go" already work on their own).
const BRIDGE_CONTENT: Partial<Record<BeatId, { bridge: string; followUp: string }>> = {
  "craigslist-setup": {
    bridge: "wait, actually — hold on, one more thing",
    followUp: "I probably shouldn't even bring this up, but I can't stop thinking about it",
  },
  "impossible-timing": {
    bridge: "hang on, there's one more thing",
    followUp: "I keep telling myself it's probably nothing, but I want to show you something",
  },
};
const PRE_BRIDGE_PAUSE_MS = 450;

type LiveHistory = { role: "user" | "assistant"; content: string };

function typingMsFor(text: string) {
  return Math.min(2400, Math.max(700, 500 + text.length * 15));
}

export default function ChatEpisode({ playerName }: { playerName: string }) {
  const [activeSteps, setActiveSteps] = useState<ScriptStep[]>(INTRO_STEPS);
  const [stepIndex, setStepIndex] = useState(0);
  const [resolved, setResolved] = useState<ResolvedItem[]>([]);
  const [path, setPath] = useState<Path | null>(null);
  const [flickerOn, setFlickerOn] = useState(true);
  const [disorient, setDisorient] = useState(false);
  const [liveTurnsByStep, setLiveTurnsByStep] = useState<Record<string, number>>({});
  const [liveBusy, setLiveBusy] = useState(false);
  const [frozenStopped, setFrozenStopped] = useState(false);
  // A second, distinct glitch — a chromatic-aberration flash across the
  // whole viewport, timed to the home video's freeze-frame anomaly. Kept
  // separate from the avatar-flicker/static-burst pair so the two beats
  // don't read as the same trick reused.
  const [videoGlitch, setVideoGlitch] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const mountTimeRef = useRef(0);
  const liveHistoryRef = useRef<Record<string, LiveHistory[]>>({});

  // The dynamic evidence state machine (section 2c) — deterministic app
  // logic, not driven by Mom's chat prompt. "checking" locks out overlapping
  // extraction attempts across turns; the generated (or, on failure by the
  // turn window's end, structurally-faked) body is cached here until the
  // ad's own step reads it.
  const evidenceStateRef = useRef<"pending" | "checking" | "ready">("pending");
  const evidenceBodyRef = useRef<string | null>(null);
  const playerLiveMessagesRef = useRef<string[]>([]);
  const evidenceTurnRef = useRef(0);
  // Mirrors evidenceTurnRef as state purely so the tension calculation
  // below (and the audio engine effect that reads it) re-renders on every
  // eligible turn — the ref alone wouldn't trigger anything.
  const [evidenceTurn, setEvidenceTurn] = useState(0);

  useEffect(() => {
    mountTimeRef.current = Date.now();
  }, []);

  // Escalating tension (0–1) driving the drone's dissonance and the glitch
  // effects' frequency. Before the evidence ad reveals, tension tracks the
  // state machine's proximity to firing the reveal (section 2c) — the
  // closer the app is to that trigger, the more the drone detunes — rather
  // than a fixed timer. Once the ad has revealed, it reverts to tracking
  // overall story progress for the rest of the episode.
  // Both sub-formulas are individually monotonic (evidenceTurn never
  // decreases, and freezes once the opener/craigslist-setup beats are
  // done; stepIndex never decreases either) and each is 0 while its own
  // stretch of the episode hasn't started yet, so taking their max is a
  // purely-derived way to get a monotonic overall value — no extra "peak
  // so far" state needed, and nothing to reset.
  const adRevealed = resolved.some((item) => item.id === "img1");
  const evidenceProximity = Math.min(1, evidenceTurn / EVIDENCE_MAX_TURN);
  const storyProgress = adRevealed ? Math.min(1, stepIndex / INTRO_STEPS.length) : 0;
  const tension = path ? 1 : Math.max(evidenceProximity, storyProgress);

  const { avatarGlitch, staticBurst } = useAnalogGlitch(tension);
  const m1Glitched = useScrollbackGlitch("chat-msg-m1");

  // What the player is looking at is entirely a function of where the
  // script pointer is — no separate "phase" state to keep in sync with it.
  const currentStep = activeSteps[stepIndex];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [resolved, currentStep, flickerOn]);

  // The drone grows more dissonant as tension climbs, whichever formula is
  // currently driving it.
  useEffect(() => {
    getAudioEngine().setTension(tension);
  }, [tension]);

  // Advances through messages/images/the fourth-wall line automatically;
  // reply/choice/frozen/attachment steps sit here until the player (or the
  // flicker effect) moves on.
  useEffect(() => {
    if (!currentStep) return;

    if (currentStep.kind === "message") {
      const step = currentStep;
      const text = step.id === "m9" ? nameCalloutText(playerName) : step.text;
      const t = setTimeout(() => {
        setResolved((r) => [
          ...r,
          { kind: "message", id: step.id, time: step.time, text, from: "mom" },
        ]);
        setStepIndex((i) => i + 1);
      }, typingMsFor(text));
      return () => clearTimeout(t);
    }

    if (currentStep.kind === "image") {
      const step = currentStep;
      // Safety net: by the time this beat is reached the state machine has
      // almost always already resolved (extraction/transform, or the
      // structural fallback at the turn window's close) — but if it somehow
      // hasn't, fall back to the same structural trick right here rather
      // than ever showing blank or generic placeholder copy.
      const content =
        step.id === "img1"
          ? {
              ...step.content,
              body:
                evidenceBodyRef.current ??
                buildStructuralFallbackBody(pickVerbatimMessage(playerLiveMessagesRef.current), playerName),
            }
          : step.content;
      const t = setTimeout(() => {
        setResolved((r) => [
          ...r,
          { kind: "image", id: step.id, time: step.time, content, from: "mom" },
        ]);
        setStepIndex((i) => i + 1);
      }, 1700);
      return () => clearTimeout(t);
    }

    if (currentStep.kind === "fourth-wall") {
      const step = currentStep;
      const elapsedSec = Math.round((Date.now() - mountTimeRef.current) / 1000);
      const text =
        elapsedSec < 90
          ? "you're still reading this right now, aren't you"
          : `you've been reading this for ${Math.max(1, Math.round(elapsedSec / 60))} minutes now`;
      const t = setTimeout(() => {
        setResolved((r) => [...r, { kind: "message", id: step.id, time: "", text, from: "mom" }]);
        setStepIndex((i) => i + 1);
        // A brief, unexplained wrongness right after — gone before you're sure you saw it.
        setTimeout(() => {
          setDisorient(true);
          setTimeout(() => setDisorient(false), 380);
        }, 250);
      }, 1400);
      return () => clearTimeout(t);
    }
  }, [currentStep, playerName]);

  // "Are you still there" — the typing indicator starts and stops a few
  // times before the message finally lands.
  useEffect(() => {
    if (currentStep?.kind !== "flicker") return;
    const step = currentStep as FlickerStep;

    let elapsed = 0;
    let on = true;
    const timers: ReturnType<typeof setTimeout>[] = [setTimeout(() => setFlickerOn(true), 0)];

    for (const ms of FLICKER_SCHEDULE_MS) {
      elapsed += ms;
      timers.push(
        setTimeout(() => {
          on = !on;
          setFlickerOn(on);
        }, elapsed)
      );
    }

    timers.push(
      setTimeout(() => {
        setResolved((r) => [
          ...r,
          { kind: "message", id: step.id, time: step.time, text: step.text, from: "mom" },
        ]);
        setStepIndex((i) => i + 1);
      }, elapsed + 400)
    );

    return () => timers.forEach(clearTimeout);
  }, [currentStep]);

  // The compliant ending's final beat is a typing indicator that never
  // resolves into a message — intentional, but indistinguishable from the
  // app being broken if it just bounces forever. After a few seconds it
  // visibly stops animating instead, so it reads as "this stopped
  // happening" rather than "this is stuck."
  useEffect(() => {
    if (currentStep?.kind !== "frozen") return;
    // This step is terminal (never re-entered), so there's no need to ever
    // reset this back to false — it only fires once, the one time it matters.
    const t = setTimeout(() => setFrozenStopped(true), 4500);
    return () => clearTimeout(t);
  }, [currentStep]);

  // 2c — the deterministic (non-AI) evidence state machine. Called with the
  // full grounding transcript right after each eligible player message;
  // fires and forgets from handleLiveSend so it never delays Mom's own live
  // reply. Extraction and transformation are two separate, narrow calls —
  // Mom's chat prompt is never involved and never told this is happening.
  async function runEvidenceCheck(
    transcriptSoFar: { from: "mom" | "you"; text: string }[],
    turnNumber: number
  ) {
    let succeeded = false;
    try {
      const extractRes = await fetch("/api/evidence-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcriptSoFar }),
      });
      const extractData = await extractRes.json().catch(() => null);
      const detail = typeof extractData?.detail === "string" ? extractData.detail.trim() : null;

      if (detail) {
        const transformRes = await fetch("/api/evidence-transform", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ detail, playerName }),
        });
        const transformData = await transformRes.json().catch(() => null);
        const generatedBody =
          typeof transformData?.body === "string" ? transformData.body.trim() : null;
        if (generatedBody) {
          evidenceBodyRef.current = generatedBody;
          evidenceStateRef.current = "ready";
          succeeded = true;
        }
      }
    } catch {
      // fall through — either retry on a later turn, or fall back below
    }

    if (!succeeded) {
      if (turnNumber >= EVIDENCE_MAX_TURN) {
        // The window has closed with nothing usable extracted — fall back
        // to the structural trick (a verbatim quote), never generic copy.
        evidenceBodyRef.current = buildStructuralFallbackBody(
          pickVerbatimMessage(playerLiveMessagesRef.current),
          playerName
        );
        evidenceStateRef.current = "ready";
      } else {
        evidenceStateRef.current = "pending";
      }
    }
  }

  async function handleLiveSend(text: string) {
    const step = currentStep as ReplyStep;
    const stepId = step.id;
    const turn = liveTurnsByStep[stepId] ?? 0;

    const youItem: ResolvedItem = {
      kind: "message",
      id: `you-${stepId}-${turn}`,
      time: "",
      text,
      from: "you",
    };
    setResolved((r) => [...r, youItem]);

    // The full conversation so far, for grounding — separate from the
    // per-beat exchange sent as the actual API turns below.
    const transcript = [...resolved, youItem].map((item) => {
      if (item.kind === "message") return { from: item.from, text: item.text };
      if (item.kind === "image") {
        return {
          from: "mom" as const,
          text:
            item.content.kind === "craigslist"
              ? "[sent a screenshot of an old Craigslist ad]"
              : "[sent a screenshot of a Reddit thread]",
        };
      }
      return { from: "mom" as const, text: "[sent a voice memo]" };
    });

    // Evidence state machine: only the opener and craigslist-setup beats
    // count toward the turn window (turns 1-6 combined) — extraction is
    // never attempted before turn 3, and re-runs on every eligible turn
    // through turn 6. Fired without awaiting so it never delays Mom's reply.
    if (step.beatId === "opener" || step.beatId === "craigslist-setup") {
      playerLiveMessagesRef.current = [...playerLiveMessagesRef.current, text];
      evidenceTurnRef.current += 1;
      const turnNow = evidenceTurnRef.current;
      setEvidenceTurn(turnNow);
      if (
        evidenceStateRef.current === "pending" &&
        turnNow >= EVIDENCE_MIN_TURN &&
        turnNow <= EVIDENCE_MAX_TURN
      ) {
        evidenceStateRef.current = "checking";
        void runEvidenceCheck(transcript, turnNow);
      }
    }

    const history = liveHistoryRef.current[stepId] ?? [];
    history.push({ role: "user", content: text });
    liveHistoryRef.current[stepId] = history;

    setLiveBusy(true);
    let reply = "yeah";
    try {
      const res = await fetch("/api/chat-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beatId: step.beatId,
          history,
          transcript,
          playerName,
        }),
      });
      const data = await res.json().catch(() => null);
      if (typeof data?.reply === "string" && data.reply.trim()) reply = data.reply.trim();
    } catch {
      // keep the safe fallback reply
    }

    liveHistoryRef.current[stepId] = [...history, { role: "assistant", content: reply }];
    setResolved((r) => [
      ...r,
      { kind: "message", id: `mom-live-${stepId}-${turn}`, time: "", text: reply, from: "mom", live: true },
    ]);
    setLiveBusy(false);
    setLiveTurnsByStep((m) => ({ ...m, [stepId]: turn + 1 }));

    // The handoff to the next scripted beat is mechanical, not conditional
    // on what the player said — this must fire even if the player tried to
    // end the conversation early, so it can never hang waiting for a skip
    // that no longer exists. Beats whose next scripted line doesn't already
    // read as a natural continuation get a bridge line plus a dedicated
    // follow-up (its own typing indicator each, same as any scripted
    // message) so the pivot back to the plot never reads as a cold cut.
    if (turn + 1 >= MAX_LIVE_TURNS) {
      const bridge = BRIDGE_CONTENT[step.beatId];
      if (bridge) {
        const bridgeStep: MessageStep = {
          kind: "message",
          id: `bridge-${stepId}`,
          time: "",
          text: bridge.bridge,
        };
        const followUpStep: MessageStep = {
          kind: "message",
          id: `bridge-followup-${stepId}`,
          time: "",
          text: bridge.followUp,
        };
        setActiveSteps((steps) => {
          const idx = steps.findIndex((s) => s.id === stepId);
          if (idx === -1) return steps;
          const copy = [...steps];
          copy.splice(idx + 1, 0, bridgeStep, followUpStep);
          return copy;
        });
      }
      setTimeout(() => setStepIndex((i) => i + 1), PRE_BRIDGE_PAUSE_MS);
    }
  }

  function handlePick(p: Path) {
    setPath(p);
    setActiveSteps(p === "aware" ? AWARE_STEPS : COMPLIANT_STEPS);
    setStepIndex(0);
  }

  // The free-text replacement for the old two-button choice screen: one
  // reply, classified server-side (with a client-side heuristic fallback if
  // the request fails outright) into whichever ending path it leans
  // toward — the classification always resolves to one of the two paths,
  // never leaves the episode hanging undecided.
  async function handleChoiceSend(text: string) {
    const step = currentStep as { id: string };
    const youItem: ResolvedItem = {
      kind: "message",
      id: `you-${step.id}`,
      time: "",
      text,
      from: "you",
    };
    setResolved((r) => [...r, youItem]);

    const transcript = [...resolved, youItem].map((item) => {
      if (item.kind === "message") return { from: item.from, text: item.text };
      if (item.kind === "image") {
        return {
          from: "mom" as const,
          text:
            item.content.kind === "craigslist"
              ? "[sent a screenshot of an old Craigslist ad]"
              : "[sent a screenshot of a Reddit thread]",
        };
      }
      return { from: "mom" as const, text: "[sent a voice memo]" };
    });

    setLiveBusy(true);
    let reply = "yeah... ok";
    let path: Path = classifyPathHeuristic(text);
    try {
      const res = await fetch("/api/chat-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beatId: "choice",
          history: [{ role: "user", content: text }],
          transcript,
          playerName,
          askForName: false,
        }),
      });
      const data = await res.json().catch(() => null);
      if (typeof data?.reply === "string" && data.reply.trim()) reply = data.reply.trim();
      if (data?.path === "aware" || data?.path === "compliant") path = data.path;
    } catch {
      // keep the safe fallback reply + client-side heuristic path
    }

    setResolved((r) => [
      ...r,
      { kind: "message", id: `mom-live-${step.id}`, time: "", text: reply, from: "mom", live: true },
    ]);

    // Stays busy (composer disabled, no second submission possible) through
    // this pause — the reply visibly lands before the ending sequence takes
    // over, which is the only way the episode ends past this point.
    setTimeout(() => {
      setLiveBusy(false);
      handlePick(path);
    }, 900);
  }

  const liveTurns = currentStep ? liveTurnsByStep[currentStep.id] ?? 0 : 0;

  return (
    <>
      <Atmosphere staticBurst={staticBurst} />
      {disorient && (
        <div className="pointer-events-none fixed inset-0 z-40 bg-white mix-blend-difference" />
      )}
      {videoGlitch && (
        <div className="pointer-events-none fixed inset-0 z-40">
          <div className="absolute inset-0 -translate-x-[3px] bg-red-500/25 mix-blend-screen" />
          <div className="absolute inset-0 translate-x-[3px] bg-cyan-400/25 mix-blend-screen" />
        </div>
      )}
      <div
        className={`transition-transform duration-150 ${
          disorient ? "-rotate-1 scale-[1.02]" : ""
        }`}
      >
        <ChatHeader glitch={avatarGlitch} />
        <div
          className={`mx-auto flex w-full max-w-xl flex-col gap-3 px-4 pb-28 pt-4 ${
            staticBurst ? "translate-x-[2px]" : ""
          }`}
        >
          {resolved.map((item, idx) => {
            const prevTime = idx > 0 ? resolved[idx - 1].time : "";
            const showDivider = Boolean(item.time) && item.time !== prevTime;
            const isM1 = item.kind === "message" && item.id === "m1";

            return (
              <Fragment key={item.id}>
                {showDivider && <TimeDivider time={item.time} glitch={item.id === "m9"} />}
                {item.kind === "message" ? (
                  <MessageBubble
                    from={item.from}
                    text={isM1 && m1Glitched ? "hey are you still up" : item.text}
                    domId={isM1 ? "chat-msg-m1" : undefined}
                  />
                ) : item.kind === "image" ? (
                  <div className="flex justify-start">
                    <ImageCard content={item.content} />
                  </div>
                ) : item.kind === "home-video" ? (
                  <HomeVideoClip initialPlayed onPlayed={() => {}} />
                ) : (
                  <CorruptedAttachment initialPlayed onPlayed={() => {}} />
                )}
              </Fragment>
            );
          })}

          {(currentStep?.kind === "message" ||
            currentStep?.kind === "image" ||
            currentStep?.kind === "fourth-wall") && <TypingIndicator />}

          {currentStep?.kind === "flicker" && flickerOn && <TypingIndicator />}
          {currentStep?.kind === "frozen" && <TypingIndicator frozen={frozenStopped} />}
          {liveBusy && <TypingIndicator />}

          {currentStep?.kind === "corrupted-attachment" && (
            <CorruptedAttachment
              onPlayed={() => {
                const step = currentStep;
                setResolved((r) => [
                  ...r,
                  { kind: "attachment", id: step.id, time: step.time, from: "mom" },
                ]);
                setStepIndex((i) => i + 1);
              }}
            />
          )}

          {currentStep?.kind === "home-video" && (
            <HomeVideoClip
              onFreezeFrame={() => {
                setVideoGlitch(true);
                setTimeout(() => setVideoGlitch(false), 260);
              }}
              onPlayed={() => {
                const step = currentStep;
                setResolved((r) => [
                  ...r,
                  { kind: "home-video", id: step.id, time: step.time, from: "mom" },
                ]);
                setStepIndex((i) => i + 1);
              }}
            />
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {currentStep?.kind === "reply" && (
        <LiveReplyComposer
          turnsUsed={liveTurns}
          maxTurns={MAX_LIVE_TURNS}
          disabled={liveBusy}
          onSend={handleLiveSend}
        />
      )}
      {currentStep?.kind === "choice-input" && (
        <LiveReplyComposer turnsUsed={0} maxTurns={1} disabled={liveBusy} onSend={handleChoiceSend} />
      )}
    </>
  );
}
