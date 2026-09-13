"use client";

import { useState } from "react";
import ChatEpisode from "@/components/chat/ChatEpisode";
import NameSetup from "@/components/NameSetup";

export default function Home() {
  const [playerName, setPlayerName] = useState<string | null>(null);

  return (
    <main className="flex min-h-screen flex-1 flex-col">
      {playerName ? (
        <ChatEpisode playerName={playerName} />
      ) : (
        <NameSetup onDone={setPlayerName} />
      )}
    </main>
  );
}
