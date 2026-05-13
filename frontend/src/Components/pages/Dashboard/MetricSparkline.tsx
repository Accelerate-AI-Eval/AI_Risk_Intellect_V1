type MetricSparklineProps = {
  color: string;
  /** Y values in arbitrary units; chart auto-scales */
  points: number[];
};

export function MetricSparkline({ color, points }: MetricSparklineProps) {
  if (points.length < 2) {
    return (
      <svg
        className="dashCard__spark"
        viewBox="0 0 100 32"
        preserveAspectRatio="none"
        aria-hidden
      >
        <line
          x1="0"
          y1="16"
          x2="100"
          y2="16"
          stroke={color}
          strokeWidth="1.5"
          strokeOpacity={0.45}
        />
      </svg>
    );
  }

  const w = 100;
  const h = 32;
  const pad = 2;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const d = points
    .map((p, i) => {
      const x = pad + (i / (points.length - 1)) * (w - pad * 2);
      const y = pad + (1 - (p - min) / range) * (h - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      className="dashCard__spark"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
