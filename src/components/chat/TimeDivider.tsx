"use client";

import { useEffect, useState } from "react";

export default function TimeDivider({ time, glitch }: { time: string; glitch?: boolean }) {
  const [displayTime, setDisplayTime] = useState(glitch ? "3:17 AM" : time);

  useEffect(() => {
    if (!glitch) return;
    const t = setTimeout(() => setDisplayTime(time), 450);
    return () => clearTimeout(t);
  }, [glitch, time]);

  return <p className="self-center py-1 text-[11px] text-zinc-600">{displayTime}</p>;
}
