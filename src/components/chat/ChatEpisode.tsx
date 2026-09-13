"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import {
  AWARE_STEPS,
  COMPLIANT_STEPS,
  INTRO_STEPS,
  type FlickerStep,
  type MessageStep,
  type Path,
  type ReplyStep,
  type ResolvedItem,
  type ScriptStep,
} from "@/lib/chat-script";
import { MAX_LIVE_TURNS } from "@/lib/mom-ai";
import { getAudioEngine } from "@/lib/audio";
import { useAnalogGlitch } from "@/lib/useAnalogGlitch";
import { useScrollbackGlitch } from "@/lib/useScrollbackGlitch";
import Atmosphere from "@/components/Atmosphere";
import ChatHeader from "@/components/chat/ChatHeader";
import TypingIndicator from "@/components/chat/TypingIndicator";
import MessageBubble from "@/components/chat/MessageBubble";
import ImageCard from "@/components/chat/ImageCard";
import TimeDivider from "@/components/chat/TimeDivider";
import ChoicePrompt from "@/components/chat/ChoicePrompt";
import LiveReplyComposer from "@/components/chat/LiveReplyComposer";
import CorruptedAttachment from "@/components/chat/CorruptedAttachment";

// The "are you still there" pause: on, off, on, off, on, off — landing the
// message right after the final off, ~15s total.
const FLICKER_SCHEDULE_MS = [2500, 1500, 2500, 1500, 2500, 4500];

// Spliced in right after a live exchange caps out, before the script
// resumes — a short, human "oh wait, actually" beat so the pivot back to
// the scripted plot never reads as a cold, unrelated cut.
const BRIDGE_TEXT = "wait, actually — hold on, one more thing";
const PRE_BRIDGE_PAUSE_MS = 450;

type LiveHistory = { role: "user" | "assistant"; content: string };

function typingMsFor(text: string) {
  return Math.min(2400, Math.max(700, 500 + text.length * 15));
}

export default function ChatEpisode() {
  const [activeSteps, setActiveSteps] = useState<ScriptStep[]>(INTRO_STEPS);
  const [stepIndex, setStepIndex] = useState(0);
  const [resolved, setResolved] = useState<ResolvedItem[]>([]);
  const [path, setPath] = useState<Path | null>(null);
  const [flickerOn, setFlickerOn] = useState(true);
  const [disorient, setDisorient] = useState(false);
  const [liveTurnsByStep, setLiveTurnsByStep] = useState<Record<string, number>>({});
  const [liveBusy, setLiveBusy] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const mountTimeRef = useRef(0);
  const liveHistoryRef = useRef<Record<string, LiveHistory[]>>({});

  useEffect(() => {
    mountTimeRef.current = Date.now();
  }, []);

  const { avatarGlitch, staticBurst } = useAnalogGlitch();
  const m1Glitched = useScrollbackGlitch("chat-msg-m1");

  // What the player is looking at is entirely a function of where the
  // script pointer is — no separate "phase" state to keep in sync with it.
  const currentStep = activeSteps[stepIndex];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [resolved, currentStep, flickerOn]);

  // The drone grows more dissonant as the conversation heads toward the
  // choice — reuses the same detune logic the old 30s timer drove.
  useEffect(() => {
    const introLength = INTRO_STEPS.length;
    const tension = path ? 1 : Math.min(1, stepIndex / introLength);
    getAudioEngine().setTension(tension);
  }, [stepIndex, path]);

  // Advances through messages/images/the fourth-wall line automatically;
  // reply/choice/frozen/attachment steps sit here until the player (or the
  // flicker effect) moves on.
  useEffect(() => {
    if (!currentStep) return;

    if (currentStep.kind === "message") {
      const step = currentStep;
      const t = setTimeout(() => {
        setResolved((r) => [
          ...r,
          { kind: "message", id: step.id, time: step.time, text: step.text, from: "mom" },
        ]);
        setStepIndex((i) => i + 1);
      }, typingMsFor(step.text));
      return () => clearTimeout(t);
    }

    if (currentStep.kind === "image") {
      const step = currentStep;
      const t = setTimeout(() => {
        setResolved((r) => [
          ...r,
          { kind: "image", id: step.id, time: step.time, content: step.content, from: "mom" },
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
  }, [currentStep]);

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

    const history = liveHistoryRef.current[stepId] ?? [];
    history.push({ role: "user", content: text });
    liveHistoryRef.current[stepId] = history;

    setLiveBusy(true);
    let reply = "yeah";
    try {
      const res = await fetch("/api/chat-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beatId: step.beatId, history, transcript }),
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
    // that no longer exists. A short bridge line (its own typing indicator,
    // same as any scripted message) softens the pivot instead of cutting
    // straight back into the plot.
    if (turn + 1 >= MAX_LIVE_TURNS) {
      const bridgeStep: MessageStep = {
        kind: "message",
        id: `bridge-${stepId}`,
        time: "",
        text: BRIDGE_TEXT,
      };
      setActiveSteps((steps) => {
        const idx = steps.findIndex((s) => s.id === stepId);
        if (idx === -1) return steps;
        const copy = [...steps];
        copy.splice(idx + 1, 0, bridgeStep);
        return copy;
      });
      setTimeout(() => setStepIndex((i) => i + 1), PRE_BRIDGE_PAUSE_MS);
    }
  }

  function handlePick(p: Path) {
    setPath(p);
    setActiveSteps(p === "aware" ? AWARE_STEPS : COMPLIANT_STEPS);
    setStepIndex(0);
  }

  const liveTurns = currentStep ? liveTurnsByStep[currentStep.id] ?? 0 : 0;

  return (
    <>
      <Atmosphere staticBurst={staticBurst} />
      {disorient && (
        <div className="pointer-events-none fixed inset-0 z-40 bg-white mix-blend-difference" />
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
          {currentStep?.kind === "frozen" && <TypingIndicator />}
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

          {currentStep?.kind === "choice" && <ChoicePrompt onPick={handlePick} />}

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
    </>
  );
}
