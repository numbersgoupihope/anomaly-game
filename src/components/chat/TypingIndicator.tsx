export default function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 self-start rounded-2xl rounded-bl-sm bg-zinc-800/80 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400"
          style={{ animationDelay: `${i * 150}ms`, animationDuration: "900ms" }}
        />
      ))}
    </div>
  );
}
