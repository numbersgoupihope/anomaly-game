"use client";

import { useState } from "react";

export default function LiveReplyComposer({
  turnsUsed,
  maxTurns,
  disabled,
  onSend,
}: {
  turnsUsed: number;
  maxTurns: number;
  disabled: boolean;
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    setText("");
    onSend(trimmed);
  }

  // Once the turn cap is hit, the conversation hands off to the next
  // scripted beat automatically — there is no button to get there.
  if (turnsUsed >= maxTurns) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-800/80 bg-[#08080a]/95 px-4 py-3 backdrop-blur">
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex w-full max-w-xl items-center gap-2"
      >
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled}
          maxLength={300}
          placeholder="iMessage"
          className="flex-1 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled}
          className="rounded-full bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
