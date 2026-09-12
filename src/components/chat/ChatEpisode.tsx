"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import {
  AWARE_STEPS,
  COMPLIANT_STEPS,
  INTRO_STEPS,
  type FlickerStep,
  type Path,
  type ReplyStep,
  type ResolvedItem,
  type ScriptStep,
} from "@/lib/chat-script";
import { MAX_LIVE_TURNS } from "@/lib/mom-ai";
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
import ReviewScreen from "@/components/chat/ReviewScreen";

// The "are you still there" pause: on, off, on, off, on, off — landing the
// message right after the final off, ~15s total.
const FLICKER_SCHEDULE_MS = [2500, 1500, 2500, 1500, 2500, 4500];

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
  const [showContinue, setShowContinue] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
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
  const awareFinished = !currentStep && path === "aware";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [resolved, currentStep, flickerOn]);

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

  useEffect(() => {
    if (currentStep?.kind !== "frozen" && !awareFinished) return;
    const t = setTimeout(
      () => setShowContinue(true),
      currentStep?.kind === "frozen" ? 3000 : 1400
    );
    return () => clearTimeout(t);
  }, [currentStep, awareFinished]);

  async function handleLiveSend(text: string) {
    const step = currentStep as ReplyStep;
    const stepId = step.id;
    const turn = liveTurnsByStep[stepId] ?? 0;

    setResolved((r) => [
      ...r,
      { kind: "message", id: `you-${stepId}-${turn}`, time: "", text, from: "you" },
    ]);

    const history = liveHistoryRef.current[stepId] ?? [];
    history.push({ role: "user", content: text });
    liveHistoryRef.current[stepId] = history;

    setLiveBusy(true);
    let reply = "yeah";
    try {
      const res = await fetch("/api/chat-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beatId: step.beatId, history }),
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
  }

  function handleLiveSkip() {
    setStepIndex((i) => i + 1);
  }

  function handlePick(p: Path) {
    setPath(p);
    setActiveSteps(p === "aware" ? AWARE_STEPS : COMPLIANT_STEPS);
    setStepIndex(0);
  }

  if (reviewMode && path) {
    return (
      <>
        <Atmosphere />
        <ReviewScreen resolved={resolved} path={path} />
      </>
    );
  }

  const liveTurns = currentStep ? liveTurnsByStep[currentStep.id] ?? 0 : 0;

  return (
    <>
      <Atmosphere staticBurst={staticBurst} />
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
              ) : (
                <div className="flex justify-start">
                  <ImageCard content={item.content} />
                </div>
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
          <CorruptedAttachment onPlayed={() => setStepIndex((i) => i + 1)} />
        )}

        {currentStep?.kind === "choice" && <ChoicePrompt onPick={handlePick} />}

        {(currentStep?.kind === "frozen" || awareFinished) && showContinue && (
          <button
            onClick={() => setReviewMode(true)}
            className="anomaly-fade-in mt-2 self-center rounded-full border border-zinc-800 px-4 py-1.5 text-xs text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-300"
          >
            see what felt wrong →
          </button>
        )}

        <div ref={bottomRef} />
      </div>

      {currentStep?.kind === "reply" && (
        <LiveReplyComposer
          turnsUsed={liveTurns}
          maxTurns={MAX_LIVE_TURNS}
          disabled={liveBusy}
          onSend={handleLiveSend}
          onSkip={handleLiveSkip}
        />
      )}
    </>
  );
}
