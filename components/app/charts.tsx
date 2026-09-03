import { cn } from "@/lib/utils";

/**
 * AreaChart — an inline-SVG area+line chart with a violet gradient fill and
 * hairline x-axis labels. Deterministic, no deps. Used for call-volume over time.
 */
export function AreaChart({
  data,
  width = 560,
  height = 180,
  color = "var(--color-violet)",
  className,
}: {
  data: { label: string; value: number }[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}) {
  if (!data || data.length < 2) return null;
  const padX = 6;
  const padTop = 10;
  const axisH = 18;
  const plotH = height - padTop - axisH;
  const max = Math.max(...data.map((d) => d.value)) || 1;

  const pts = data.map((d, i) => {
    const x = padX + (i / (data.length - 1)) * (width - padX * 2);
    const y = padTop + (1 - d.value / max) * plotH;
    return [x, y] as const;
  });

  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const base = padTop + plotH;
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${base} L${pts[0][0].toFixed(1)} ${base} Z`;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={cn("overflow-visible", className)} aria-hidden>
      <defs>
        <linearGradient id="vox-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.32" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* gridlines */}
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1={padX} x2={width - padX} y1={padTop + g * plotH} y2={padTop + g * plotH} stroke="var(--color-border)" strokeWidth="1" strokeDasharray="2 4" opacity="0.5" />
      ))}
      <path d={area} fill="url(#vox-area)" />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.4" fill="var(--color-background)" stroke={color} strokeWidth="1.6" />
      ))}
      {data.map((d, i) => (
        <text key={d.label} x={pts[i][0]} y={height - 4} textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)" fill="var(--color-muted-foreground)">
          {d.label}
        </text>
      ))}
    </svg>
  );
}

/**
 * Donut — an inline-SVG donut chart from labeled, tinted segments. Renders a
 * total in the hole. Used for the outcomes breakdown.
 */
export function Donut({
  segments,
  size = 168,
  thickness = 22,
  centerTop,
  centerLabel,
  className,
}: {
  segments: { key: string; value: number; tint: string }[];
  size?: number;
  thickness?: number;
  centerTop: string;
  centerLabel: string;
  className?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className} aria-hidden>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {segments.map((s) => {
          const frac = s.value / total;
          const dash = frac * c;
          const seg = (
            <circle
              key={s.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.tint}
              strokeWidth={thickness}
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += dash;
          return seg;
        })}
      </g>
      <text x="50%" y="46%" textAnchor="middle" fontSize="26" fontWeight="700" fontFamily="var(--font-mono)" fill="var(--color-foreground)">
        {centerTop}
      </text>
      <text x="50%" y="60%" textAnchor="middle" fontSize="9.5" fontFamily="var(--font-mono)" letterSpacing="1.2" fill="var(--color-muted-foreground)">
        {centerLabel}
      </text>
    </svg>
  );
}
