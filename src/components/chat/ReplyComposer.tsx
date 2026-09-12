"use client";

import { useEffect, useRef, useState } from "react";

const AUTO_ADVANCE_MS = 2600;

export default function ReplyComposer({
  onAdvance,
}: {
  onAdvance: (text: string | null) => void;
}) {
  const [text, setText] = useState("");
  const firedRef = useRef(false);
  const onAdvanceRef = useRef(onAdvance);

  useEffect(() => {
    onAdvanceRef.current = onAdvance;
  });

  useEffect(() => {
    const t = setTimeout(() => {
      if (!firedRef.current) {
        firedRef.current = true;
        onAdvanceRef.current(null);
      }
    }, AUTO_ADVANCE_MS);
    return () => clearTimeout(t);
  }, []);

  function handleSend() {
    if (firedRef.current) return;
    firedRef.current = true;
    onAdvanceRef.current(text.trim() || null);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-800/80 bg-[#08080a]/95 px-4 py-3 backdrop-blur">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="mx-auto flex w-full max-w-xl items-center gap-2"
      >
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="iMessage"
          className="flex-1 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
        />
        <button
          type="submit"
          className="rounded-full bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition-opacity hover:opacity-90"
        >
          Send
        </button>
      </form>
    </div>
  );
}
