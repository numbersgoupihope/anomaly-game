"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DailyResult, GuessResponse, SceneForClient } from "@/lib/types";
import { getAnonId, getCachedResult, setCachedResult } from "@/lib/storage";
import { buildShareText } from "@/lib/share";
import StatsBar from "@/components/StatsBar";

const ROUND_SECONDS = 30;

type Phase = "loading" | "playing" | "submitting" | "result" | "error";

export default function Game() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [scene, setScene] = useState<SceneForClient | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);
  const [result, setResult] = useState<DailyResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const anonIdRef = useRef<string>("");
  const startedAtRef = useRef<number>(0);
  const submittedRef = useRef(false);

  useEffect(() => {
    anonIdRef.current = getAnonId();

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
          startedAtRef.current = Date.now();
          setPhase("playing");
        }
      })
      .catch((err) => {
        setErrorMessage(err.message ?? "Something went wrong.");
        setPhase("error");
      });
  }, []);

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
          body: JSON.stringify({
            anonId: anonIdRef.current,
            sentenceIndex,
          }),
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
          streakAfter: data.currentStreak,
        };

        setCachedResult(dailyResult);
        setResult(dailyResult);
        setPhase("result");
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

    if (secondsLeft <= 0) {
      submitGuess(-1);
      return;
    }

    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, secondsLeft, submitGuess]);

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

  if (phase === "loading") {
    return <p className="text-sm text-zinc-500">loading today&rsquo;s scene…</p>;
  }

  if (phase === "error") {
    return <p className="text-sm text-red-400">{errorMessage}</p>;
  }

  if (phase === "submitting") {
    return <p className="text-sm text-zinc-500">reading the scene again…</p>;
  }

  if (phase === "result" && result) {
    return (
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
          <p className="text-sm leading-relaxed text-zinc-300">
            {scene?.sentences[result.anomalyIndex]}
          </p>
          <p className="mt-3 text-sm italic leading-relaxed text-zinc-500">
            {result.revealText}
          </p>
        </div>

        <div className="flex items-center justify-between text-sm text-zinc-400">
          <span>streak: {result.streakAfter}</span>
          {result.correct && <span>{result.timeTakenSeconds}s</span>}
        </div>

        <button
          onClick={handleCopy}
          className="rounded border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-900"
        >
          {copied ? "copied" : "copy result"}
        </button>

        <StatsBar />
      </div>
    );
  }

  if (!scene) return null;

  return (
    <div className="flex w-full max-w-xl flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
          Anomaly #{scene.dayNumber}
        </p>
        <p
          className={`font-mono text-sm tabular-nums ${
            secondsLeft <= 10 ? "text-red-400" : "text-zinc-500"
          }`}
        >
          0:{secondsLeft.toString().padStart(2, "0")}
        </p>
      </div>

      <p className="text-xs text-zinc-500">
        one of these sentences is wrong. click it.
      </p>

      <div className="flex flex-col gap-3">
        {scene.sentences.map((sentence, i) => (
          <button
            key={i}
            onClick={() => submitGuess(i)}
            disabled={phase !== "playing"}
            className="rounded border border-zinc-800 bg-zinc-950/40 p-4 text-left text-sm leading-relaxed text-zinc-300 transition-colors hover:border-zinc-500 hover:bg-zinc-900 hover:text-zinc-100 disabled:cursor-default"
          >
            {sentence}
          </button>
        ))}
      </div>

      <StatsBar />
    </div>
  );
}
