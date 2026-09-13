"use client";

import { useState } from "react";

function sanitizeName(raw: string): string {
  const trimmed = raw.trim().slice(0, 20);
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

// Plain, neutral "setting up a new phone contact" screen — deliberately no
// horror framing or ominous copy. This is app setup, not part of the story;
// the name it captures is used everywhere the episode needs the player's
// real name, including the dynamic evidence beat.
export default function NameSetup({ onDone }: { onDone: (name: string) => void }) {
  const [value, setValue] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = sanitizeName(value);
    if (!name) return;
    onDone(name);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 text-zinc-900">
      <div className="w-full max-w-sm">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
          New Contact
        </p>
        <h1 className="mb-6 text-lg font-medium text-zinc-900">Who&apos;s texting you tonight?</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={20}
            placeholder="First name"
            className="rounded-lg border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 outline-none focus:border-zinc-500"
          />
          <button
            type="submit"
            disabled={!value.trim()}
            className="rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition-opacity disabled:opacity-40"
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}
