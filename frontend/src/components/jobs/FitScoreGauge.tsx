import { cn } from "@/lib/utils";

interface FitScoreGaugeProps {
  rawScore: number | null;
  isStale?: boolean;
  size?: "md" | "lg";
  className?: string;
}

const SIZES = {
  md: { width: 72, height: 48, stroke: 6, fontSize: 18, labelSize: 9 },
  lg: { width: 120, height: 80, stroke: 9, fontSize: 30, labelSize: 11 },
} as const;

// Raw 0-100 → display 20-100 (softer floor so weak matches still show low).
function toDisplayScore(raw: number): number {
  return Math.round(20 + raw * 0.8);
}

function tierColor(display: number): { stroke: string; text: string } {
  if (display >= 75) {
    return { stroke: "stroke-green-500 dark:stroke-green-400", text: "text-green-700 dark:text-green-300" };
  }
  if (display >= 55) {
    return { stroke: "stroke-amber-500 dark:stroke-amber-400", text: "text-amber-700 dark:text-amber-300" };
  }
  return { stroke: "stroke-zinc-400 dark:stroke-zinc-500", text: "text-zinc-600 dark:text-zinc-400" };
}

/**
 * Semi-circle speedometer gauge for the pre-computed job fit score.
 * Raw 0-100 is skewed to a 20-100 display range before rendering.
 * Returns null when the job hasn't been scored yet.
 */
export function FitScoreGauge({ rawScore, isStale = false, size = "md", className }: FitScoreGaugeProps) {
  if (rawScore === null || rawScore === undefined) return null;

  const displayScore = toDisplayScore(rawScore);
  const { stroke, text } = tierColor(displayScore);
  const { width, height, stroke: strokeW, fontSize, labelSize } = SIZES[size];

  // SVG geometry: semi-circle from (strokeW, height) to (width-strokeW, height)
  // Arc radius = (width - 2*strokeW) / 2, centered at (width/2, height).
  const radius = (width - 2 * strokeW) / 2;
  const cx = width / 2;
  const cy = height - strokeW / 2;
  const arcLength = Math.PI * radius;
  const filled = arcLength * (displayScore / 100);

  // Path for the half-circle arc (left to right across the top).
  const arcPath = `M ${strokeW / 2} ${cy} A ${radius} ${radius} 0 0 1 ${width - strokeW / 2} ${cy}`;

  return (
    <div
      className={cn("flex flex-col items-center leading-none", isStale && "opacity-60", className)}
      title={isStale ? "Score will refresh on next daily update" : undefined}
    >
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <path
          d={arcPath}
          fill="none"
          strokeWidth={strokeW}
          strokeLinecap="round"
          className="stroke-zinc-200 dark:stroke-zinc-700"
        />
        <path
          d={arcPath}
          fill="none"
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${arcLength}`}
          className={stroke}
        />
        <text
          x={cx}
          y={cy - strokeW}
          textAnchor="middle"
          className={cn("font-bold", text)}
          style={{ fontSize }}
        >
          {displayScore}
        </text>
      </svg>
      <span
        className={cn("font-semibold tracking-wider uppercase text-muted-foreground", text)}
        style={{ fontSize: labelSize, marginTop: -4 }}
      >
        Match
      </span>
    </div>
  );
}
