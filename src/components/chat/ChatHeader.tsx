export default function ChatHeader({ glitch }: { glitch?: boolean }) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-zinc-800/80 bg-[#08080a]/90 px-4 py-3 backdrop-blur">
      <span className="text-lg text-zinc-600">‹</span>
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${
          glitch
            ? "-skew-x-12 scale-x-90 bg-red-900/70 text-cyan-300"
            : "bg-zinc-700 text-zinc-200"
        }`}
      >
        M
      </div>
      <div>
        <p className="text-sm font-medium text-zinc-100">Mom</p>
        <p className="text-[11px] text-zinc-500">iMessage</p>
      </div>
    </div>
  );
}
