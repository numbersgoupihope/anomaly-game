"use client";

import { useState } from "react";
import { getAudioEngine } from "@/lib/audio";

export default function SoundToggle() {
  const [on, setOn] = useState(false);

  async function toggle() {
    const engine = getAudioEngine();
    if (on) {
      engine.disable();
      setOn(false);
    } else {
      await engine.enable();
      setOn(true);
    }
  }

  return (
    <button
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? "mute sound" : "enable sound"}
      className="fixed bottom-4 right-4 z-20 rounded-full border border-zinc-800 bg-zinc-950/70 px-3 py-1.5 text-xs text-zinc-500 backdrop-blur transition-colors hover:border-zinc-600 hover:text-zinc-300"
    >
      {on ? "♪ sound on" : "♪ sound off"}
    </button>
  );
}
