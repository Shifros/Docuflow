type MiniSparklineProps = {
  values: number[];
  className?: string;
  stroke?: string;
};

export function MiniSparkline({
  values,
  className = "",
  stroke = "#3cc295",
}: MiniSparklineProps) {
  const width = 320;
  const height = 80;
  const padding = 8;

  if (values.length === 0) {
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={`h-20 w-full ${className}`}
        preserveAspectRatio="none"
      >
        <line
          x1={padding}
          y1={height / 2}
          x2={width - padding}
          y2={height / 2}
          stroke={stroke}
          strokeOpacity={0.25}
          strokeWidth={2}
        />
      </svg>
    );
  }

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const points = values.map((value, index) => {
    const x =
      padding +
      (index / Math.max(values.length - 1, 1)) * (width - padding * 2);
    const y =
      height -
      padding -
      ((value - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const linePath = `M ${points.join(" L ")}`;
  const areaPath = `${linePath} L ${width - padding},${height - padding} L ${padding},${height - padding} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`h-20 w-full ${className}`}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="sparkline-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
        <filter id="sparkline-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor={stroke} floodOpacity="0.45" />
        </filter>
      </defs>
      <path d={areaPath} fill="url(#sparkline-fill)" />
      <path
        d={linePath}
        fill="none"
        stroke={stroke}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#sparkline-glow)"
      />
    </svg>
  );
}

export function buildCumulativeSeries(
  amounts: number[],
): number[] {
  let running = 0;
  return amounts.map((amount) => {
    running += amount;
    return running;
  });
}
