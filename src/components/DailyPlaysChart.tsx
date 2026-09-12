type Point = { play_date: string; total_plays: number };

const WIDTH = 640;
const HEIGHT = 180;
const PAD_X = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;

function formatShortDate(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function DailyPlaysChart({ data }: { data: Point[] }) {
  if (data.length < 2) {
    return <p className="text-sm text-zinc-500">not enough data yet.</p>;
  }

  const max = Math.max(...data.map((d) => d.total_plays), 1);
  const innerWidth = WIDTH - PAD_X * 2;
  const innerHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const points = data.map((d, i) => ({
    x: PAD_X + (i / (data.length - 1)) * innerWidth,
    y: PAD_TOP + innerHeight - (d.total_plays / max) * innerHeight,
    value: d.total_plays,
  }));

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  const last = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full"
      role="img"
      aria-label="Daily plays over the last 30 days"
    >
      {[0, 0.5, 1].map((g) => {
        const y = PAD_TOP + innerHeight * g;
        return (
          <line
            key={g}
            x1={PAD_X}
            x2={WIDTH - PAD_X}
            y1={y}
            y2={y}
            stroke="#2c2c2a"
            strokeWidth={1}
          />
        );
      })}

      <path
        d={path}
        fill="none"
        stroke="#3987e5"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last.x} cy={last.y} r={3} fill="#3987e5" />
      <text
        x={last.x}
        y={last.y - 8}
        textAnchor="end"
        fontSize={11}
        fill="#c3c2b7"
      >
        {last.value}
      </text>

      <text x={PAD_X} y={HEIGHT - 8} fontSize={11} fill="#898781">
        {formatShortDate(data[0].play_date)}
      </text>
      <text
        x={WIDTH - PAD_X}
        y={HEIGHT - 8}
        textAnchor="end"
        fontSize={11}
        fill="#898781"
      >
        {formatShortDate(data[data.length - 1].play_date)}
      </text>
    </svg>
  );
}
