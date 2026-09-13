"use client";

type Props = {
  from: "mom" | "you";
  text: string;
  reviewable?: boolean;
  selected?: boolean;
  revealed?: boolean;
  isCorrect?: boolean;
  onToggle?: () => void;
  domId?: string;
};

export default function MessageBubble({
  from,
  text,
  reviewable,
  selected,
  revealed,
  isCorrect,
  onToggle,
  domId,
}: Props) {
  const isMom = from === "mom";

  let ring = "";
  let badge: string | null = null;
  let badgeClass = "";

  if (revealed) {
    if (isCorrect && selected) {
      ring = "ring-2 ring-emerald-500/70";
      badge = "found it";
      badgeClass = "text-emerald-400";
    } else if (isCorrect && !selected) {
      ring = "ring-1 ring-dashed ring-amber-500/60";
      badge = "missed this one";
      badgeClass = "text-amber-400";
    } else if (selected) {
      ring = "ring-1 ring-zinc-600";
      badge = "not this one";
      badgeClass = "text-zinc-500";
    }
  } else if (selected) {
    ring = "ring-2 ring-zinc-400";
  }

  return (
    <div id={domId} className={`flex flex-col gap-1 ${isMom ? "items-start" : "items-end"}`}>
      <div
        onClick={reviewable ? onToggle : undefined}
        className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${ring} ${
          isMom
            ? "rounded-bl-sm bg-zinc-800/80 text-zinc-100"
            : "rounded-br-sm bg-slate-700/60 text-zinc-100"
        } ${reviewable ? "cursor-pointer" : ""}`}
      >
        {text}
      </div>
      {badge && <p className={`px-1 text-[11px] ${badgeClass}`}>{badge}</p>}
    </div>
  );
}
