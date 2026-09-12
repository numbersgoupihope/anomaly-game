"use client";

import { useState } from "react";

export default function LiveReplyComposer({
  turnsUsed,
  maxTurns,
  disabled,
  onSend,
  onSkip,
}: {
  turnsUsed: number;
  maxTurns: number;
  disabled: boolean;
  onSend: (text: string) => void;
  onSkip: () => void;
}) {
  const [text, setText] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    setText("");
    onSend(trimmed);
  }

  const reachedCap = turnsUsed >= maxTurns;

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-800/80 bg-[#08080a]/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-2">
        {!reachedCap && (
          <form onSubmit={handleSubmit} className="flex w-full items-center gap-2">
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
        )}
        <button
          onClick={onSkip}
          disabled={disabled}
          className="text-xs text-zinc-600 hover:text-zinc-400"
        >
          {reachedCap ? "continue →" : "skip →"}
        </button>
      </div>
    </div>
  );
}
