"use client";

import NoiseCanvas from "@/components/NoiseCanvas";
import SoundToggle from "@/components/SoundToggle";

export default function Atmosphere({ tension = 0 }: { tension?: number }) {
  return (
    <>
      <NoiseCanvas />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-10 transition-[background] duration-700 ease-out"
        style={{
          background: `radial-gradient(ellipse at center, transparent ${
            42 - tension * 22
          }%, rgba(0,0,0,${0.5 + tension * 0.4}) 100%)`,
        }}
      />
      <SoundToggle />
    </>
  );
}
