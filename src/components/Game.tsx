"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DailyResult, GuessResponse, SceneForClient } from "@/lib/types";
import { getCachedResult, setCachedResult } from "@/lib/storage";
import { buildShareText } from "@/lib/share";
import { framingLineForDay } from "@/lib/framing";
import { getAudioEngine } from "@/lib/audio";
import StatsBar from "@/components/StatsBar";
import NoiseCanvas from "@/components/NoiseCanvas";
import SoundToggle from "@/components/SoundToggle";

const ROUND_SECONDS = 30;
const FRAMING_MS = 2400;
const REVEAL_STEP_MS = 750;
const REVEAL_SETTLE_MS = 500;
const GLITCH_MS = 650;

type Phase =
  | "loading"
  | "framing"
  | "revealing"
  | "playing"
  | "submitting"
  | "glitching"
  | "result"
  | "error";

export default function Game() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [scene, setScene] = useState<SceneForClient | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);
  const [revealedCount, setRevealedCount] = useState(0);
  const [result, setResult] = useState<DailyResult | null>(null);
  const [glitchIndex, setGlitchIndex] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const startedAtRef = useRef<number>(0);
  const submittedRef = useRef(false);
  const pendingResultRef = useRef<DailyResult | null>(null);

  useEffect(() => {
    fetch("/api/scene", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("No scene available today.");
        return (await res.json()) as SceneForClient;
      })
      .then((data) => {
        setScene(data);

        const cached = getCachedResult(data.playDate);
        if (cached) {
          setResult(cached);
          setPhase("result");
        } else {
          setPhase("framing");
        }
      })
      .catch((err) => {
        setErrorMessage(err.message ?? "Something went wrong.");
        setPhase("error");
      });
  }, []);

  // Framing line holds, then hands off to the staggered sentence reveal.
  useEffect(() => {
    if (phase !== "framing") return;
    const id = setTimeout(() => {
      setRevealedCount(0);
      setPhase("revealing");
    }, FRAMING_MS);
    return () => clearTimeout(id);
  }, [phase]);

  // Sentences appear one at a time; the timer and click targets stay off until all are in.
  useEffect(() => {
    if (phase !== "revealing" || !scene) return;

    if (revealedCount >= scene.sentences.length) {
      const id = setTimeout(() => {
        startedAtRef.current = Date.now();
        setPhase("playing");
      }, REVEAL_SETTLE_MS);
      return () => clearTimeout(id);
    }

    const id = setTimeout(() => setRevealedCount((c) => c + 1), REVEAL_STEP_MS);
    return () => clearTimeout(id);
  }, [phase, revealedCount, scene]);

  const submitGuess = useMemo(
    () => async (sentenceIndex: number) => {
      if (submittedRef.current || !scene) return;
      submittedRef.current = true;
      setPhase("submitting");

      const timeTakenSeconds = Math.min(
        ROUND_SECONDS,
        Math.round((Date.now() - startedAtRef.current) / 1000)
      );

      try {
        const res = await fetch("/api/guess", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sentenceIndex }),
        });
        if (!res.ok) throw new Error("Couldn't submit your guess.");
        const data: GuessResponse = await res.json();

        const dailyResult: DailyResult = {
          playDate: scene.playDate,
          dayNumber: scene.dayNumber,
          chosenIndex: sentenceIndex,
          correct: data.correct,
          anomalyIndex: data.anomalyIndex,
          revealText: data.revealText,
          timeTakenSeconds,
        };

        setCachedResult(dailyResult);

        const audio = getAudioEngine();
        if (audio.enabled) {
          if (data.correct) audio.playCorrect();
          else audio.playIncorrect();
        }

        if (data.correct) {
          setResult(dailyResult);
          setPhase("result");
        } else {
          pendingResultRef.current = dailyResult;
          setGlitchIndex(data.anomalyIndex);
          setPhase("glitching");
        }
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : "Something went wrong."
        );
        setPhase("error");
      }
    },
    [scene]
  );

  useEffect(() => {
    if (phase !== "playing") return;

    const audio = getAudioEngine();
    audio.setTension((ROUND_SECONDS - secondsLeft) / ROUND_SECONDS);

    if (secondsLeft <= 0) {
      submitGuess(-1);
      return;
    }

    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, secondsLeft, submitGuess]);

  // A wrong or missed guess glitches the true anomaly briefly before the calm reveal.
  useEffect(() => {
    if (phase !== "glitching") return;
    const id = setTimeout(() => {
      setResult(pendingResultRef.current);
      setPhase("result");
    }, GLITCH_MS);
    return () => clearTimeout(id);
  }, [phase]);

  async function handleCopy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(buildShareText(result));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard permission denied — nothing sensible to do
    }
  }

  const tension =
    phase === "playing" ? (ROUND_SECONDS - secondsLeft) / ROUND_SECONDS : 0;

  let content: React.ReactNode;

  if (phase === "loading") {
    content = <p className="text-sm text-zinc-500">loading today&rsquo;s scene…</p>;
  } else if (phase === "error") {
    content = <p className="text-sm text-red-400">{errorMessage}</p>;
  } else if (phase === "framing" && scene) {
    content = (
      <div className="flex min-h-[35vh] w-full max-w-lg flex-col items-center justify-center text-center">
        <p className="anomaly-fade-in font-display text-base italic leading-relaxed text-zinc-400">
          {framingLineForDay(scene.dayNumber)}
        </p>
      </div>
    );
  } else if (phase === "submitting") {
    content = <p className="text-sm text-zinc-500">reading the scene again…</p>;
  } else if (phase === "glitching" && scene && glitchIndex !== null) {
    content = (
      <div className="flex w-full max-w-xl flex-col gap-6">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
          Anomaly #{scene.dayNumber}
        </p>
        <div className="rounded border border-zinc-800 bg-zinc-950/60 p-5">
          <p className="anomaly-glitch font-display text-sm leading-relaxed text-zinc-300">
            {scene.sentences[glitchIndex]}
          </p>
        </div>
      </div>
    );
  } else if (phase === "result" && result) {
    content = (
      <div className="flex w-full max-w-xl flex-col gap-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Anomaly #{result.dayNumber}
          </p>
          <h1
            className={`mt-2 text-2xl font-semibold ${
              result.correct ? "text-zinc-100" : "text-zinc-300"
            }`}
          >
            {result.correct ? "You caught it." : "You missed it."}
          </h1>
        </div>

        <div className="rounded border border-zinc-800 bg-zinc-950/60 p-5">
          <p className="font-display text-sm leading-relaxed text-zinc-300">
            {scene?.sentences[result.anomalyIndex]}
          </p>
          <p className="mt-3 text-sm italic leading-relaxed text-zinc-500">
            {result.revealText}
          </p>
        </div>

        {result.correct && (
          <p className="text-sm text-zinc-400">{result.timeTakenSeconds}s</p>
        )}

        <button
          onClick={handleCopy}
          className="rounded border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-900"
        >
          {copied ? "copied" : "copy result"}
        </button>

        <StatsBar />
      </div>
    );
  } else if ((phase === "revealing" || phase === "playing") && scene) {
    const visibleCount =
      phase === "revealing" ? revealedCount : scene.sentences.length;

    content = (
      <div className="flex w-full max-w-xl flex-col gap-6">
        <div className="flex items-baseline justify-between">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Anomaly #{scene.dayNumber}
          </p>
          <p
            className={`font-mono text-sm tabular-nums ${
              phase === "playing" && secondsLeft <= 10
                ? "text-red-400"
                : "text-zinc-500"
            }`}
          >
            0:
            {(phase === "playing" ? secondsLeft : ROUND_SECONDS)
              .toString()
              .padStart(2, "0")}
          </p>
        </div>

        <p className="text-xs text-zinc-500">
          one of these sentences is wrong. click it.
        </p>

        <div className="flex flex-col gap-3">
          {scene.sentences.slice(0, visibleCount).map((sentence, i) => (
            <button
              key={i}
              onClick={() => submitGuess(i)}
              disabled={phase !== "playing"}
              className="anomaly-fade-in rounded border border-zinc-800 bg-zinc-950/40 p-4 text-left font-display text-sm leading-relaxed text-zinc-300 transition-colors hover:border-zinc-500 hover:bg-zinc-900 hover:text-zinc-100 disabled:cursor-default"
            >
              {sentence}
            </button>
          ))}
        </div>

        <StatsBar />
      </div>
    );
  }

  return (
    <>
      <NoiseCanvas />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-10 transition-[background] duration-700 ease-out"
        style={{
          background: `radial-gradient(ellipse at center, transparent ${
            42 - tension * 22
          }%, rgba(0,0,0,${0.5 + tension * 0.4}) 100%)`,
        }}
      />
      <SoundToggle />
      {content}
    </>
  );
}
