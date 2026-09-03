import { cn } from "@/lib/utils";

/**
 * Waveform — an inline-SVG voice equalizer. Renders a row of vertical bars from
 * an amplitude array (0..1). When `animated`, bars bob via a staggered CSS
 * keyframe (the `wave-bar` class + per-bar animation-delay). Pure SVG, no deps.
 */
export function Waveform({
  data,
  width = 96,
  height = 24,
  color = "var(--color-violet)",
  animated = false,
  playing = true,
  className,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  animated?: boolean;
  /** When false, pauses the animation (live panel play/pause). */
  playing?: boolean;
  className?: string;
}) {
  const n = data.length;
  const gap = 2;
  const barW = Math.max(1.5, (width - gap * (n - 1)) / n);
  const mid = height / 2;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn(animated && !playing && "wave-paused", className)}
      aria-hidden
    >
      {data.map((v, i) => {
        const h = Math.max(2, v * height);
        const x = i * (barW + gap);
        return (
          <rect
            key={i}
            x={x}
            y={mid - h / 2}
            width={barW}
            height={h}
            rx={barW / 2}
            fill={color}
            className={animated ? "wave-bar" : undefined}
            style={animated ? { animationDelay: `${(i % 6) * 0.11}s` } : undefined}
          />
        );
      })}
    </svg>
  );
}
