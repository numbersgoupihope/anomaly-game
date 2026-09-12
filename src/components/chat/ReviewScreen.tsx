"use client";

import { useState } from "react";
import { CORRECT_IDS, type Path, type ResolvedItem } from "@/lib/chat-script";
import MessageBubble from "@/components/chat/MessageBubble";
import ImageCard from "@/components/chat/ImageCard";

export default function ReviewScreen({
  resolved,
  path,
}: {
  resolved: ResolvedItem[];
  path: Path;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  const correctIds = CORRECT_IDS[path];
  const score = correctIds.filter((id) => selected.has(id)).length;

  function toggle(id: string) {
    if (submitted) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="sticky top-0 z-10 border-b border-zinc-800/80 bg-[#08080a]/90 px-4 py-3 backdrop-blur">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
          {submitted ? `${score} / ${correctIds.length} found` : "what felt wrong?"}
        </p>
        {!submitted && (
          <p className="mt-1 text-[11px] text-zinc-600">
            tap every message that felt off, then submit.
          </p>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 px-4 pb-28 pt-4">
        {resolved.map((item) =>
          item.kind === "message" ? (
            <MessageBubble
              key={item.id}
              from={item.from}
              text={item.text}
              reviewable={item.from === "mom"}
              selected={selected.has(item.id)}
              revealed={submitted}
              isCorrect={correctIds.includes(item.id)}
              onToggle={() => toggle(item.id)}
            />
          ) : (
            <div key={item.id} className="flex justify-start">
              <ImageCard content={item.content} />
            </div>
          )
        )}
      </div>

      {!submitted && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-800/80 bg-[#08080a]/95 px-4 py-3 backdrop-blur">
          <button
            onClick={() => setSubmitted(true)}
            className="mx-auto block w-full max-w-xl rounded-full border border-zinc-700 bg-zinc-100 py-2.5 text-sm font-medium text-zinc-900 transition-opacity hover:opacity-90"
          >
            submit ({selected.size} selected)
          </button>
        </div>
      )}
    </div>
  );
}
