"use client";

import { useEffect, useRef, useState } from "react";
import {
  AWARE_STEPS,
  COMPLIANT_STEPS,
  INTRO_STEPS,
  type FlickerStep,
  type Path,
  type ResolvedItem,
  type ScriptStep,
} from "@/lib/chat-script";
import Atmosphere from "@/components/Atmosphere";
import ChatHeader from "@/components/chat/ChatHeader";
import TypingIndicator from "@/components/chat/TypingIndicator";
import MessageBubble from "@/components/chat/MessageBubble";
import ImageCard from "@/components/chat/ImageCard";
import ChoicePrompt from "@/components/chat/ChoicePrompt";
import ReplyComposer from "@/components/chat/ReplyComposer";
import ReviewScreen from "@/components/chat/ReviewScreen";

// The "are you still there" pause: on, off, on, off, on, off — landing the
// message right after the final off, ~15s total.
const FLICKER_SCHEDULE_MS = [2500, 1500, 2500, 1500, 2500, 4500];

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

  const bottomRef = useRef<HTMLDivElement>(null);

  // What the player is looking at is entirely a function of where the
  // script pointer is — no separate "phase" state to keep in sync with it.
  const currentStep = activeSteps[stepIndex];
  const awareFinished = !currentStep && path === "aware";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [resolved, currentStep, flickerOn]);

  // Advances through messages/images automatically; reply/choice/frozen
  // steps just sit here until the player (or the flicker effect) moves on.
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

  function handleReplyAdvance(text: string | null) {
    if (text) {
      setResolved((r) => [
        ...r,
        { kind: "message", id: `you-${stepIndex}`, time: "", text, from: "you" },
      ]);
    }
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

  return (
    <>
      <Atmosphere />
      <ChatHeader />
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3 px-4 pb-28 pt-4">
        {resolved.map((item) =>
          item.kind === "message" ? (
            <MessageBubble key={item.id} from={item.from} text={item.text} />
          ) : (
            <div key={item.id} className="flex justify-start">
              <ImageCard content={item.content} />
            </div>
          )
        )}

        {(currentStep?.kind === "message" || currentStep?.kind === "image") && (
          <TypingIndicator />
        )}

        {currentStep?.kind === "flicker" && flickerOn && <TypingIndicator />}
        {currentStep?.kind === "frozen" && <TypingIndicator />}

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

      {currentStep?.kind === "reply" && <ReplyComposer onAdvance={handleReplyAdvance} />}
    </>
  );
}
