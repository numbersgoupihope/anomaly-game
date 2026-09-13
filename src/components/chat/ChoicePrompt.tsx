import { CHOICE_OPTIONS, type Path } from "@/lib/chat-script";

export default function ChoicePrompt({
  onPick,
}: {
  onPick: (path: Path) => void;
}) {
  return (
    <div className="anomaly-fade-in flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
      <p className="text-center text-xs uppercase tracking-[0.2em] text-zinc-500">
        what do you say?
      </p>
      {CHOICE_OPTIONS.map((opt) => (
        <button
          key={opt.path}
          onClick={() => onPick(opt.path)}
          className="rounded-xl border border-zinc-700 bg-zinc-900/80 px-4 py-3 text-left text-sm text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-900"
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
