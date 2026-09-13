"use client";

import { useEffect, useState } from "react";

const MIN_DELAY_MS = 18000;
const MAX_DELAY_MS = 38000;

/** Rare, brief interface corruption — an avatar flicker or a static burst, never both at once. */
export function useAnalogGlitch() {
  const [avatarGlitch, setAvatarGlitch] = useState(false);
  const [staticBurst, setStaticBurst] = useState(false);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    function scheduleNext() {
      const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
      timeoutId = setTimeout(() => {
        if (Math.random() < 0.5) {
          setAvatarGlitch(true);
          setTimeout(() => setAvatarGlitch(false), 130);
        } else {
          setStaticBurst(true);
          setTimeout(() => setStaticBurst(false), 180);
        }
        scheduleNext();
      }, delay);
    }

    scheduleNext();
    return () => clearTimeout(timeoutId);
  }, []);

  return { avatarGlitch, staticBurst };
}
